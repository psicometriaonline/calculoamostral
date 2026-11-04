/**
 * Power Analysis for MANOVA Tests (multivariate analysis of variance)
 *
 * Implements statistical power calculations using the Pillai-Bartlett trace (V),
 * following the same approach as G*Power:
 * - MANOVA one-way (k independent groups, p response variables)
 * - MANOVA factorial (special effects / interactions: groups, response variables, predictors)
 * - MANOVA repeated measures (multivariate within-subjects approach)
 *
 * The non-centrality parameter is λ = N · s · f²(V), where:
 *   N    = total sample size
 *   s    = min(p, q) (number of nonzero eigenvalues)
 *   f²(V)= multivariate effect size (Pillai), entered directly by the user
 *
 * Degrees of freedom for the approximate F test (Pillai's trace):
 *   s      = min(p, q)
 *   mP     = (|p − q| − 1) / 2
 *   numDf  = s · (2·mP + s + 1)               (= p · q)
 *   dfError= N − k          (k = number of groups / cells in the design)
 *   nP     = (dfError − p − 1) / 2
 *   denDf  = s · (2·nP + s + 1)
 *
 * Pillai's V relates to f²(V) by V = s · f² / (1 + f²).
 *
 * References:
 * - Faul, F., Erdfelder, E., Lang, A.-G., & Buchner, A. (2007). G*Power 3. Behavior
 *   Research Methods, 39, 175-191.
 * - Muller, K. E., & Peterson, B. L. (1984). Practical methods for computing power in
 *   testing the multivariate general linear hypothesis. CSDA, 2, 143-158.
 * - O'Brien, R. G., & Shieh, G. (1992). Pragmatic, unifying algorithm gives power
 *   probabilities for common F tests of the multivariate general linear hypothesis.
 */

import { PowerAnalysisInput, PowerAnalysisResult } from '../types';
import { getFCriticalValue, calculatePowerFromNCPF } from '../utils';

interface ManovaComputation {
  power: number;
  numDf: number;
  denDf: number;
  criticalValue: number;
  lambda: number;
  pillaiV: number;
  s: number;
}

/**
 * Core Pillai-trace power computation for a given total sample size N.
 * p = number of response variables (multivariate dimension)
 * q = hypothesis degrees of freedom (number of predictors for the effect)
 * k = number of groups / cells (drives the error degrees of freedom: N − k)
 * f2 = multivariate effect size f²(V), entered directly
 */
function computeManovaPower(
  N: number,
  p: number,
  q: number,
  k: number,
  f2: number,
  alpha: number
): ManovaComputation {
  const s = Math.min(p, q);
  const mP = (Math.abs(p - q) - 1) / 2;
  const numDf = s * (2 * mP + s + 1);

  const dfError = N - k;
  const nP = (dfError - p - 1) / 2;
  const denDf = s * (2 * nP + s + 1);

  const lambda = N * s * f2;
  const pillaiV = (s * f2) / (1 + f2);

  if (numDf <= 0 || denDf <= 0) {
    return { power: 0, numDf, denDf, criticalValue: NaN, lambda, pillaiV, s };
  }

  const criticalValue = getFCriticalValue(alpha, numDf, denDf);
  const power = calculatePowerFromNCPF(criticalValue, numDf, denDf, lambda);

  return { power, numDf, denDf, criticalValue, lambda, pillaiV, s };
}

/**
 * Find the smallest total sample size N achieving the desired power.
 * Power is monotone increasing in N, so we bracket then binary-search.
 */
function findRequiredNManova(
  p: number,
  q: number,
  k: number,
  f2: number,
  alpha: number,
  power: number
): number {
  // Smallest feasible N so that denDf >= 1 (nP >= 0 => dfError >= p + 1)
  const nMin = k + p + 1;
  let lo = Math.max(nMin, k + 2);

  // Make sure the lower bound is genuinely below the target power
  if (computeManovaPower(lo, p, q, k, f2, alpha).power >= power) {
    return lo;
  }

  // Exponentially grow the upper bound until power is reached (cap to avoid runaway)
  let hi = lo * 2;
  let guard = 0;
  const CAP = 10_000_000;
  while (computeManovaPower(hi, p, q, k, f2, alpha).power < power && hi < CAP) {
    hi *= 2;
    guard++;
    if (guard > 60) break;
  }
  if (hi > CAP) hi = CAP;

  // Binary search for the smallest N with power >= target
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (computeManovaPower(mid, p, q, k, f2, alpha).power >= power) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}

/**
 * Shared driver for between-subjects MANOVA (one-way and factorial).
 */
function runManova(
  input: PowerAnalysisInput,
  p: number,
  q: number,
  k: number,
  testType: string,
  extra: Partial<PowerAnalysisResult>
): PowerAnalysisResult {
  const { alpha, power, effectSize, n } = input;

  if (effectSize === undefined || effectSize === null) {
    throw new Error('Effect size f²(V) is required');
  }
  if (effectSize <= 0) {
    throw new Error('Effect size f²(V) must be greater than 0');
  }
  if (p < 2) {
    throw new Error('Number of response variables must be at least 2');
  }
  if (q < 1) {
    throw new Error('Number of predictors (hypothesis df) must be at least 1');
  }

  // A priori: calculate required N given power
  if (power && !n) {
    const requiredN = findRequiredNManova(p, q, k, effectSize, alpha, power);
    const comp = computeManovaPower(requiredN, p, q, k, effectSize, alpha);
    return {
      requiredN,
      effectSize,
      alpha,
      df: comp.numDf,
      df2: comp.denDf,
      criticalValue: comp.criticalValue,
      testType,
      pillaiV: comp.pillaiV,
      ...extra,
    };
  }
  // Post-hoc: calculate power given total sample size
  else if (n && !power) {
    const comp = computeManovaPower(n, p, q, k, effectSize, alpha);
    return {
      power: comp.power,
      effectSize,
      alpha,
      df: comp.numDf,
      df2: comp.denDf,
      criticalValue: comp.criticalValue,
      testType,
      pillaiV: comp.pillaiV,
      ...extra,
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * Calculate power for ONE-WAY MANOVA.
 * Tests whether the mean vectors of k independent groups differ across p response variables.
 * Effect size: f²(V) (Pillai), entered directly. Hypothesis df q = k − 1.
 */
export function calculatePowerManovaOneWay(input: PowerAnalysisInput): PowerAnalysisResult {
  const p = input.numResponseVars || 2;
  const k = input.k || 3;

  if (k < 2) {
    throw new Error('Number of groups (k) must be at least 2');
  }

  const q = k - 1; // hypothesis df for one-way design

  return runManova(input, p, q, k, 'manova-oneway', {
    k,
    numResponseVars: p,
    effectLabel: 'MANOVA one-way (traço de Pillai)',
  });
}

/**
 * Calculate power for FACTORIAL MANOVA (special effects and interactions).
 * The user specifies response variables (p), number of groups/cells (k) and the
 * number of predictors of the tested effect (q = hypothesis df).
 * Effect size: f²(V) (Pillai), entered directly.
 */
export function calculatePowerManovaFactorial(input: PowerAnalysisInput): PowerAnalysisResult {
  const p = input.numResponseVars || 2;
  const k = input.k || 4;
  const q = input.numPredictors || 1;

  if (k < 2) {
    throw new Error('Number of groups (k) must be at least 2');
  }
  if (k - 1 < q) {
    throw new Error('Number of predictors cannot exceed (number of groups − 1)');
  }

  return runManova(input, p, q, k, 'manova-factorial', {
    k,
    numResponseVars: p,
    numPredictors: q,
    effectLabel: 'MANOVA fatorial (traço de Pillai)',
  });
}

/**
 * Calculate power for REPEATED-MEASURES MANOVA (multivariate within-subjects).
 *
 * Uses the multivariate (profile-analysis / Hotelling) approach: the m repeated
 * measurements are transformed to (m − 1) difference variables and the within-subjects
 * main effect is tested as a single multivariate hypothesis. This requires NO sphericity
 * assumption. Here the multivariate dimension is p = m − 1, the hypothesis df is q = 1,
 * and the error df uses the number of between-subjects groups g (g = 1 for a single group).
 *
 * The covariance structure among the repeated measurements is encoded directly in the
 * effect size f²(V) supplied by the user (as in G*Power's MANOVA repeated module),
 * so neither ρ nor an epsilon correction is needed.
 *
 * References:
 * - O'Brien & Shieh (1992); Vonesh, E. F. (1983), Biometrika 70.
 */
export function calculatePowerManovaRepeated(input: PowerAnalysisInput): PowerAnalysisResult {
  const m = input.numMeasurements || 3;
  const g = input.numGroups || 1;

  if (m < 2) {
    throw new Error('Number of measurements must be at least 2');
  }
  if (g < 1) {
    throw new Error('Number of groups must be at least 1');
  }

  const p = m - 1; // multivariate dimension (within-subjects contrasts)
  const q = 1; // single within-subjects main effect tested multivariately
  const k = g; // error df uses N − g

  // p may legitimately be 1 when m = 2 (single contrast => univariate paired test),
  // so relax the >= 2 guard for the repeated case by routing through computeManovaPower.
  const { alpha, power, effectSize, n } = input;

  if (effectSize === undefined || effectSize === null) {
    throw new Error('Effect size f²(V) is required');
  }
  if (effectSize <= 0) {
    throw new Error('Effect size f²(V) must be greater than 0');
  }

  const extra: Partial<PowerAnalysisResult> = {
    numMeasurements: m,
    numGroups: g,
    effectLabel: 'MANOVA de medidas repetidas (traço de Pillai)',
  };

  if (power && !n) {
    const requiredN = findRequiredNManova(p, q, k, effectSize, alpha, power);
    const comp = computeManovaPower(requiredN, p, q, k, effectSize, alpha);
    return {
      requiredN,
      effectSize,
      alpha,
      df: comp.numDf,
      df2: comp.denDf,
      criticalValue: comp.criticalValue,
      testType: 'manova-repeated',
      pillaiV: comp.pillaiV,
      ...extra,
    };
  } else if (n && !power) {
    const comp = computeManovaPower(n, p, q, k, effectSize, alpha);
    return {
      power: comp.power,
      effectSize,
      alpha,
      df: comp.numDf,
      df2: comp.denDf,
      criticalValue: comp.criticalValue,
      testType: 'manova-repeated',
      pillaiV: comp.pillaiV,
      ...extra,
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}
