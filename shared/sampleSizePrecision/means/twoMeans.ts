import type { PrecisionInput, PrecisionResult, TRefinementInfo } from "../types";
import { getZForConfidence } from "../proportions/cochran";
import { getCriticalValue } from "../../powerAnalysis/utils";

/**
 * Tamanho amostral para estimar a DIFERENÇA entre as médias de dois grupos
 * independentes (μ₁ − μ₂) com margem de erro absoluta E e nível de confiança
 * especificado, assumindo alocação igual (n por grupo).
 *
 * O intervalo de confiança para a diferença, por aproximação normal, tem
 * semilargura E = z·√(σ₁²/n + σ₂²/n). Isolando n (por grupo):
 *
 *   Modo separado (σ₁, σ₂):  n = z²·(σ₁² + σ₂²) / E²
 *   Modo pooled (σ comum):   n = 2·z²·σ² / E²
 *
 * As correções para população finita e por não-resposta seguem a mesma
 * convenção das demais calculadoras por precisão e são aplicadas ao n POR
 * GRUPO (populationN é interpretado como o tamanho da população de cada
 * grupo). O total do estudo é 2·n.
 *
 * Refinamento opcional com a distribuição t (useTDistribution=true): em vez do
 * quantil normal z, o n por grupo é recalculado iterando o quantil t de Student
 * com graus de liberdade do desenho de duas amostras (pooled: 2·(n−1); separado:
 * Welch–Satterthwaite) até convergir. Corrige a leve subestimação do n quando a
 * amostra é pequena (n < ~30) e σ foi estimado de um piloto.
 */
export function calculateSampleSizeTwoMeans(input: PrecisionInput): PrecisionResult {
  const { sigmaSD, sigma1, sigma2, sigmaMode, marginD, confidenceLevel, populationN, nonResponseRate } = input;

  const mode = sigmaMode ?? 'pooled';

  const k = input.allocationRatio ?? 1;
  if (!Number.isFinite(k) || k <= 0) {
    throw new Error("Razão de alocação (k = n₂/n₁) deve ser um número maior que zero");
  }

  if (marginD <= 0) {
    throw new Error("Margem de erro (E) deve ser maior que zero");
  }
  if (confidenceLevel <= 0 || confidenceLevel >= 100) {
    throw new Error("Nível de confiança deve estar entre 0 e 100 (exclusive)");
  }
  if (populationN !== undefined && populationN !== null && (!Number.isInteger(populationN) || populationN <= 0)) {
    throw new Error("Tamanho da população (N) deve ser inteiro positivo");
  }
  if (nonResponseRate !== undefined && nonResponseRate !== null && (nonResponseRate < 0 || nonResponseRate >= 1)) {
    throw new Error("Taxa de não-resposta deve estar em [0, 1)");
  }

  let varSum: number; // σ₁² + σ₂²
  let var1 = 0; // σ₁²
  let var2 = 0; // σ₂²
  let n0Formula: string;
  if (mode === 'separate') {
    if (sigma1 === undefined || sigma1 === null || sigma1 <= 0) {
      throw new Error("Desvio-padrão do grupo 1 (σ₁) deve ser maior que zero");
    }
    if (sigma2 === undefined || sigma2 === null || sigma2 <= 0) {
      throw new Error("Desvio-padrão do grupo 2 (σ₂) deve ser maior que zero");
    }
    var1 = sigma1 * sigma1;
    var2 = sigma2 * sigma2;
    varSum = var1 + var2;
  } else {
    if (sigmaSD === undefined || sigmaSD === null || sigmaSD <= 0) {
      throw new Error("Desvio-padrão comum (σ) deve ser maior que zero");
    }
    var1 = sigmaSD * sigmaSD;
    var2 = sigmaSD * sigmaSD;
    varSum = 2 * var1;
  }

  const z = getZForConfidence(confidenceLevel);
  const warnings: string[] = [];
  const useT = input.useTDistribution === true;
  const alpha = 1 - confidenceLevel / 100;

  // Com alocação k = n₂/n₁ e n₂ = k·n₁, a semilargura é
  // E = q·√(σ₁²/n₁ + σ₂²/(k·n₁)). Isolando o n DO GRUPO 1:
  //   n₁ = q²·(σ₁² + σ₂²/k) / E²
  // Em k = 1 reduz-se à fórmula de alocação igual (varEff = σ₁² + σ₂² = varSum).
  const varEff = var1 + var2 / k;
  const rawFromQuantile = (q: number): number => (q * q * varEff) / (marginD * marginD);

  // Graus de liberdade do desenho de duas amostras com alocação k (n₂ = k·n₁),
  // em função do n do grupo 1:
  //   pooled (variâncias iguais):   df = n₁ + n₂ − 2 = n₁·(1 + k) − 2
  //   separado (Welch–Satterthwaite):
  //       df = (σ₁²/n₁ + σ₂²/n₂)² / [ (σ₁²/n₁)²/(n₁−1) + (σ₂²/n₂)²/(n₂−1) ]
  // Em k = 1 ambas reduzem-se às fórmulas de alocação igual (2·(n−1) e a forma
  // de Welch com n₁=n₂).
  const dfForN = (n1: number): number => {
    const n2 = k * n1;
    if (mode === 'pooled') return Math.max(1, n1 + n2 - 2);
    const a = var1 / n1;
    const b = var2 / n2;
    const num = (a + b) * (a + b);
    const den = (a * a) / Math.max(1e-12, n1 - 1) + (b * b) / Math.max(1e-12, n2 - 1);
    return Math.max(1, num / den);
  };

  // Valor base com o quantil normal z (sempre calculado: referência no resultado
  // e chute inicial do refinamento iterativo).
  const zRaw = rawFromQuantile(z);
  const zN0 = Math.ceil(zRaw);

  let n0Raw = zRaw;
  let n0: number;
  let tRefinement: TRefinementInfo | null = null;

  if (useT) {
    // Mesmo esquema do procedimento de média populacional: procura-se o MENOR n
    // inteiro (por grupo) que é suficiente com seus próprios graus de liberdade,
    // i.e. aquele em que o n requerido por (t²·varSum/E²) — com df do desenho e
    // t = t_{1−α/2, df} — não excede o próprio n. Como t > z e t decresce quando
    // os g.l. aumentam, o requisito diminui à medida que n cresce, garantindo
    // terminação. A saída é coerente: n₀ = nSol, dfUsed corresponde a esse nSol.
    const maxIter = 10000;
    let nSol = Math.max(2, zN0);
    let tUsed = z;
    let tRaw = zRaw;
    let dfUsed = dfForN(nSol);
    let iterations = 0;
    let converged = false;

    for (let i = 0; i < maxIter; i++) {
      iterations++;
      dfUsed = dfForN(nSol);
      tUsed = getCriticalValue(alpha, dfUsed, 'two');
      tRaw = rawFromQuantile(tUsed);
      if (tRaw <= nSol) {
        converged = true;
        break;
      }
      nSol += 1;
    }

    n0Raw = tRaw;
    n0 = nSol;
    tRefinement = { tUsed, dfUsed, iterations, converged };

    if (mode === 'separate') {
      n0Formula = k === 1
        ? `n = t²·(σ₁² + σ₂²) / E² = ${tUsed.toFixed(4)}² × (${sigma1}² + ${sigma2}²) / ${marginD}²  [t com ${dfUsed.toFixed(1)} g.l., refinamento iterativo]`
        : `n₁ = t²·(σ₁² + σ₂²/k) / E² = ${tUsed.toFixed(4)}² × (${sigma1}² + ${sigma2}²/${k}) / ${marginD}²  [t com ${dfUsed.toFixed(1)} g.l., refinamento iterativo]`;
    } else {
      n0Formula = k === 1
        ? `n = 2·t²·σ² / E² = 2 × ${tUsed.toFixed(4)}² × ${sigmaSD}² / ${marginD}²  [t com ${dfUsed.toFixed(1)} g.l., refinamento iterativo]`
        : `n₁ = t²·σ²·(1 + 1/k) / E² = ${tUsed.toFixed(4)}² × ${sigmaSD}² × (1 + 1/${k}) / ${marginD}²  [t com ${dfUsed.toFixed(1)} g.l., refinamento iterativo]`;
    }

    if (!converged) {
      warnings.push("O refinamento com a distribuição t não convergiu dentro do limite de iterações; o n pode estar ligeiramente subestimado.");
    } else if (n0 === zN0) {
      warnings.push("Para este tamanho amostral, o refinamento com t coincide com a aproximação normal (z): a diferença é desprezível.");
    }
  } else {
    n0 = Math.ceil(zRaw);
    if (mode === 'separate') {
      n0Formula = k === 1
        ? `n = z²·(σ₁² + σ₂²) / E² = ${z.toFixed(4)}² × (${sigma1}² + ${sigma2}²) / ${marginD}²`
        : `n₁ = z²·(σ₁² + σ₂²/k) / E² = ${z.toFixed(4)}² × (${sigma1}² + ${sigma2}²/${k}) / ${marginD}²`;
    } else {
      n0Formula = k === 1
        ? `n = 2·z²·σ² / E² = 2 × ${z.toFixed(4)}² × ${sigmaSD}² / ${marginD}²`
        : `n₁ = z²·σ²·(1 + 1/k) / E² = ${z.toFixed(4)}² × ${sigmaSD}² × (1 + 1/${k}) / ${marginD}²`;
    }
  }

  let nFinite: number | null = null;
  let nFiniteFormula: string | undefined;
  if (populationN && populationN > 0) {
    const nFiniteRaw = n0Raw / (1 + (n0Raw - 1) / populationN);
    nFinite = Math.ceil(nFiniteRaw);
    nFiniteFormula = `n = n₀ / (1 + (n₀−1)/N) = ${n0} / (1 + ${n0 - 1}/${populationN})`;
    if (populationN > 10000) {
      warnings.push("População por grupo > 10.000: correção finita produz efeito < 4% e geralmente pode ser omitida.");
    }
  }

  let nAdjusted: number | null = null;
  let nAdjustedFormula: string | undefined;
  if (nonResponseRate !== undefined && nonResponseRate !== null && nonResponseRate > 0) {
    const base = nFinite ?? n0;
    const nAdjRaw = base / (1 - nonResponseRate);
    nAdjusted = Math.ceil(nAdjRaw);
    nAdjustedFormula = `n_ajust = n / (1 − NR) = ${base} / (1 − ${nonResponseRate})`;
    if (nonResponseRate >= 0.5) {
      warnings.push("Taxa de não-resposta ≥ 50% praticamente dobra o N por grupo.");
    }
  }

  const finalPerGroup = nAdjusted ?? nFinite ?? n0; // n₁ (grupo 1)
  const n1 = finalPerGroup;
  const n2 = Math.ceil(k * finalPerGroup);
  if (k === 1) {
    warnings.push(`O valor de n é POR GRUPO; o total do estudo é o dobro (2 × ${finalPerGroup} = ${2 * finalPerGroup}).`);
  } else {
    warnings.push(`Alocação desigual (k = n₂/n₁ = ${k}): n₁ = ${n1} (grupo 1) e n₂ = ${n2} (grupo 2); total do estudo = ${n1} + ${n2} = ${n1 + n2}.`);
  }
  if (Math.max(n1, n2) > 100000) {
    warnings.push("Resultado > 100.000 participantes em um dos grupos. Revise os parâmetros — pode haver erro nos inputs.");
  }

  return {
    procedureType: 'diff-means',
    input,
    zUsed: z,
    n0,
    nFinite,
    nAdjusted,
    n1,
    n2,
    formula: { n0: n0Formula, nFinite: nFiniteFormula, nAdjusted: nAdjustedFormula },
    warnings,
    tRefinement,
  };
}
