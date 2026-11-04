import { describe, it, expect } from 'vitest';
import { calculatePowerSensitivity } from './sensitivity';
import { PowerAnalysisInput } from './types';
import {
  calculatePowerOneSampleT,
  calculatePowerIndependentT,
} from './means/t-tests';
import { calculatePowerAnovaOneWay } from './means/anova';
import {
  calculatePowerPearsonCorrelation,
  calculatePowerCompareCorrelationsIndependent,
  calculatePowerCompareCorrelationsDependent,
  calculatePowerLogisticRegression,
} from './correlations/correlations';
import { calculatePowerOneSampleProportion } from './proportions/proportions';

const ALPHA = 0.05;
const TARGET = 0.8;

/**
 * Assert the post-hoc power achieved at the solved effect reproduces the
 * requested target power. The MDE is found by inverting the post-hoc power
 * function, so re-running that same function at the MDE must return ~target.
 */
const expectPower = (actual: number | undefined, target = TARGET, tol = 2e-3) => {
  expect(actual).toBeDefined();
  expect(Math.abs((actual as number) - target)).toBeLessThan(tol);
};

describe('calculatePowerSensitivity — minimum detectable effect', () => {
  it('t-test (one-sample): MDE reproduces target power', () => {
    const input: PowerAnalysisInput = {
      alpha: ALPHA,
      power: TARGET,
      n: 30,
      tails: 'two',
    };
    const res = calculatePowerSensitivity('one-sample', input);

    expect(res.minDetectableEffect).toBeDefined();
    expect(res.minDetectableEffect!).toBeGreaterThan(0);

    const back = calculatePowerOneSampleT({
      alpha: ALPHA,
      n: 30,
      tails: 'two',
      effectSize: res.minDetectableEffect!,
    });
    expectPower(back.power);
  });

  it('t-test (independent): MDE reproduces target power', () => {
    const input: PowerAnalysisInput = {
      alpha: ALPHA,
      power: TARGET,
      n1: 40,
      n2: 40,
      tails: 'two',
    };
    const res = calculatePowerSensitivity('independent', input);

    expect(res.minDetectableEffect!).toBeGreaterThan(0);

    const back = calculatePowerIndependentT({
      alpha: ALPHA,
      n1: 40,
      n2: 40,
      tails: 'two',
      effectSize: res.minDetectableEffect!,
    });
    expectPower(back.power);
  });

  it('ANOVA (one-way): MDE reproduces target power', () => {
    const input: PowerAnalysisInput = {
      alpha: ALPHA,
      power: TARGET,
      n: 30,
      k: 3,
      tails: 'two',
    };
    const res = calculatePowerSensitivity('anova-oneway', input);

    expect(res.minDetectableEffect!).toBeGreaterThan(0);

    const back = calculatePowerAnovaOneWay({
      alpha: ALPHA,
      n: 30,
      k: 3,
      tails: 'two',
      effectSize: res.minDetectableEffect!,
    });
    expectPower(back.power);
  });

  it('correlation (Pearson): MDE reproduces target power', () => {
    const input: PowerAnalysisInput = {
      alpha: ALPHA,
      power: TARGET,
      n: 40,
      tails: 'two',
    };
    const res = calculatePowerSensitivity('pearson-correlation', input);

    expect(res.minDetectableEffect!).toBeGreaterThan(0);
    expect(res.minDetectableEffect!).toBeLessThan(1);

    const back = calculatePowerPearsonCorrelation({
      alpha: ALPHA,
      n: 40,
      tails: 'two',
      effectSize: res.minDetectableEffect!,
    });
    expectPower(back.power);
  });

  it('proportion (one-sample): MDE reproduces target power', () => {
    const input: PowerAnalysisInput = {
      alpha: ALPHA,
      power: TARGET,
      n: 80,
      tails: 'two',
    };
    const res = calculatePowerSensitivity('proportion-one-sample', input);

    expect(res.minDetectableEffect!).toBeGreaterThan(0);

    const back = calculatePowerOneSampleProportion({
      alpha: ALPHA,
      n: 80,
      tails: 'two',
      effectSize: res.minDetectableEffect!,
    });
    expectPower(back.power);
  });

  it('logistic regression: MDE (odds ratio) reproduces target power', () => {
    const input: PowerAnalysisInput = {
      alpha: ALPHA,
      power: TARGET,
      n: 200,
      baseProportion: 0.2,
      tails: 'two',
    };
    const res = calculatePowerSensitivity('logistic-regression', input);

    // Effect is an odds ratio, solved on the > 1 side.
    expect(res.minDetectableEffect!).toBeGreaterThan(1);

    const back = calculatePowerLogisticRegression({
      alpha: ALPHA,
      n: 200,
      baseProportion: 0.2,
      tails: 'two',
      effectSize: res.minDetectableEffect!,
    });
    expectPower(back.power);
  });

  it('compare correlations (independent): MDE (r1) reproduces target power', () => {
    const input: PowerAnalysisInput = {
      alpha: ALPHA,
      power: TARGET,
      r2: 0.3,
      n1: 100,
      n2: 100,
      tails: 'two',
    };
    const res = calculatePowerSensitivity('compare-correlations-independent', input);

    // r1 is solved just above r2.
    expect(res.minDetectableEffect!).toBeGreaterThan(0.3);
    expect(res.minDetectableEffect!).toBeLessThan(1);

    const back = calculatePowerCompareCorrelationsIndependent({
      alpha: ALPHA,
      n1: 100,
      n2: 100,
      tails: 'two',
      r1: res.minDetectableEffect!,
      r2: 0.3,
    });
    expectPower(back.power);
  });

  it('compare correlations (dependent): MDE (r1) reproduces target power', () => {
    const input: PowerAnalysisInput = {
      alpha: ALPHA,
      power: TARGET,
      r2: 0.3,
      r3: 0.2,
      n: 100,
      tails: 'two',
    };
    const res = calculatePowerSensitivity('compare-correlations-dependent', input);

    expect(res.minDetectableEffect!).toBeGreaterThan(0.3);
    expect(res.minDetectableEffect!).toBeLessThan(1);

    const back = calculatePowerCompareCorrelationsDependent({
      alpha: ALPHA,
      n: 100,
      tails: 'two',
      r1: res.minDetectableEffect!,
      r2: 0.3,
      r3: 0.2,
    });
    expectPower(back.power);
  });

  it('compare correlations (dependent): high fixed r2/r3 respects the positive-definiteness boundary', () => {
    // Edge case that previously failed: with r2=0.5 and r3=0.3 the admissible
    // r1 is capped at the positive-definite boundary (~0.976). The search must
    // succeed by staying inside that region rather than overshooting and erroring.
    const input: PowerAnalysisInput = {
      alpha: ALPHA,
      power: TARGET,
      r2: 0.5,
      r3: 0.3,
      n: 100,
      tails: 'two',
    };

    expect(() =>
      calculatePowerSensitivity('compare-correlations-dependent', input)
    ).not.toThrow();

    const res = calculatePowerSensitivity('compare-correlations-dependent', input);

    // boundary = r2*r3 + sqrt((1-r2²)(1-r3²)) ≈ 0.976
    const boundary = 0.5 * 0.3 + Math.sqrt((1 - 0.25) * (1 - 0.09));
    expect(res.minDetectableEffect!).toBeGreaterThan(0.5);
    expect(res.minDetectableEffect!).toBeLessThan(boundary);

    const back = calculatePowerCompareCorrelationsDependent({
      alpha: ALPHA,
      n: 100,
      tails: 'two',
      r1: res.minDetectableEffect!,
      r2: 0.5,
      r3: 0.3,
    });
    expectPower(back.power);
  });
});
