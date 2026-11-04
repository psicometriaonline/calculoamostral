/**
 * Regression power/sample-size calculators — numerical regression guard.
 *
 * Guards the four regression procedures added to the "Cálculo de poder /
 * tamanho amostral" tool against silent drift:
 *   - regression-multiple-total     (f² total, F non-central)
 *   - regression-multiple-increment (f² increment, F non-central)
 *   - logistic-regression           (odds ratio, Demidenko 2007 + correção de variância, padrão do G*Power 3.1)
 *   - poisson-regression            (rate ratio, Demidenko 2007 + correção de variância, padrão do G*Power 3.1)
 *
 * Reference N values below were verified against scipy / G*Power while the
 * feature was built and are documented in docs/calculadoras-amostrais/.
 * For each procedure we also confirm the calc-N <-> calc-power round-trip:
 * feeding the required N back in must yield power >= the original target.
 *
 * No test framework is wired into this project, so we use plain assertions and
 * a non-zero exit code on failure.
 * Run with: npx tsx server/__tests__/regression-power.test.ts
 */
import {
  calculatePowerMultipleRegressionTotal,
  calculatePowerMultipleRegressionIncrement,
  calculatePowerLogisticRegression,
  calculatePowerMultipleLogisticRegression,
  calculatePowerPoissonRegression,
  calculatePowerManovaOneWay,
  calculatePowerManovaFactorial,
  calculatePowerManovaRepeated,
} from '../shared/powerAnalysis';
import type { PowerAnalysisInput } from '../shared/powerAnalysis';

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ok  — ${name}`);
  } else {
    failed++;
    console.error(`  FAIL — ${name}${detail ? `: ${detail}` : ''}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  check(name, actual === expected, `expected ${expected}, got ${actual}`);
}

function approx(name: string, actual: number, expected: number, tol: number) {
  check(name, Math.abs(actual - expected) <= tol, `expected ${expected} ± ${tol}, got ${actual}`);
}

const ALPHA = 0.05;
const TARGET_POWER = 0.8;

console.log('\nRegression power calculators — reference values + round-trip\n');

// --- 1. Multiple regression: total R² (f²) -------------------------------
{
  const base: PowerAnalysisInput = { alpha: ALPHA, effectSize: 0.15, numPredictors: 5 };

  const sizeRes = calculatePowerMultipleRegressionTotal({ ...base, power: TARGET_POWER });
  eq('multiple-total: testType', sizeRes.testType, 'regression-multiple-total');
  eq('multiple-total: f²=.15 p=5 power=.80 → N', sizeRes.requiredN, 92);
  eq('multiple-total: df1 = p', sizeRes.df, 5);
  eq('multiple-total: df2 = n − p − 1', sizeRes.df2, 92 - 5 - 1);

  const powRes = calculatePowerMultipleRegressionTotal({ ...base, n: sizeRes.requiredN! });
  check(
    'multiple-total: round-trip power at N=92 >= .80',
    (powRes.power ?? 0) >= TARGET_POWER,
    `got power=${powRes.power}`,
  );
  approx('multiple-total: round-trip power ≈ .80', powRes.power!, 0.8, 0.02);
}

// --- 2. Multiple regression: increment of R² (hierarchical) --------------
{
  const base: PowerAnalysisInput = {
    alpha: ALPHA,
    effectSize: 0.15,
    numPredictors: 5,
    numTestedPredictors: 3,
  };

  const sizeRes = calculatePowerMultipleRegressionIncrement({ ...base, power: TARGET_POWER });
  eq('increment: testType', sizeRes.testType, 'regression-multiple-increment');
  eq('increment: f²=.15 p=5 q=3 power=.80 → N', sizeRes.requiredN, 77);
  eq('increment: df1 = q', sizeRes.df, 3);
  eq('increment: df2 = n − p − 1', sizeRes.df2, 77 - 5 - 1);

  const powRes = calculatePowerMultipleRegressionIncrement({ ...base, n: sizeRes.requiredN! });
  check(
    'increment: round-trip power at N=77 >= .80',
    (powRes.power ?? 0) >= TARGET_POWER,
    `got power=${powRes.power}`,
  );
  approx('increment: round-trip power ≈ .80', powRes.power!, 0.8, 0.02);

  // Exact G*Power reference: "Linear multiple regression: Fixed model, R² increase"
  // f²=0.2, α=0.05, power=0.8, q=2 tested, p=5 total → λ=f²·n, N=52, df2=46, F=3.1996.
  const gpRes = calculatePowerMultipleRegressionIncrement({
    alpha: ALPHA,
    effectSize: 0.2,
    numPredictors: 5,
    numTestedPredictors: 2,
    power: TARGET_POWER,
  });
  eq('increment: G*Power f²=.2 p=5 q=2 power=.80 → N=52', gpRes.requiredN, 52);
  eq('increment: G*Power df1 = q = 2', gpRes.df, 2);
  eq('increment: G*Power df2 = n − p − 1 = 46', gpRes.df2, 46);
  approx('increment: G*Power critical F ≈ 3.1996', gpRes.criticalValue!, 3.1996, 0.001);
}

// --- 3. Logistic regression (odds ratio, Demidenko 2007 w/ variance correction) ---
// Default large-sample method in G*Power 3.1 for a standard-normal predictor.
{
  const a: PowerAnalysisInput = { alpha: ALPHA, effectSize: 1.5, baseProportion: 0.5, tails: 'two' };
  const aSize = calculatePowerLogisticRegression({ ...a, power: TARGET_POWER });
  eq('logistic: testType', aSize.testType, 'logistic-regression');
  eq('logistic: OR=1.5 P=.5 power=.80 → N', aSize.requiredN, 208);
  eq('logistic: df = 0', aSize.df, 0);
  const aPow = calculatePowerLogisticRegression({ ...a, n: aSize.requiredN! });
  check(
    'logistic: round-trip power at N=208 >= .80',
    (aPow.power ?? 0) >= TARGET_POWER,
    `got power=${aPow.power}`,
  );

  const b: PowerAnalysisInput = { alpha: ALPHA, effectSize: 2, baseProportion: 0.3, tails: 'two' };
  const bSize = calculatePowerLogisticRegression({ ...b, power: TARGET_POWER });
  eq('logistic: OR=2 P=.3 power=.80 → N', bSize.requiredN, 92);
  const bPow = calculatePowerLogisticRegression({ ...b, n: bSize.requiredN! });
  check(
    'logistic: round-trip power at N=92 >= .80',
    (bPow.power ?? 0) >= TARGET_POWER,
    `got power=${bPow.power}`,
  );

  // --- G*Power parity guards (manual §29, Demidenko w/ variance correction) ---
  // OR=1.3, P=0.5, one-tailed, α=.05, power=.80 → N=372, actual power 0.8005490.
  const g1 = calculatePowerLogisticRegression({
    alpha: ALPHA, effectSize: 1.3, baseProportion: 0.5, tails: 'one', power: TARGET_POWER,
  });
  eq('logistic: G*Power OR=1.3 P=.5 one-tailed power=.80 → N=372', g1.requiredN, 372);
  const g1Pow = calculatePowerLogisticRegression({
    alpha: ALPHA, effectSize: 1.3, baseProportion: 0.5, tails: 'one', n: 372,
  });
  approx('logistic: G*Power OR=1.3 actual power at N=372 ≈ 0.80055', g1Pow.power!, 0.80055, 0.0005);

  // OR=1.5, P=0.5, two-tailed, α=.05, power=.95 → N=337 (manual example).
  const g2 = calculatePowerLogisticRegression({
    alpha: ALPHA, effectSize: 1.5, baseProportion: 0.5, tails: 'two', power: 0.95,
  });
  eq('logistic: G*Power OR=1.5 P=.5 two-tailed power=.95 → N=337', g2.requiredN, 337);
}

// --- 3a-bis. Predictor (X) distribution selector (Demidenko / G*Power) ----
// Normal is the default and MUST reproduce the previous numbers exactly; the
// other distributions are matched against G*Power 3.1 (variance correction).
{
  const base = { alpha: ALPHA, effectSize: 1.5, baseProportion: 0.5, tails: 'two' as const };

  // Explicit normal w/ G*Power defaults (µ=0, σ=1) == implicit default.
  const implicit = calculatePowerLogisticRegression({ ...base, power: 0.95 });
  const explicit = calculatePowerLogisticRegression({
    ...base, power: 0.95, xDistribution: 'normal', xDistMu: 0, xDistSigma: 1,
  });
  eq('xdist: explicit normal(0,1) == default N=337', explicit.requiredN, implicit.requiredN);
  eq('xdist: normal echoes xDistribution', explicit.xDistribution, 'normal');

  // G*Power parity: Binomial (Bernoulli) predictor, π=0.5. Baseline P=0.05 with
  // OR from p1=.05→p2=.10, two-tailed, power=.95 → N=1437 (G*Power manual §29).
  const p1 = 0.05, p2 = 0.10;
  const orBin = (p2 / (1 - p2)) / (p1 / (1 - p1));
  const bin = calculatePowerLogisticRegression({
    alpha: ALPHA, effectSize: orBin, baseProportion: p1, tails: 'two', power: 0.95,
    xDistribution: 'binomial', xDistPi: 0.5,
  });
  eq('xdist: G*Power binomial π=.5 P=.05 OR(.05→.10) power=.95 → N=1437', bin.requiredN, 1437);
  eq('xdist: binomial echoes xDistribution', bin.xDistribution, 'binomial');

  // G*Power parity anchors for the remaining distributions. Same scenario as the
  // Normal N=337 anchor (OR=1.5, P=0.5, two-tailed, power=0.95) with each
  // distribution's G*Power default params. Each N is produced by the Demidenko
  // variance-corrected method with the documented per-distribution a-factor
  // (exponential/poisson a=1, lognormal a=0.75) and is locked as an exact guard.
  // Ordering is physically correct: lognormal (heavy right tail, high-leverage X)
  // needs the fewest subjects, then poisson ≈ normal, then exponential, with the
  // Bernoulli predictor (least informative) needing the most.
  const xdistAnchors: Record<'exponential' | 'lognormal' | 'poisson', number> = {
    exponential: 402,
    lognormal: 214,
    poisson: 367,
  };
  for (const d of ['exponential', 'lognormal', 'poisson'] as const) {
    const r = calculatePowerLogisticRegression({ ...base, power: 0.95, xDistribution: d });
    eq(`xdist: G*Power ${d} OR=1.5 P=.5 power=.95 → N=${xdistAnchors[d]}`, r.requiredN, xdistAnchors[d]);
    eq(`xdist: ${d} echoes xDistribution`, r.xDistribution, d);
    // Round-trip: power at N >= .95 and at N-1 < .95 (N is the minimal sample).
    const at = calculatePowerLogisticRegression({ ...base, n: r.requiredN!, xDistribution: d });
    const below = calculatePowerLogisticRegression({ ...base, n: r.requiredN! - 1, xDistribution: d });
    check(`xdist: ${d} power at N=${r.requiredN} >= .95`, (at.power ?? 0) >= 0.95, `got ${at.power}`);
    check(`xdist: ${d} power at N-1 < .95 (minimal N)`, (below.power ?? 1) < 0.95, `got ${below.power}`);
  }

  // Distribution selector works on the multiple-logistic calculator too.
  const mBin = calculatePowerMultipleLogisticRegression({
    alpha: ALPHA, effectSize: orBin, baseProportion: p1, tails: 'two', power: 0.95,
    r2OtherPredictors: 0, xDistribution: 'binomial', xDistPi: 0.5,
  });
  eq('xdist: multi-logistic binomial R²=0 == single binomial N', mBin.requiredN, bin.requiredN);
}

// --- 3b. Multiple logistic regression (odds ratio + R² of other predictors) ---
// Demidenko (2007) w/ variance correction base + Hsieh (1998) N' = N/(1−R²).
{
  // With R² = 0 it must reduce exactly to single-predictor logistic regression.
  const base = { alpha: ALPHA, effectSize: 1.5, baseProportion: 0.5, tails: 'two' as const };
  const single = calculatePowerLogisticRegression({ ...base, power: 0.95 });
  const multiR0 = calculatePowerMultipleLogisticRegression({ ...base, r2OtherPredictors: 0, power: 0.95 });
  eq('multi-logistic: testType', multiR0.testType, 'multiple-logistic-regression');
  eq('multi-logistic: R²=0 N equals single-predictor N (337)', multiR0.requiredN, single.requiredN);
  eq('multi-logistic: R²=0 N=337', multiR0.requiredN, 337);

  // OR=1.5, P=.5, two-tailed, power=.95, R²=0.1 → N=337/(1−.1)=375 (G*Power Hsieh correction).
  const m = calculatePowerMultipleLogisticRegression({ ...base, r2OtherPredictors: 0.1, power: 0.95 });
  eq('multi-logistic: OR=1.5 P=.5 power=.95 R²=.1 → N=375', m.requiredN, 375);
  eq('multi-logistic: r2OtherPredictors echoed', m.r2OtherPredictors, 0.1);
  const mPow = calculatePowerMultipleLogisticRegression({ ...base, r2OtherPredictors: 0.1, n: m.requiredN! });
  check(
    'multi-logistic: round-trip power at N=375 >= .95',
    (mPow.power ?? 0) >= 0.95,
    `got power=${mPow.power}`,
  );
  // Just below the required N the power must drop under target (self-consistency).
  const mUnder = calculatePowerMultipleLogisticRegression({ ...base, r2OtherPredictors: 0.1, n: m.requiredN! - 1 });
  check(
    'multi-logistic: power at N=374 < .95',
    (mUnder.power ?? 1) < 0.95,
    `got power=${mUnder.power}`,
  );
}

// --- 4. Poisson regression (rate ratio, two-tailed) ----------------------
{
  const a: PowerAnalysisInput = { alpha: ALPHA, effectSize: 1.5, baseRate: 0.85, tails: 'two' };
  const aSize = calculatePowerPoissonRegression({ ...a, power: TARGET_POWER });
  eq('poisson: testType', aSize.testType, 'poisson-regression');
  eq('poisson: RR=1.5 base=.85 power=.80 → N', aSize.requiredN, 52);
  eq('poisson: df = 0', aSize.df, 0);
  const aPow = calculatePowerPoissonRegression({ ...a, n: aSize.requiredN! });
  check(
    'poisson: round-trip power at N=52 >= .80',
    (aPow.power ?? 0) >= TARGET_POWER,
    `got power=${aPow.power}`,
  );

  const b: PowerAnalysisInput = { alpha: ALPHA, effectSize: 2, baseRate: 1, tails: 'two' };
  const bSize = calculatePowerPoissonRegression({ ...b, power: TARGET_POWER });
  eq('poisson: RR=2 base=1 power=.80 → N', bSize.requiredN, 13);
  const bPow = calculatePowerPoissonRegression({ ...b, n: bSize.requiredN! });
  check(
    'poisson: round-trip power at N=13 >= .80',
    (bPow.power ?? 0) >= TARGET_POWER,
    `got power=${bPow.power}`,
  );

  // G*Power 3.1 parity anchor (Demidenko 2007 with var corr, A priori):
  // Two-tailed, Exp(β1)=1.3, α=.05, power=.80, base rate exp(β0)=0.85,
  // mean exposure=1, R² other X=0, X ~ Normal(μ=0, σ=1)
  //   → Critical z=1.9599640, Total N=130, Actual power=0.8011838.
  const gpower: PowerAnalysisInput = {
    alpha: ALPHA, effectSize: 1.3, baseRate: 0.85, tails: 'two',
    r2OtherPredictors: 0, xDistribution: 'normal', xDistMu: 0, xDistSigma: 1,
  };
  const gSize = calculatePowerPoissonRegression({ ...gpower, power: TARGET_POWER });
  eq('poisson G*Power: Exp(β1)=1.3 base=.85 Normal → N', gSize.requiredN, 130);
  approx('poisson G*Power: critical z', gSize.criticalValue, 1.9599640, 1e-5);
  eq('poisson G*Power: xDistribution echoed', gSize.xDistribution, 'normal');
  eq('poisson G*Power: R² echoed', gSize.r2OtherPredictors, 0);
  const gPow = calculatePowerPoissonRegression({ ...gpower, n: 130 });
  approx('poisson G*Power: actual power at N=130', gPow.power ?? 0, 0.8011838, 1e-4);

  // R² of other predictors inflates N by ~1/(1−R²) (Hsieh correction).
  const gR2 = calculatePowerPoissonRegression({ ...gpower, r2OtherPredictors: 0.2, power: TARGET_POWER });
  check(
    'poisson: R²=0.2 needs more subjects than R²=0',
    (gR2.requiredN ?? 0) > (gSize.requiredN ?? 0),
    `R²=0 → ${gSize.requiredN}, R²=0.2 → ${gR2.requiredN}`,
  );

  // Binomial (Bernoulli) predictor is accepted and uses its own variance corr.
  const gBin = calculatePowerPoissonRegression({
    alpha: ALPHA, effectSize: 1.3, baseRate: 0.85, tails: 'two',
    xDistribution: 'binomial', xDistPi: 0.5, power: TARGET_POWER,
  });
  eq('poisson: binomial X → xDistribution echoed', gBin.xDistribution, 'binomial');
  check('poisson: binomial X → finite N', Number.isFinite(gBin.requiredN ?? NaN) && (gBin.requiredN ?? 0) > 0);

  // Poisson-distributed predictor is light-tailed enough → finite N.
  const gPois = calculatePowerPoissonRegression({
    alpha: ALPHA, effectSize: 1.3, baseRate: 0.85, tails: 'two',
    xDistribution: 'poisson', xDistLambda: 1, power: TARGET_POWER,
  });
  eq('poisson: poisson X → xDistribution echoed', gPois.xDistribution, 'poisson');
  check('poisson: poisson X → finite N', Number.isFinite(gPois.requiredN ?? NaN) && (gPois.requiredN ?? 0) > 0);

  // Exponential X with a modest RR (β₁·λ < 1) still converges → finite N.
  const gExp = calculatePowerPoissonRegression({
    alpha: ALPHA, effectSize: 1.3, baseRate: 0.85, tails: 'two',
    xDistribution: 'exponential', xDistLambda: 1, power: TARGET_POWER,
  });
  check('poisson: exponential X (RR=1.3) → finite N', Number.isFinite(gExp.requiredN ?? NaN) && (gExp.requiredN ?? 0) > 0);
}

// --- 5. Validation guards ------------------------------------------------
function throws(name: string, fn: () => unknown) {
  try {
    fn();
    check(name, false, 'expected an error but none was thrown');
  } catch {
    check(name, true);
  }
}

throws('multiple-total: missing predictors throws', () =>
  calculatePowerMultipleRegressionTotal({ alpha: ALPHA, effectSize: 0.15, power: TARGET_POWER }),
);
throws('increment: q > p throws', () =>
  calculatePowerMultipleRegressionIncrement({
    alpha: ALPHA,
    effectSize: 0.15,
    numPredictors: 2,
    numTestedPredictors: 3,
    power: TARGET_POWER,
  }),
);
throws('logistic: OR = 1 throws', () =>
  calculatePowerLogisticRegression({ alpha: ALPHA, effectSize: 1, baseProportion: 0.5, power: TARGET_POWER }),
);
throws('multi-logistic: R² >= 1 throws', () =>
  calculatePowerMultipleLogisticRegression({
    alpha: ALPHA, effectSize: 1.5, baseProportion: 0.5, tails: 'two', r2OtherPredictors: 1, power: TARGET_POWER,
  }),
);
throws('poisson: baseRate <= 0 throws', () =>
  calculatePowerPoissonRegression({ alpha: ALPHA, effectSize: 1.5, baseRate: 0, power: TARGET_POWER }),
);
// Lognormal X makes E[exp(β₀+β₁X)] diverge → controlled error, never NaN.
throws('poisson: lognormal X throws (undefined expected count)', () =>
  calculatePowerPoissonRegression({
    alpha: ALPHA, effectSize: 1.3, baseRate: 0.85, tails: 'two',
    xDistribution: 'lognormal', power: TARGET_POWER,
  }),
);
// Exponential X with a large RR (β₁·λ ≥ 1) also diverges → controlled error.
throws('poisson: exponential X with large RR throws', () =>
  calculatePowerPoissonRegression({
    alpha: ALPHA, effectSize: 4, baseRate: 0.85, tails: 'two',
    xDistribution: 'exponential', xDistLambda: 1, power: TARGET_POWER,
  }),
);
throws('poisson: R² >= 1 throws', () =>
  calculatePowerPoissonRegression({
    alpha: ALPHA, effectSize: 1.3, baseRate: 0.85, r2OtherPredictors: 1, power: TARGET_POWER,
  }),
);
throws('xdist: binomial π out of range throws', () =>
  calculatePowerLogisticRegression({
    alpha: ALPHA, effectSize: 1.5, baseProportion: 0.5, power: TARGET_POWER,
    xDistribution: 'binomial', xDistPi: 1.5,
  }),
);
throws('xdist: exponential λ <= 0 throws', () =>
  calculatePowerLogisticRegression({
    alpha: ALPHA, effectSize: 1.5, baseProportion: 0.5, power: TARGET_POWER,
    xDistribution: 'exponential', xDistLambda: 0,
  }),
);
throws('xdist: normal σ <= 0 throws', () =>
  calculatePowerLogisticRegression({
    alpha: ALPHA, effectSize: 1.5, baseProportion: 0.5, power: TARGET_POWER,
    xDistribution: 'normal', xDistSigma: 0,
  }),
);

// --- MANOVA (Pillai's trace, F approximation) ----------------------------
// Factorial anchor verified against G*Power: p=2, k=6, q=3, f²=0.0625 →
// N=171, numDf=6, denDf=330, λ=21.375, critF=2.126, V=0.1176, power=0.95119.
{
  const anchor: PowerAnalysisInput = {
    alpha: ALPHA,
    effectSize: 0.0625,
    numResponseVars: 2,
    k: 6,
    numPredictors: 3,
  };

  const size = calculatePowerManovaFactorial({ ...anchor, power: 0.95 });
  eq('manova-factorial: testType', size.testType, 'manova-factorial');
  eq('manova-factorial: anchor N=171', size.requiredN, 171);
  eq('manova-factorial: anchor numDf=6', size.df, 6);
  eq('manova-factorial: anchor denDf=330', size.df2, 330);
  approx('manova-factorial: anchor critF≈2.126', size.criticalValue!, 2.126, 0.005);
  approx('manova-factorial: anchor V≈0.1176', size.pillaiV!, 0.1176, 0.0005);

  const pow = calculatePowerManovaFactorial({ ...anchor, n: 171 });
  approx('manova-factorial: anchor power≈0.95119', pow.power!, 0.95119, 0.0005);
  check('manova-factorial: N=170 below target', 
    calculatePowerManovaFactorial({ ...anchor, n: 170 }).power! < 0.95,
    `power(170)=${calculatePowerManovaFactorial({ ...anchor, n: 170 }).power}`);
}

// One-way MANOVA round-trip: p=2, k=3, f²=0.0625 → N=98.
{
  const base: PowerAnalysisInput = { alpha: ALPHA, effectSize: 0.0625, numResponseVars: 2, k: 3 };
  const size = calculatePowerManovaOneWay({ ...base, power: TARGET_POWER });
  eq('manova-oneway: testType', size.testType, 'manova-oneway');
  eq('manova-oneway: N=98', size.requiredN, 98);
  const pow = calculatePowerManovaOneWay({ ...base, n: size.requiredN! });
  check('manova-oneway: round-trip power >= target', pow.power! >= TARGET_POWER, `power=${pow.power}`);
}

// Repeated-measures MANOVA round-trip: m=4 (p=3), g=1, f²=0.0625 → N=179.
{
  const base: PowerAnalysisInput = { alpha: ALPHA, effectSize: 0.0625, numMeasurements: 4, numGroups: 1 };
  const size = calculatePowerManovaRepeated({ ...base, power: TARGET_POWER });
  eq('manova-repeated: testType', size.testType, 'manova-repeated');
  eq('manova-repeated: N=179', size.requiredN, 179);
  const pow = calculatePowerManovaRepeated({ ...base, n: size.requiredN! });
  check('manova-repeated: round-trip power >= target', pow.power! >= TARGET_POWER, `power=${pow.power}`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
}
