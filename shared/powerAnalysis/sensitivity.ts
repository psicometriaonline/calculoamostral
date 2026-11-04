/**
 * Sensitivity analysis (minimum detectable effect)
 *
 * Implements the "Sensibilidade" calculation mode for every power-based test.
 * Given a fixed sample size, the requested power (1 − β) and α, it finds the
 * smallest effect size that the design can detect — the minimum detectable
 * effect (MDE) — in each test's native metric.
 *
 * The MDE is obtained by numerically inverting the EXISTING post-hoc power
 * function of each test via bisection (see `solveEffectForPower`). No new
 * statistical formula or noncentrality parameter is introduced: for every trial
 * effect value the corresponding test function is called in its post-hoc mode
 * (sample size + effect → power) and the search converges on the effect whose
 * power equals the target.
 */

import { PowerAnalysisInput, PowerAnalysisResult } from './types';
import { solveEffectForPower } from './utils';

import {
  calculatePowerOneSampleT,
  calculatePowerPairedT,
  calculatePowerIndependentT,
} from './means/t-tests';
import {
  calculatePowerWilcoxonOneSample,
  calculatePowerMannWhitney,
  calculatePowerWilcoxonPaired,
  calculatePowerKruskalWallis,
  calculatePowerFriedman,
} from './means/nonparametric';
import {
  calculatePowerAnovaOneWay,
  calculatePowerAnovaFactorial,
  calculatePowerAnovaRepeated,
  calculatePowerAnovaMixed,
} from './means/anova';
import {
  calculatePowerManovaOneWay,
  calculatePowerManovaFactorial,
  calculatePowerManovaRepeated,
} from './means/manova';
import {
  calculatePowerPearsonCorrelation,
  calculatePowerSpearmanCorrelation,
  calculatePowerKendallCorrelation,
  calculatePowerCompareCorrelationsIndependent,
  calculatePowerCompareCorrelationsDependent,
  calculatePowerSimpleRegression,
  calculatePowerMultipleRegressionTotal,
  calculatePowerMultipleRegressionIncrement,
  calculatePowerLogisticRegression,
  calculatePowerMultipleLogisticRegression,
  calculatePowerPoissonRegression,
} from './correlations/correlations';
import {
  calculatePowerOneSampleProportion,
  calculatePowerTwoProportions,
  calculatePowerSignTest,
  calculatePowerChiSquare2x2,
  calculatePowerFisherExact,
  calculatePowerMcNemar,
  calculatePowerCochranQ,
  calculatePowerChiSquareIndependence,
  calculatePowerGoodnessOfFit,
} from './proportions/proportions';

export type PowerFn = (input: PowerAnalysisInput) => PowerAnalysisResult;

export const TEST_FN_MAP: Record<string, PowerFn> = {
  'one-sample': calculatePowerOneSampleT,
  'paired': calculatePowerPairedT,
  'independent': calculatePowerIndependentT,
  'wilcoxon-one-sample': calculatePowerWilcoxonOneSample,
  'mann-whitney': calculatePowerMannWhitney,
  'wilcoxon-paired': calculatePowerWilcoxonPaired,
  'kruskal-wallis': calculatePowerKruskalWallis,
  'friedman': calculatePowerFriedman,
  'anova-oneway': calculatePowerAnovaOneWay,
  'anova-factorial': calculatePowerAnovaFactorial,
  'anova-repeated': calculatePowerAnovaRepeated,
  'anova-mixed': calculatePowerAnovaMixed,
  'manova-oneway': calculatePowerManovaOneWay,
  'manova-factorial': calculatePowerManovaFactorial,
  'manova-repeated': calculatePowerManovaRepeated,
  'pearson-correlation': calculatePowerPearsonCorrelation,
  'spearman-correlation': calculatePowerSpearmanCorrelation,
  'kendall-correlation': calculatePowerKendallCorrelation,
  'compare-correlations-independent': calculatePowerCompareCorrelationsIndependent,
  'compare-correlations-dependent': calculatePowerCompareCorrelationsDependent,
  'regression-simple': calculatePowerSimpleRegression,
  'regression-multiple-total': calculatePowerMultipleRegressionTotal,
  'regression-multiple-increment': calculatePowerMultipleRegressionIncrement,
  'logistic-regression': calculatePowerLogisticRegression,
  'multiple-logistic-regression': calculatePowerMultipleLogisticRegression,
  'poisson-regression': calculatePowerPoissonRegression,
  'proportion-one-sample': calculatePowerOneSampleProportion,
  'two-proportions': calculatePowerTwoProportions,
  'sign-test': calculatePowerSignTest,
  'chi-square-2x2': calculatePowerChiSquare2x2,
  'fisher-exact': calculatePowerFisherExact,
  'mcnemar': calculatePowerMcNemar,
  'cochran-q': calculatePowerCochranQ,
  'chi-square-independence': calculatePowerChiSquareIndependence,
  'goodness-of-fit': calculatePowerGoodnessOfFit,
};

/**
 * Which input field carries the effect being solved for and the search bounds.
 * `effectSize` for the vast majority of tests; `r1` for the correlation
 * comparison tests (where r2/r3 are held fixed and r1 is solved).
 */
type SensitivityConfig = {
  field: 'effectSize' | 'r1';
  lo: (input: PowerAnalysisInput) => number;
  hi: (input: PowerAnalysisInput) => number;
  maxHi: (input: PowerAnalysisInput) => number;
};

const CORRELATION_MAX = 0.999999;

// Upper bound for r1 in the DEPENDENT correlation comparison. The three
// correlations form the matrix [1 r1 r2; r1 1 r3; r2 r3 1], whose determinant
// 1 − r1² − r2² − r3² + 2·r1·r2·r3 must stay positive. Solving for the largest
// admissible r1 gives r1 < r2·r3 + √((1−r2²)(1−r3²)). The post-hoc function
// throws (→ power 0) outside this region, so the search must not expand into it.
function dependentCorrMaxR1(input: PowerAnalysisInput): number {
  const r2 = input.r2 ?? 0;
  const r3 = input.r3 ?? 0;
  const boundary = r2 * r3 + Math.sqrt((1 - r2 * r2) * (1 - r3 * r3));
  // Stay strictly inside the positive-definite region and the (−1, 1) range.
  return Math.min(CORRELATION_MAX, boundary - 1e-3);
}

// Correlation coefficient effects are bounded in (-1, 1); solved on the
// positive side starting from 0.
const CORRELATION_CONFIG: SensitivityConfig = {
  field: 'effectSize',
  lo: () => 0,
  hi: () => 0.3,
  maxHi: () => CORRELATION_MAX,
};

// Odds Ratio / Rate Ratio effects: power is monotone in |ln(effect)|, solved on
// the > 1 side (the test functions reject an effect of exactly 1).
const RATIO_CONFIG: SensitivityConfig = {
  field: 'effectSize',
  lo: () => 1 + 1e-6,
  hi: () => 2,
  maxHi: () => 1e6,
};

// Independent correlation comparison: r1 and r2 live in two separate samples,
// so there is no joint positive-definiteness constraint; r1 ranges up to 1.
const COMPARE_CORR_INDEP_CONFIG: SensitivityConfig = {
  field: 'r1',
  lo: (input) => Math.min(CORRELATION_MAX, (input.r2 ?? 0) + 0.001),
  hi: (input) => Math.min(CORRELATION_MAX, (input.r2 ?? 0) + 0.05),
  maxHi: () => CORRELATION_MAX,
};

// Dependent correlation comparison: hold r2 (and r3) fixed and solve r1 just
// above r2, but cap the search at the positive-definiteness boundary so the
// expansion never overshoots into the region where the matrix is invalid.
const COMPARE_CORR_DEP_CONFIG: SensitivityConfig = {
  field: 'r1',
  lo: (input) => Math.min(dependentCorrMaxR1(input), (input.r2 ?? 0) + 0.001),
  hi: (input) => Math.min(dependentCorrMaxR1(input), (input.r2 ?? 0) + 0.05),
  maxHi: dependentCorrMaxR1,
};

// Default: a non-negative effect size (d, f, f², w, h, g, ...) starting from 0.
const DEFAULT_CONFIG: SensitivityConfig = {
  field: 'effectSize',
  lo: () => 0,
  hi: () => 0.5,
  maxHi: () => 1e6,
};

const SENSITIVITY_CONFIG: Record<string, SensitivityConfig> = {
  'pearson-correlation': CORRELATION_CONFIG,
  'spearman-correlation': CORRELATION_CONFIG,
  'kendall-correlation': CORRELATION_CONFIG,
  'logistic-regression': RATIO_CONFIG,
  'multiple-logistic-regression': RATIO_CONFIG,
  'poisson-regression': RATIO_CONFIG,
  'compare-correlations-independent': COMPARE_CORR_INDEP_CONFIG,
  'compare-correlations-dependent': COMPARE_CORR_DEP_CONFIG,
};

/**
 * Compute the minimum detectable effect for the given test by inverting its
 * post-hoc power function. Requires `power` and the sample size(s) to be present
 * in `input` (and, for the comparison tests, r2/r3); the solved effect is
 * returned in `minDetectableEffect`.
 */
export function calculatePowerSensitivity(
  testType: string,
  input: PowerAnalysisInput
): PowerAnalysisResult {
  const fn = TEST_FN_MAP[testType];
  if (!fn) {
    throw new Error('Invalid test type');
  }
  if (input.power === undefined || input.power === null) {
    throw new Error('Power is required for sensitivity analysis');
  }

  const targetPower = input.power;
  const cfg = SENSITIVITY_CONFIG[testType] ?? DEFAULT_CONFIG;

  // Build the post-hoc input: same sample size & fixed parameters, but without
  // `power` (so the underlying test runs in post-hoc mode) and with the solved
  // field replaced on each trial.
  const buildPostHocInput = (value: number): PowerAnalysisInput => ({
    ...input,
    power: undefined,
    [cfg.field]: value,
  });

  const mde = solveEffectForPower(
    (value) => {
      const r = fn(buildPostHocInput(value));
      return r.power ?? 0;
    },
    targetPower,
    {
      lo: cfg.lo(input),
      hi: cfg.hi(input),
      maxHi: cfg.maxHi(input),
    }
  );

  // Re-run the post-hoc computation at the solved effect to obtain the full
  // result metadata (df, critical value, achieved power, etc.).
  const solved = fn(buildPostHocInput(mde));

  return {
    ...solved,
    minDetectableEffect: mde,
  };
}
