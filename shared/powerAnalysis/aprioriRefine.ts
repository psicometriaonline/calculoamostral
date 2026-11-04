/**
 * A-priori sample size = the smallest N whose post-hoc power reaches the target.
 *
 * This is how G*Power defines the a-priori result, and it is what makes the
 * reported N, the reported ("actual") power and the power curve agree. Several
 * engines compute the a-priori N with their own closed-form or iterative
 * search, which can disagree with the test's own post-hoc function: off by one
 * (e.g. χ² 2×2: N = 87 with power 0.7991 < 0.80), not minimal, a fixed
 * iteration cap (repeated-measures ANOVA stopped at N = 110), or a wrong
 * allocation-ratio formula (independent t with n₁/n₂ ≠ 1).
 *
 * `refineAPriori` keeps the engine's result as the starting point and moves N
 * to the minimal integer value under the test's post-hoc power function
 * (TEST_FN_MAP), then takes df / critical value / noncentrality from that
 * post-hoc evaluation. No statistical formula is changed: the post-hoc
 * functions are the same ones used by the "Calcular poder" mode.
 */

import { PowerAnalysisInput, PowerAnalysisResult } from './types';
import { TEST_FN_MAP } from './sensitivity';

const TWO_GROUP = new Set(['independent', 'mann-whitney']);
const N_CAP = 5_000_000;

export function refineAPriori(
  testType: string,
  input: PowerAnalysisInput,
  result: PowerAnalysisResult,
): PowerAnalysisResult {
  const fn = TEST_FN_MAP[testType];
  const target = input.power;
  if (!fn || target == null || result.minDetectableEffect !== undefined) return result;

  const twoGroup = TWO_GROUP.has(testType) && result.requiredN1 !== undefined;
  const ref = twoGroup ? result.requiredN1 : result.requiredN;
  if (ref === undefined || !Number.isFinite(ref)) return result;

  const base: any = { ...input, power: undefined };
  // Independent correlation comparison: a-priori N is per group, post-hoc reads n1 = n2.
  const equalPairs = testType === 'compare-correlations-independent';
  if (equalPairs) { delete base.n1; delete base.n2; delete base.n; }
  let n2For = (x: number) => x;
  if (twoGroup) {
    const ratio = input.n1 && input.n1 > 0 ? input.n1 : 1;
    delete base.n1;
    delete base.n;
    n2For = ratio === 1 ? (x) => x : (x) => Math.max(2, Math.ceil(x / ratio - 1e-9));
  }
  // Mixed ANOVA: N total is a multiple of the number of groups.
  const unit = testType === 'anova-mixed' ? Math.max(1, input.numGroups ?? 1) : 1;

  const evalAt = (x: number): PowerAnalysisResult | null => {
    try {
      const r = twoGroup || equalPairs ? fn({ ...base, n1: x, n2: n2For(x) }) : fn({ ...base, n: x });
      return typeof r.power === 'number' && Number.isFinite(r.power) ? r : null;
    } catch {
      return null;
    }
  };
  const powerAt = (x: number) => evalAt(x)?.power ?? null;

  // Work on multiples of `unit`.
  const toX = (j: number) => j * unit;
  let j = Math.max(1, Math.round(ref / unit));
  const pRef = powerAt(toX(j));
  if (pRef === null) return result; // the post-hoc function cannot evaluate this N: keep engine result

  let lo: number; // power(lo) < target (or invalid)
  let hi: number; // power(hi) >= target
  if (pRef >= target) {
    hi = j;
    let step = 1;
    lo = j - 1;
    while (lo >= 1) {
      const p = powerAt(toX(lo));
      if (p === null || p < target) break;
      hi = lo;
      step *= 2;
      lo = hi - step;
    }
    if (lo < 1) lo = 0;
  } else {
    lo = j;
    let step = 1;
    hi = j + 1;
    for (;;) {
      const p = powerAt(toX(hi));
      if (p !== null && p >= target) break;
      lo = hi;
      step *= 2;
      hi = lo + step;
      if (toX(hi) > N_CAP) return result;
    }
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const p = mid >= 1 ? powerAt(toX(mid)) : null;
    if (p !== null && p >= target) hi = mid; else lo = mid;
  }

  const N = toX(hi);
  const ph = evalAt(N);
  if (!ph) return result;

  const out: PowerAnalysisResult = { ...result, actualPower: ph.power };
  if (N !== ref) {
    out.df = ph.df;
    if (ph.df2 !== undefined) out.df2 = ph.df2;
    out.criticalValue = ph.criticalValue;
    if (ph.ncp !== undefined) out.ncp = ph.ncp;
    if (twoGroup) {
      out.requiredN1 = N;
      out.requiredN2 = n2For(N);
    } else {
      out.requiredN = N;
      if (result.totalN !== undefined && result.k) out.totalN = N * result.k;
      if (result.nPerGroup !== undefined && unit > 1) out.nPerGroup = N / unit;
    }
  }
  delete (out as any).power;
  return out;
}
