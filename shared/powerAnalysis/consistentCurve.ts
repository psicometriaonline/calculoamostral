/**
 * Power curves that are, by construction, consistent with the reported result.
 *
 * Every point is produced by the SAME post-hoc power function that the
 * calculator uses for the test (TEST_FN_MAP), fed with the SAME input that was
 * sent to the calculation, varying only the sample size (power vs N) or the
 * effect (power vs effect, sensitivity mode). The X range is derived from the
 * reported value, so large sample sizes are always inside the plot, and the
 * reported point itself is always one of the plotted points.
 *
 * Unit of the X axis (power vs N): the same sample-size field the test reads in
 * its post-hoc mode — `n` for most tests, `n1` (group 1) for the two-group
 * tests. The reported value is `requiredN1` (two-group) or `requiredN`.
 */

import { PowerAnalysisInput, PowerAnalysisResult } from './types';
import { TEST_FN_MAP } from './sensitivity';

export type CurveMode = 'calculate-n' | 'have-n-power' | 'have-n-effect';

export interface ConsistentCurveRequest {
  testType: string;
  mode: CurveMode;
  /** Exact body sent to /calculate, without testType. */
  input: PowerAnalysisInput & Record<string, any>;
  /** Result returned by /calculate. */
  result: PowerAnalysisResult;
}

export interface ConsistentCurveResponse {
  xKey: 'n' | 'effectSize';
  points: Array<{ n?: number; effectSize?: number; power: number }>;
  /** X of the reported point (N or minimum detectable effect). */
  refX: number;
  /** Power at refX computed by the same function. */
  refPower: number;
  /** Target power (a-priori / sensitivity). */
  targetPower?: number;
  /** For two-group tests: how n2 follows n1 along the curve. */
  groupRule?: string;
}

const TWO_GROUP_N1N2 = new Set(['independent', 'mann-whitney', 'compare-correlations-independent']);
const COMPARE_CORR = new Set(['compare-correlations-independent', 'compare-correlations-dependent']);
const RATIO_TESTS = new Set(['logistic-regression', 'multiple-logistic-regression', 'poisson-regression']);
const N_POINTS = 80;
const N_CAP = 2_000_000;

function powerOf(fn: (i: PowerAnalysisInput) => PowerAnalysisResult, input: PowerAnalysisInput): number | null {
  try {
    const r = fn(input);
    const p = r.power;
    return typeof p === 'number' && Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : null;
  } catch {
    return null;
  }
}

function uniqSorted(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

export function generateConsistentCurve(req: ConsistentCurveRequest): ConsistentCurveResponse {
  const fn = TEST_FN_MAP[req.testType];
  if (!fn) throw new Error('Invalid test type');
  const { mode, result } = req;
  const input = { ...req.input };

  // ---------------- Sensitivity: power vs effect at the fixed N ----------------
  if (mode === 'have-n-effect') {
    const mde = result.minDetectableEffect;
    if (mde === undefined || !Number.isFinite(mde)) throw new Error('Effect size is required');
    const target = input.power;
    const base: any = { ...input, power: undefined };
    const field = COMPARE_CORR.has(req.testType) ? 'r1' : 'effectSize';
    const baseline = field === 'r1' ? (input.r2 ?? 0) : RATIO_TESTS.has(req.testType) ? 1 : 0;
    let lo = baseline;
    let hi = baseline + 2 * (mde - baseline);
    if (hi < lo) [lo, hi] = [hi, lo];
    if (field === 'r1') { lo = Math.max(lo, -0.999); hi = Math.min(hi, 0.999); }
    if (hi - lo < 1e-9) hi = lo + 0.1;
    const xs: number[] = [];
    for (let i = 1; i <= N_POINTS; i++) xs.push(lo + ((hi - lo) * i) / N_POINTS);
    xs.push(mde);
    const points: Array<{ effectSize: number; power: number }> = [];
    for (const x of uniqSorted(xs)) {
      const p = powerOf(fn, { ...base, [field]: x });
      if (p !== null) points.push({ effectSize: x, power: p });
    }
    const refPower = powerOf(fn, { ...base, [field]: mde }) ?? (target ?? 0);
    return { xKey: 'effectSize', points, refX: mde, refPower, targetPower: target };
  }

  // ---------------- Power vs N (a priori / post-hoc) ----------------
  const twoGroup = TWO_GROUP_N1N2.has(req.testType);
  let refX: number;
  let n2For: (n1: number) => number = (x) => x;
  let groupRule: string | undefined;
  const base: any = { ...input, power: undefined };

  if (mode === 'calculate-n') {
    const ref = twoGroup ? (result.requiredN1 ?? result.requiredN) : (result.requiredN ?? result.requiredN1);
    if (ref === undefined || !Number.isFinite(ref)) throw new Error('Sample size must be positive');
    refX = ref;
    if (twoGroup) {
      const reportedN2 = result.requiredN2 ?? ref;
      // In the a-priori payload n1 carries the allocation ratio r = n1/n2.
      const ratio = input.n1 && input.n1 > 0 ? input.n1 : 1;
      delete base.n1;
      delete base.n;
      if (reportedN2 === ref) {
        n2For = (x) => x;
        groupRule = 'n₂ = n₁';
      } else {
        n2For = (x) => Math.max(2, Math.ceil(x / ratio - 1e-9));
        groupRule = `n₂ = ⌈n₁ / ${ratio}⌉`;
      }
    }
  } else {
    if (twoGroup) {
      const n1 = input.n1, n2 = input.n2;
      if (!n1 || !n2) throw new Error('Sample size must be positive');
      refX = n1;
      const q = n2 / n1;
      n2For = (x) => (x === n1 ? n2 : Math.max(2, Math.round(x * q)));
      groupRule = q === 1 ? 'n₂ = n₁' : `n₂ ≈ n₁ × ${Number(q.toFixed(4))}`;
    } else {
      if (!input.n) throw new Error('Sample size must be positive');
      refX = input.n;
    }
  }

  const at = (x: number) =>
    twoGroup
      ? powerOf(fn, { ...base, n1: x, n2: n2For(x) })
      : powerOf(fn, { ...base, n: x });

  // Smallest N the test accepts (scan upward; tests reject N below their df floor).
  let nMin = 2;
  while (nMin < refX && at(nMin) === null) nMin++;
  if (req.testType === 'anova-mixed') { const g = Math.max(1, input.numGroups ?? 1); nMin = Math.ceil(nMin / g) * g; }

  const xMax = Math.min(N_CAP, Math.max(refX * 2, refX + 10, 20));
  // Mixed ANOVA: N total is a multiple of the number of groups.
  const unit = req.testType === 'anova-mixed' ? Math.max(1, input.numGroups ?? 1) : 1;
  const snap = (x: number) => Math.max(unit, Math.round(x / unit) * unit);
  const xs: number[] = [];
  const span = xMax - nMin;
  const steps = Math.min(N_POINTS, Math.max(1, Math.floor(span / unit)));
  for (let i = 0; i <= steps; i++) xs.push(snap(nMin + (span * i) / steps));
  xs.push(refX);
  if (refX - unit >= nMin) xs.push(refX - unit);

  const points: Array<{ n: number; power: number }> = [];
  for (const x of uniqSorted(xs)) {
    const p = at(x);
    if (p !== null) points.push({ n: x, power: p });
  }
  const refPower = at(refX) ?? (result.power ?? result.actualPower ?? 0);
  return {
    xKey: 'n',
    points,
    refX,
    refPower,
    targetPower: mode === 'calculate-n' ? input.power : undefined,
    groupRule,
  };
}
