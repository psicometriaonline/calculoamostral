/**
 * Generic power-curve generators for the "advanced" tests.
 *
 * Several test families (comparison of correlations, multiple/logistic/Poisson
 * regression, repeated-measures & mixed ANOVA, MANOVA) historically had no power
 * curve in the UI. Rather than hand-writing a bespoke curve helper per family,
 * these two generators reuse the SAME post-hoc power functions already used for
 * the calculation itself (via the shared `TEST_FN_MAP`). No statistical formula
 * is reimplemented here: every point is produced by calling the test's own
 * post-hoc function with one input varied (sample size, or the effect field).
 *
 * - `generatePowerCurveByN`: power vs N (used by the a-priori and post-hoc modes).
 * - `generateEffectSizeCurveByEffect`: power vs effect size at a fixed N (used by
 *   the sensitivity / minimum-detectable-effect mode).
 *
 * The varied effect field is `effectSize` for most tests, but `r1` for the
 * correlation-comparison tests (where r2/r3 are held fixed and r1 is the effect).
 * Odds-Ratio / Rate-Ratio tests (logistic/Poisson) vary the ratio on the > 1
 * side, mirroring how the sensitivity solver searches them.
 */

import { PowerAnalysisInput } from './types';
import { TEST_FN_MAP } from './sensitivity';

type EffectField = 'effectSize' | 'r1';

const COMPARE_CORR_TESTS = new Set([
  'compare-correlations-independent',
  'compare-correlations-dependent',
]);

const RATIO_TESTS = new Set([
  'logistic-regression',
  'multiple-logistic-regression',
  'poisson-regression',
]);

function effectFieldFor(testType: string): EffectField {
  return COMPARE_CORR_TESTS.has(testType) ? 'r1' : 'effectSize';
}

/**
 * Power vs sample size. `baseInput` carries the fixed parameters (alpha, tails,
 * effect size, and any test-specific extras such as numPredictors / r2 / r3 /
 * numResponseVars …). Each point sets the single sample-size field `n` and runs
 * the post-hoc power function. Two-group tests that read n1/n2 are NOT handled
 * here — they keep their dedicated helpers.
 */
export function generatePowerCurveByN(
  testType: string,
  baseInput: PowerAnalysisInput,
  maxN: number = 200,
  minN: number = 2
): Array<{ n: number; power: number }> {
  const fn = TEST_FN_MAP[testType];
  if (!fn) return [];

  const points: Array<{ n: number; power: number }> = [];
  const start = Math.max(2, Math.floor(minN));
  const step = Math.max(1, Math.floor(maxN / 60));

  for (let n = start; n <= maxN; n += step) {
    try {
      const result = fn({ ...baseInput, power: undefined, n });
      if (result.power !== undefined && result.power !== null) {
        points.push({ n, power: result.power });
      }
    } catch {
      // Skip configurations the test rejects (e.g. n too small for the df).
      continue;
    }
  }

  return points;
}

/**
 * Power vs effect size at a fixed N. `baseInput` carries the fixed sample size
 * (n, or n1/n2 for two-group comparison tests) and the held-constant parameters
 * (alpha, tails, r2/r3, numPredictors …). The varied field depends on the test:
 * `r1` for correlation comparisons, otherwise `effectSize`. The X value reported
 * under the `effectSize` key is the varied field, so the marker (minimum
 * detectable effect) lines up with the curve in every mode.
 */
export function generateEffectSizeCurveByEffect(
  testType: string,
  baseInput: PowerAnalysisInput,
  maxEffect: number
): Array<{ effectSize: number; power: number }> {
  const fn = TEST_FN_MAP[testType];
  if (!fn) return [];

  const field = effectFieldFor(testType);

  let lo: number;
  let hi: number;
  if (field === 'r1') {
    // Correlations live in (−1, 1); vary r1 from r2 upward, capped below 1.
    const r2 = baseInput.r2 ?? 0;
    lo = r2;
    hi = Math.min(Math.max(maxEffect, r2 + 0.05), 0.999);
  } else if (RATIO_TESTS.has(testType)) {
    // Odds/Rate ratio: an effect of exactly 1 means "no effect"; vary above 1.
    lo = 1;
    hi = Math.max(maxEffect, 1.5);
  } else {
    // Standard non-negative effect size (f², d, w, h, …).
    lo = 0;
    hi = Math.max(maxEffect, 0.1);
  }

  const span = hi - lo;
  if (span <= 0) return [];
  const step = span / 50;

  const points: Array<{ effectSize: number; power: number }> = [];
  for (let v = lo + step; v <= hi + step / 2; v += step) {
    try {
      const result = fn({ ...baseInput, power: undefined, [field]: v });
      if (result.power !== undefined && result.power !== null) {
        points.push({ effectSize: v, power: result.power });
      }
    } catch {
      continue;
    }
  }

  return points;
}
