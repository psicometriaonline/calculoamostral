import type { PrecisionInput, PrecisionResult, TRefinementInfo } from "../types";
import { getZForConfidence } from "../proportions/cochran";
import { getCriticalValue } from "../../powerAnalysis/utils";

/**
 * Tamanho amostral para estimar uma média populacional (μ) com margem de
 * erro controlada e nível de confiança especificado.
 *
 * Modo absoluto:  n₀ = (z·σ / E)²
 * Modo relativo:  n₀ = (z·σ / (ε·μ))² = (z·CV / ε)²   (CV = σ/μ)
 *
 * Correção para população finita e ajuste por não-resposta seguem a mesma
 * convenção da calculadora de prevalência (Cochran).
 */
export function calculateSampleSizeMean(input: PrecisionInput): PrecisionResult {
  const { sigmaSD, meanMu, marginD, confidenceLevel, precisionMode, populationN, nonResponseRate } = input;

  if (sigmaSD === undefined || sigmaSD === null || sigmaSD <= 0) {
    throw new Error("Desvio-padrão (σ) deve ser maior que zero");
  }
  if (marginD <= 0) {
    throw new Error("Margem de erro deve ser maior que zero");
  }
  if (confidenceLevel <= 0 || confidenceLevel >= 100) {
    throw new Error("Nível de confiança deve estar entre 0 e 100 (exclusive)");
  }
  if (precisionMode === 'relative' && (meanMu === undefined || meanMu === null || meanMu === 0)) {
    throw new Error("No modo relativo, informe a média esperada (μ) diferente de zero");
  }
  if (populationN !== undefined && populationN !== null && (!Number.isInteger(populationN) || populationN <= 0)) {
    throw new Error("Tamanho da população (N) deve ser inteiro positivo");
  }
  if (nonResponseRate !== undefined && nonResponseRate !== null && (nonResponseRate < 0 || nonResponseRate >= 1)) {
    throw new Error("Taxa de não-resposta deve estar em [0, 1)");
  }

  const z = getZForConfidence(confidenceLevel);
  const warnings: string[] = [];
  const useT = input.useTDistribution === true;
  const alpha = 1 - confidenceLevel / 100;

  // Semilargura do IC isolada em n a partir de um quantil q (z ou t):
  //   absoluto:  n = (q·σ / E)²
  //   relativo:  n = (q·σ / (ε·μ))²
  const rawFromQuantile = (q: number): number => {
    if (precisionMode === 'absolute') {
      const term = (q * sigmaSD) / marginD;
      return term * term;
    }
    const mu = meanMu as number;
    const absMargin = marginD * Math.abs(mu); // ε·μ → margem na escala da média
    const term = (q * sigmaSD) / absMargin;
    return term * term;
  };

  if (precisionMode === 'relative') {
    const cv = sigmaSD / Math.abs(meanMu as number);
    if (cv > 1) {
      warnings.push("Coeficiente de variação (σ/μ) > 1: a aproximação normal pode ser imprecisa para margem relativa.");
    }
  }

  // Valor base com o quantil normal z (sempre calculado, serve de chute inicial
  // para o refinamento iterativo e de referência no resultado).
  const zRaw = rawFromQuantile(z);
  const zN0 = Math.ceil(zRaw);

  let n0Raw = zRaw;
  let n0: number;
  let n0Formula: string;
  let tRefinement: TRefinementInfo | null = null;

  if (useT) {
    // Refinamento com a distribuição t de Student. Em vez de iterar um ponto
    // fixo que pode oscilar por arredondamento, procuramos diretamente o MENOR
    // n inteiro que é suficiente com seus próprios graus de liberdade: aquele
    // em que o n requerido por (t·σ/E)² — com df = n−1 e t = t_{1−α/2, df} —
    // não excede o próprio n.
    //
    // Como t > z, o ponto de partida é o n baseado em z; como t decresce
    // quando os g.l. aumentam, o requisito diminui à medida que n cresce, o que
    // garante terminação. Essa formulação é sempre conservadora e coerente: na
    // saída vale n₀ = dfUsed + 1 e tUsed = t_{1−α/2, dfUsed}, sem inconsistência
    // entre n₀, dfUsed e tUsed.
    const maxIter = 10000;
    let nSol = Math.max(2, zN0);
    let tUsed = z;
    let tRaw = zRaw;
    let dfUsed = Math.max(1, nSol - 1);
    let iterations = 0;
    let converged = false;

    for (let i = 0; i < maxIter; i++) {
      iterations++;
      dfUsed = Math.max(1, nSol - 1);
      tUsed = getCriticalValue(alpha, dfUsed, 'two');
      tRaw = rawFromQuantile(tUsed);
      if (tRaw <= nSol) {
        // nSol é suficiente com seus próprios g.l. → menor n válido encontrado.
        converged = true;
        break;
      }
      nSol += 1;
    }

    n0Raw = tRaw;
    n0 = nSol;
    tRefinement = { tUsed, dfUsed, iterations, converged };

    if (precisionMode === 'absolute') {
      n0Formula = `n₀ = (t·σ / E)² = (${tUsed.toFixed(4)} × ${sigmaSD} / ${marginD})²  [t com ${dfUsed} g.l., refinamento iterativo]`;
    } else {
      n0Formula = `n₀ = (t·σ / (ε·μ))² = (${tUsed.toFixed(4)} × ${sigmaSD} / (${marginD} × ${meanMu}))²  [t com ${dfUsed} g.l., refinamento iterativo]`;
    }

    if (!converged) {
      warnings.push("O refinamento com a distribuição t não convergiu dentro do limite de iterações; o n₀ pode estar ligeiramente subestimado.");
    } else if (n0 === zN0) {
      warnings.push("Para este tamanho amostral, o refinamento com t coincide com a aproximação normal (z): a diferença é desprezível.");
    }
  } else {
    n0 = Math.ceil(zRaw);
    if (precisionMode === 'absolute') {
      n0Formula = `n₀ = (z·σ / E)² = (${z.toFixed(4)} × ${sigmaSD} / ${marginD})²`;
    } else {
      n0Formula = `n₀ = (z·σ / (ε·μ))² = (${z.toFixed(4)} × ${sigmaSD} / (${marginD} × ${meanMu}))²`;
    }
  }

  let nFinite: number | null = null;
  let nFiniteFormula: string | undefined;
  if (populationN && populationN > 0) {
    const nFiniteRaw = n0Raw / (1 + (n0Raw - 1) / populationN);
    nFinite = Math.ceil(nFiniteRaw);
    nFiniteFormula = `n = n₀ / (1 + (n₀−1)/N) = ${n0} / (1 + ${n0 - 1}/${populationN})`;
    if (populationN > 10000) {
      warnings.push("População > 10.000: correção finita produz efeito < 4% e geralmente pode ser omitida.");
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
      warnings.push("Taxa de não-resposta ≥ 50% praticamente dobra o N.");
    }
  }

  const final = nAdjusted ?? nFinite ?? n0;
  if (final > 100000) {
    warnings.push("Resultado > 100.000 participantes. Revise os parâmetros — pode haver erro nos inputs.");
  }

  return {
    procedureType: 'mean-population',
    input,
    zUsed: z,
    n0,
    nFinite,
    nAdjusted,
    formula: { n0: n0Formula, nFinite: nFiniteFormula, nAdjusted: nAdjustedFormula },
    warnings,
    tRefinement,
  };
}
