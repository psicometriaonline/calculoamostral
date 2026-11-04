import type { PrecisionInput, PrecisionResult } from "../types";

const Z_TABLE: Record<number, number> = {
  80: 1.2816,
  85: 1.4395,
  90: 1.6449,
  95: 1.96,
  98: 2.3263,
  99: 2.5758,
};

function approxNormalQuantile(p: number): number {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969,
             138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887,
             66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184,
             -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143,
             3.75440866190742];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5; r = q*q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

export function getZForConfidence(confidenceLevel: number): number {
  if (Number.isInteger(confidenceLevel) && Z_TABLE[confidenceLevel] !== undefined) {
    return Z_TABLE[confidenceLevel];
  }
  const alpha = 1 - confidenceLevel / 100;
  return approxNormalQuantile(1 - alpha / 2);
}

export function calculateSampleSizePrevalence(input: PrecisionInput): PrecisionResult {
  const { prevalenceP, marginD, confidenceLevel, precisionMode, populationN, nonResponseRate } = input;

  if (prevalenceP === undefined || prevalenceP === null) {
    throw new Error("Prevalência P é obrigatória");
  }
  if (prevalenceP <= 0 || prevalenceP >= 1) {
    throw new Error("Prevalência P deve estar entre 0 e 1 (exclusive)");
  }
  if (marginD <= 0) {
    throw new Error("Margem de erro deve ser maior que zero");
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

  let n0Raw: number;
  let n0Formula: string;
  if (precisionMode === 'absolute') {
    n0Raw = (z * z * prevalenceP * (1 - prevalenceP)) / (marginD * marginD);
    n0Formula = `n₀ = z²·P·(1−P) / d² = ${z.toFixed(4)}² × ${prevalenceP} × ${(1 - prevalenceP).toFixed(4)} / ${marginD}²`;
  } else {
    if (prevalenceP > 0.5) {
      warnings.push("Modo relativo com P > 0,5 tende a inflar n. Considere usar precisão absoluta.");
    }
    n0Raw = (z * z * (1 - prevalenceP)) / (marginD * marginD * prevalenceP);
    n0Formula = `n₀ = z²·(1−P) / (d_rel²·P) = ${z.toFixed(4)}² × ${(1 - prevalenceP).toFixed(4)} / (${marginD}² × ${prevalenceP})`;
  }
  const n0 = Math.ceil(n0Raw);

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

  // Regra de eventos mínimos (proporções baixas / eventos raros). Quando P é
  // pequeno (ou simetricamente próximo de 1), a aproximação normal (Wald) só é
  // aceitável com n·P ≥ 5 (idealmente ≥ 10) eventos esperados em cada cauda.
  // Com margem ABSOLUTA e P baixo, o n cai artificialmente (P·(1−P) colapsa) e
  // o resultado é enganoso. Avisamos e orientamos para margem relativa ou
  // planejamento por número de eventos.
  const pMin = Math.min(prevalenceP, 1 - prevalenceP);
  const expectedEvents = final * pMin;
  if (expectedEvents < 10) {
    const eventsStr = expectedEvents < 1 ? expectedEvents.toFixed(2) : expectedEvents.toFixed(1);
    const gravidade = expectedEvents < 5
      ? `n·P ≈ ${eventsStr} eventos esperados (abaixo do mínimo de 5)`
      : `n·P ≈ ${eventsStr} eventos esperados (abaixo do ideal de 10)`;
    if (precisionMode === 'absolute') {
      const m20 = Math.ceil((z / 0.20) * (z / 0.20));
      warnings.push(
        `Proporção baixa com margem absoluta: o n = ${final} produz ${gravidade}. ` +
        `Nesse regime a margem absoluta gera um n pequeno e enganoso (quase nenhum evento observado) e o intervalo normal (Wald) subcobre o valor verdadeiro. ` +
        `Prefira a margem RELATIVA (ex.: ± 20% do próprio P) ou planeje pelo número de eventos: m = (z/ε)², n = m/P — com precisão relativa ε = 20% seriam m ≈ ${m20} eventos (n ≈ ${Math.ceil(m20 / prevalenceP)}). ` +
        `Relate o intervalo por Wilson ou Clopper-Pearson, não por Wald.`
      );
    } else {
      warnings.push(
        `Proporção baixa: o n = ${final} produz ${gravidade}. ` +
        `Garanta pelo menos ~5 (idealmente 10) eventos esperados, ou seja, n ≥ 5/P. ` +
        `Relate o intervalo por Wilson ou Clopper-Pearson, não por Wald.`
      );
    }
  }

  return {
    procedureType: 'prevalence-cochran',
    input,
    zUsed: z,
    n0,
    nFinite,
    nAdjusted,
    formula: { n0: n0Formula, nFinite: nFiniteFormula, nAdjusted: nAdjustedFormula },
    warnings,
  };
}
