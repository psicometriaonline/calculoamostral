/**
 * Power Analysis for Nonparametric Tests (Means category)
 *
 * Implements statistical power calculations for:
 * - Wilcoxon signed-rank test (one-sample)
 * - Mann-Whitney U / Wilcoxon-Mann-Whitney test (independent samples)
 * - Wilcoxon signed-rank test (matched pairs)
 * - Kruskal-Wallis H test
 * - Friedman test
 *
 * Method: the A.R.E. method used by G*Power 3 (Faul et al., 2007; G*Power
 * manual, "Wilcoxon signed-rank test" and "Wilcoxon-Mann-Whitney test").
 * The rank test is evaluated with the noncentral t distribution of the
 * corresponding t test, with the sample size multiplied by the asymptotic
 * relative efficiency k of the parent distribution, in BOTH the noncentrality
 * parameter and the degrees of freedom (which therefore are not integers):
 *
 *   one sample / matched pairs:  δ = d·√(N·k),               df = N·k − 1
 *   two independent groups:      δ = d·√(n₁·n₂·k / (n₁+n₂)), df = (n₁+n₂)·k − 2
 *
 * Parent distribution: Normal, k = 3/π ≈ 0.9549 (G*Power default).
 * Example (G*Power, two-tailed, d = 0.5, α = 0.05, power = 0.80, N2/N1 = 1):
 * n₁ = n₂ = 67, df = 125.9606, t crit = 1.9789766, δ = 2.8279915,
 * actual power = 0.8013372.
 *
 * G*Power has no Kruskal-Wallis or Friedman module. For those two tests the
 * same A.R.E. logic is applied to the noncentral F of the parametric
 * counterpart (effective N = N·k in λ and in the error df).
 */

import { PowerAnalysisInput, PowerAnalysisResult } from '../types';
import {
  getCriticalValue,
  calculatePowerFromNCP,
  getFCriticalValue,
  calculatePowerFromNCPF,
} from '../utils';

/** A.R.E. of rank tests vs t/F tests when the parent distribution is Normal (3/π). */
export const ARE_NORMAL = 3 / Math.PI;
const ARE = ARE_NORMAL;
const PARENT = 'normal';
const N_MAX = 1_000_000;

/** Smallest integer n in [nMin, N_MAX] with powerAt(n) ≥ target (power is monotone in n). */
function findMinN(powerAt: (n: number) => number, target: number, nMin: number): number {
  let lo = nMin;
  if (powerAt(lo) >= target) return lo;
  let hi = Math.max(lo + 1, 4);
  while (powerAt(hi) < target) {
    lo = hi;
    hi *= 2;
    if (hi > N_MAX) throw new Error('Sample size must be positive');
  }
  // invariant: powerAt(lo) < target <= powerAt(hi)
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (powerAt(mid) >= target) hi = mid; else lo = mid;
  }
  return hi;
}

// ---------- Wilcoxon signed-rank (one sample & matched pairs) ----------

function signedRankAt(d: number, n: number, alpha: number, tails: 'one' | 'two') {
  const df = n * ARE - 1;
  const ncp = d * Math.sqrt(n * ARE);
  const criticalValue = getCriticalValue(alpha, df, tails);
  const power = calculatePowerFromNCP(criticalValue, df, ncp, tails);
  return { df, ncp, criticalValue, power };
}

function signedRank(input: PowerAnalysisInput, testType: string): PowerAnalysisResult {
  const { alpha, power, effectSize, n, tails } = input;

  if (!effectSize) {
    throw new Error('Effect size (Cohen\'s d equivalent) is required');
  }
  const d = Math.abs(effectSize);

  if (power && !n) {
    const requiredN = findMinN((m) => signedRankAt(d, m, alpha, tails).power, power, 2);
    const r = signedRankAt(d, requiredN, alpha, tails);
    return {
      requiredN,
      effectSize,
      alpha,
      df: r.df,
      criticalValue: r.criticalValue,
      ncp: r.ncp,
      actualPower: r.power,
      are: ARE,
      parentDistribution: PARENT,
      testType,
    };
  } else if (n && !power) {
    if (n < 2) throw new Error('Sample size must be positive');
    const r = signedRankAt(d, n, alpha, tails);
    return {
      power: r.power,
      effectSize,
      alpha,
      df: r.df,
      criticalValue: r.criticalValue,
      ncp: r.ncp,
      are: ARE,
      parentDistribution: PARENT,
      testType,
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * WILCOXON SIGNED-RANK TEST (one sample) — G*Power A.R.E. method.
 */
export function calculatePowerWilcoxonOneSample(input: PowerAnalysisInput): PowerAnalysisResult {
  return signedRank(input, 'wilcoxon-one-sample');
}

/**
 * WILCOXON SIGNED-RANK TEST (matched pairs) — G*Power A.R.E. method.
 * N = number of pairs.
 */
export function calculatePowerWilcoxonPaired(input: PowerAnalysisInput): PowerAnalysisResult {
  return signedRank(input, 'wilcoxon-paired');
}

// ---------- Wilcoxon-Mann-Whitney (two independent groups) ----------

function wmwAt(d: number, n1: number, n2: number, alpha: number, tails: 'one' | 'two') {
  const N = n1 + n2;
  const df = N * ARE - 2;
  const ncp = d * Math.sqrt((n1 * n2 * ARE) / N);
  const criticalValue = getCriticalValue(alpha, df, tails);
  const power = calculatePowerFromNCP(criticalValue, df, ncp, tails);
  return { df, ncp, criticalValue, power };
}

/**
 * MANN-WHITNEY U / WILCOXON-MANN-WHITNEY TEST — G*Power A.R.E. method.
 * In the a-priori mode `n1` carries the allocation ratio r = n₁/n₂ (app
 * convention, default 1); n₂ = ⌈n₁ / r⌉ for each candidate n₁.
 */
export function calculatePowerMannWhitney(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n1, n2, tails } = input;

  if (!effectSize) {
    throw new Error('Effect size (Cohen\'s d equivalent) is required');
  }
  const d = Math.abs(effectSize);

  if (power && !n2) {
    const ratio = n1 && n1 > 0 ? n1 : 1;
    const group2 = (m: number) => Math.max(2, Math.ceil(m / ratio - 1e-9));
    const requiredN1 = findMinN((m) => wmwAt(d, m, group2(m), alpha, tails).power, power, 2);
    const requiredN2 = group2(requiredN1);
    const r = wmwAt(d, requiredN1, requiredN2, alpha, tails);
    return {
      requiredN1,
      requiredN2,
      effectSize,
      alpha,
      df: r.df,
      criticalValue: r.criticalValue,
      ncp: r.ncp,
      actualPower: r.power,
      are: ARE,
      parentDistribution: PARENT,
      testType: 'mann-whitney',
    };
  } else if (n1 && n2 && !power) {
    if (n1 < 2 || n2 < 2) throw new Error('Sample size must be positive');
    const r = wmwAt(d, n1, n2, alpha, tails);
    return {
      power: r.power,
      effectSize,
      alpha,
      df: r.df,
      criticalValue: r.criticalValue,
      ncp: r.ncp,
      are: ARE,
      parentDistribution: PARENT,
      testType: 'mann-whitney',
    };
  } else {
    throw new Error('Provide either power OR sample sizes (n1, n2), not both');
  }
}

// ---------- Kruskal-Wallis (k independent groups) ----------

function kwAt(f: number, nPerGroup: number, k: number, alpha: number) {
  const nEff = k * nPerGroup * ARE;
  const df1 = k - 1;
  const df2 = nEff - k;
  const lambda = nEff * f * f;
  const criticalValue = getFCriticalValue(alpha, df1, df2);
  const power = calculatePowerFromNCPF(criticalValue, df1, df2, lambda);
  return { df1, df2, lambda, criticalValue, power };
}

/**
 * KRUSKAL-WALLIS H TEST — A.R.E. method applied to the one-way ANOVA:
 * λ = f²·N·k_ARE, df = (k − 1, N·k_ARE − k), N = k·n (equal groups).
 * `requiredN` is the size PER GROUP (as in the one-way ANOVA result).
 */
export function calculatePowerKruskalWallis(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, k } = input;

  if (!effectSize) {
    throw new Error('Effect size (Cohen\'s f) is required');
  }
  if (!k || k < 3) {
    throw new Error('Number of groups (k) must be at least 3');
  }
  const f = Math.abs(effectSize);
  // df2 > 0 requires k·n·ARE > k  →  n > 1/ARE
  const nMin = 2;

  if (power && !n) {
    const requiredN = findMinN((m) => kwAt(f, m, k, alpha).power, power, nMin);
    const r = kwAt(f, requiredN, k, alpha);
    return {
      requiredN,
      totalN: requiredN * k,
      k,
      effectSize: f,
      alpha,
      df: r.df1,
      df2: r.df2,
      criticalValue: r.criticalValue,
      ncp: r.lambda,
      actualPower: r.power,
      are: ARE,
      parentDistribution: PARENT,
      testType: 'kruskal-wallis',
    };
  } else if (n && !power) {
    if (n < nMin) throw new Error('Each group must have at least 2 observations');
    const r = kwAt(f, n, k, alpha);
    return {
      power: r.power,
      k,
      effectSize: f,
      alpha,
      df: r.df1,
      df2: r.df2,
      criticalValue: r.criticalValue,
      ncp: r.lambda,
      are: ARE,
      parentDistribution: PARENT,
      testType: 'kruskal-wallis',
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

// ---------- Friedman (k repeated conditions) ----------

function friedmanAt(f: number, nSubjects: number, k: number, alpha: number) {
  const nEff = nSubjects * ARE;
  const df1 = k - 1;
  const df2 = (nEff - 1) * (k - 1);
  const lambda = nEff * k * f * f;
  const criticalValue = getFCriticalValue(alpha, df1, df2);
  const power = calculatePowerFromNCPF(criticalValue, df1, df2, lambda);
  return { df1, df2, lambda, criticalValue, power };
}

/**
 * FRIEDMAN TEST — A.R.E. method applied to the repeated-measures F:
 * λ = f²·n·k·k_ARE, df = (k − 1, (n·k_ARE − 1)(k − 1)), n = subjects.
 */
export function calculatePowerFriedman(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, k } = input;

  if (!effectSize) {
    throw new Error('Effect size (Cohen\'s f) is required');
  }
  if (!k || k < 3) {
    throw new Error('Number of conditions (k) must be at least 3');
  }
  const f = Math.abs(effectSize);
  const nMin = 2;

  if (power && !n) {
    const requiredN = findMinN((m) => friedmanAt(f, m, k, alpha).power, power, nMin);
    const r = friedmanAt(f, requiredN, k, alpha);
    return {
      requiredN,
      k,
      effectSize: f,
      alpha,
      df: r.df1,
      df2: r.df2,
      criticalValue: r.criticalValue,
      ncp: r.lambda,
      actualPower: r.power,
      are: ARE,
      parentDistribution: PARENT,
      testType: 'friedman',
    };
  } else if (n && !power) {
    if (n < nMin) throw new Error('Sample size must be positive');
    const r = friedmanAt(f, n, k, alpha);
    return {
      power: r.power,
      k,
      effectSize: f,
      alpha,
      df: r.df1,
      df2: r.df2,
      criticalValue: r.criticalValue,
      ncp: r.lambda,
      are: ARE,
      parentDistribution: PARENT,
      testType: 'friedman',
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}
