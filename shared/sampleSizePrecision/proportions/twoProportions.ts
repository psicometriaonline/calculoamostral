import type { PrecisionInput, PrecisionResult } from "../types";
import { getZForConfidence } from "./cochran";

/**
 * Tamanho amostral para estimar a DIFERENÇA entre as proporções de dois
 * grupos independentes (p₁ − p₂) com margem de erro absoluta E e nível de
 * confiança especificado, assumindo alocação igual (n por grupo) e a
 * aproximação normal (Wald) do intervalo de confiança para a diferença.
 *
 * O intervalo de confiança para a diferença, por aproximação normal, tem
 * semilargura E = z·√(p₁(1−p₁)/n + p₂(1−p₂)/n). Isolando n (por grupo):
 *
 *   n = z²·(p₁(1−p₁) + p₂(1−p₂)) / E²
 *
 * As correções para população finita e por não-resposta seguem a mesma
 * convenção das demais calculadoras por precisão e são aplicadas ao n POR
 * GRUPO (populationN é interpretado como o tamanho da população de cada
 * grupo). O total do estudo é 2·n.
 */
export function calculateSampleSizeTwoProportions(input: PrecisionInput): PrecisionResult {
  const { p1, p2, marginD, confidenceLevel, populationN, nonResponseRate } = input;

  const k = input.allocationRatio ?? 1;
  if (!Number.isFinite(k) || k <= 0) {
    throw new Error("Razão de alocação (k = n₂/n₁) deve ser um número maior que zero");
  }

  if (p1 === undefined || p1 === null) {
    throw new Error("Proporção do grupo 1 (p₁) é obrigatória");
  }
  if (p1 <= 0 || p1 >= 1) {
    throw new Error("Proporção do grupo 1 (p₁) deve estar entre 0 e 1 (exclusive)");
  }
  if (p2 === undefined || p2 === null) {
    throw new Error("Proporção do grupo 2 (p₂) é obrigatória");
  }
  if (p2 <= 0 || p2 >= 1) {
    throw new Error("Proporção do grupo 2 (p₂) deve estar entre 0 e 1 (exclusive)");
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

  const z = getZForConfidence(confidenceLevel);
  const warnings: string[] = [];

  // Com alocação k = n₂/n₁ e n₂ = k·n₁, a semilargura é
  // E = z·√(p₁(1−p₁)/n₁ + p₂(1−p₂)/(k·n₁)). Isolando o n DO GRUPO 1:
  //   n₁ = z²·(p₁(1−p₁) + p₂(1−p₂)/k) / E²
  // Em k = 1 reduz-se à fórmula de alocação igual (varSum = p₁(1−p₁)+p₂(1−p₂)).
  const varG1 = p1 * (1 - p1); // p₁(1−p₁)
  const varG2 = p2 * (1 - p2); // p₂(1−p₂)
  const varEff = varG1 + varG2 / k; // termo efetivo do grupo 1
  const n0Raw = (z * z * varEff) / (marginD * marginD);
  const n0Formula = k === 1
    ? `n = z²·(p₁(1−p₁) + p₂(1−p₂)) / E² = ${z.toFixed(4)}² × (${p1}×${(1 - p1).toFixed(4)} + ${p2}×${(1 - p2).toFixed(4)}) / ${marginD}²`
    : `n₁ = z²·(p₁(1−p₁) + p₂(1−p₂)/k) / E² = ${z.toFixed(4)}² × (${p1}×${(1 - p1).toFixed(4)} + ${p2}×${(1 - p2).toFixed(4)}/${k}) / ${marginD}²`;
  const n0 = Math.ceil(n0Raw);

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

  // Regra de eventos mínimos (proporções baixas / eventos raros). A
  // aproximação normal (Wald) para a diferença só é aceitável quando CADA grupo
  // observa eventos suficientes em ambas as caudas: n·p ≥ 5 (idealmente ≥ 10).
  // Como esta calculadora só tem modo absoluto, ela é especialmente vulnerável:
  // com p₁ ou p₂ baixos, o n cai artificialmente e o resultado é enganoso.
  const events1 = n1 * Math.min(p1, 1 - p1);
  const events2 = n2 * Math.min(p2, 1 - p2);
  const minEvents = Math.min(events1, events2);
  if (minEvents < 10) {
    const eventsStr = minEvents < 1 ? minEvents.toFixed(2) : minEvents.toFixed(1);
    const piso = minEvents < 5 ? "abaixo do mínimo de 5" : "abaixo do ideal de 10";
    warnings.push(
      `Proporção baixa em um dos grupos: o menor número de eventos esperados é ≈ ${eventsStr} (${piso}). ` +
      `Com margem absoluta e p próximo de 0 (ou de 1), o n por grupo fica pequeno e enganoso, e o intervalo normal (Wald) para a diferença subcobre o valor verdadeiro. ` +
      `Planeje pelo número de eventos por grupo (m = (z/ε)², n = m/p) e relate cada proporção por Wilson ou Clopper-Pearson, não por Wald.`
    );
  }

  return {
    procedureType: 'diff-proportions',
    input,
    zUsed: z,
    n0,
    nFinite,
    nAdjusted,
    n1,
    n2,
    formula: { n0: n0Formula, nFinite: nFiniteFormula, nAdjusted: nAdjustedFormula },
    warnings,
  };
}
