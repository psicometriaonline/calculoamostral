/**
 * Paridade com G*Power / SciPy e coerência N ↔ poder ↔ curva.
 * Referências numéricas independentes: scipy.stats (t, nct, f, ncf, chi2, norm)
 * e a tela do G*Power 3.1 (Wilcoxon-Mann-Whitney, A priori, d = 0,5).
 * Adicionado em 2026-11-04 junto com as mudanças descritas em CHANGELOG.md.
 */
import { describe, it, expect } from 'vitest';
import {
  normalCDF, normalQuantile, getCriticalValue, getFCriticalValue, getChiSquareCriticalValue,
} from './utils';
import {
  calculatePowerMannWhitney, calculatePowerWilcoxonOneSample, calculatePowerWilcoxonPaired,
  calculatePowerKruskalWallis, calculatePowerFriedman,
} from './means/nonparametric';
import { calculatePowerFisherExact } from './proportions/proportions';
import { TEST_FN_MAP, calculatePowerSensitivity } from './sensitivity';
import { refineAPriori } from './aprioriRefine';
import { generateConsistentCurve } from './consistentCurve';
import type { PowerAnalysisInput } from './types';

const close = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('distribuições (referência SciPy)', () => {
  it('normal', () => {
    close(normalCDF(1.96), 0.9750021048517795, 1e-13);
    close(normalCDF(-5), 2.866515718791939e-7, 1e-15);
    close(normalQuantile(0.975), 1.959963984540054, 1e-9);
  });
  it('t, F, χ² críticos', () => {
    close(getCriticalValue(0.05, 33, 'two'), 2.0345152974493383, 1e-8);
    close(getCriticalValue(0.05, 126, 'two'), 1.9789706019906281, 1e-8);
    close(getCriticalValue(0.05, 10, 'one'), 1.8124611228107335, 1e-8);
    close(getFCriticalValue(0.05, 2, 156), 3.054004173787927, 1e-7);
    close(getFCriticalValue(0.05, 5, 86), 2.32052931423878, 1e-7);
    close(getChiSquareCriticalValue(0.05, 1), 3.841458820694124, 1e-7);
  });
});

describe('não paramétricos — método A.R.E. do G*Power (origem normal)', () => {
  it('Mann-Whitney = tela do G*Power', () => {
    const r = calculatePowerMannWhitney({ alpha: 0.05, power: 0.8, effectSize: 0.5, tails: 'two' });
    expect(r.requiredN1).toBe(67);
    expect(r.requiredN2).toBe(67);
    close(r.df, 125.9606, 5e-5);
    close(r.criticalValue, 1.9789766, 5e-8);
    close(r.ncp!, 2.8279915, 5e-8);
    close(r.actualPower!, 0.8013372, 5e-8);
  });
  it('Mann-Whitney razão n1/n2 = 2', () => {
    const r = calculatePowerMannWhitney({ alpha: 0.05, power: 0.8, effectSize: 0.5, tails: 'two', n1: 2 });
    expect([r.requiredN1, r.requiredN2]).toEqual([100, 50]);
  });
  it('Wilcoxon (1 amostra e pareado)', () => {
    for (const fn of [calculatePowerWilcoxonOneSample, calculatePowerWilcoxonPaired]) {
      const r = fn({ alpha: 0.05, power: 0.8, effectSize: 0.5, tails: 'two' });
      expect(r.requiredN).toBe(35);
      close(r.df, 32.4225, 5e-5);
      close(r.criticalValue, 2.0358928, 5e-7);
    }
  });
  it('Kruskal-Wallis e Friedman', () => {
    const kw = calculatePowerKruskalWallis({ alpha: 0.05, power: 0.8, effectSize: 0.25, k: 3, tails: 'two' });
    expect(kw.requiredN).toBe(55);
    expect(kw.totalN).toBe(165);
    close(kw.df2!, 154.5634, 5e-5);
    close(kw.criticalValue, 3.054553, 5e-6);
    const fr = calculatePowerFriedman({ alpha: 0.05, power: 0.8, effectSize: 0.25, k: 3, tails: 'two' });
    expect(fr.requiredN).toBe(56);
  });
});

describe('Fisher — aproximação normal coerente', () => {
  it('N mínimo, z crítico e post-hoc consistentes', () => {
    for (const w of [0.1, 0.3, 0.5]) {
      const r = calculatePowerFisherExact({ alpha: 0.05, power: 0.8, effectSize: w, tails: 'two' });
      expect(r.approximation).toBe('normal-15pct');
      close(r.criticalValue, 1.959964, 1e-6);
      const at = calculatePowerFisherExact({ alpha: 0.05, n: r.requiredN!, effectSize: w, tails: 'two' }).power!;
      const below = calculatePowerFisherExact({ alpha: 0.05, n: r.requiredN! - 1, effectSize: w, tails: 'two' }).power!;
      expect(at).toBeGreaterThanOrEqual(0.8);
      expect(below).toBeLessThan(0.8);
    }
  });
});

// Entradas de referência por teste (ids do backend).
const EX: Record<string, Partial<PowerAnalysisInput>> = {
  'one-sample': { effectSize: 0.5 }, 'paired': { effectSize: 0.5 }, 'independent': { effectSize: 0.5 },
  'wilcoxon-one-sample': { effectSize: 0.5 }, 'mann-whitney': { effectSize: 0.5 }, 'wilcoxon-paired': { effectSize: 0.5 },
  'kruskal-wallis': { effectSize: 0.25, k: 3 }, 'friedman': { effectSize: 0.25, k: 3 },
  'anova-oneway': { effectSize: 0.25, k: 3 }, 'anova-factorial': { effectSize: 0.25, numGroups: 4, numeratorDf: 1 },
  'anova-repeated': { effectSize: 0.25, numMeasurements: 3, correlationBetweenMeasures: 0.5, sphericityCorrection: 1 },
  'anova-mixed': { effectSize: 0.25, numGroups: 2, numMeasurements: 3, correlationBetweenMeasures: 0.5, sphericityCorrection: 1, effectType: 'within_between' },
  'manova-oneway': { effectSize: 0.0625, numResponseVars: 2, k: 3 },
  'manova-factorial': { effectSize: 0.0625, numResponseVars: 2, k: 3, numPredictors: 2 },
  'manova-repeated': { effectSize: 0.0625, numMeasurements: 3, numGroups: 2 },
  'pearson-correlation': { effectSize: 0.3 }, 'spearman-correlation': { effectSize: 0.3 }, 'kendall-correlation': { effectSize: 0.2 },
  'compare-correlations-independent': { r1: 0.5, r2: 0.3 }, 'compare-correlations-dependent': { r1: 0.5, r2: 0.3, r3: 0.2 },
  'regression-simple': { effectSize: 0.15 }, 'regression-multiple-total': { effectSize: 0.15, numPredictors: 3 },
  'regression-multiple-increment': { effectSize: 0.15, numPredictors: 3, numTestedPredictors: 1 },
  'logistic-regression': { effectSize: 1.5, baseProportion: 0.5, xDistribution: 'normal', xDistMu: 0, xDistSigma: 1 },
  'multiple-logistic-regression': { effectSize: 1.5, baseProportion: 0.5, r2OtherPredictors: 0, xDistribution: 'normal', xDistMu: 0, xDistSigma: 1 },
  'poisson-regression': { effectSize: 1.3, baseRate: 1, r2OtherPredictors: 0, xDistribution: 'normal', xDistMu: 0, xDistSigma: 1 },
  'proportion-one-sample': { effectSize: 0.3 }, 'two-proportions': { effectSize: 0.3 }, 'sign-test': { effectSize: 0.15 },
  'chi-square-2x2': { effectSize: 0.3 }, 'fisher-exact': { effectSize: 0.3 }, 'mcnemar': { effectSize: 0.15 },
  'cochran-q': { effectSize: 0.3, k: 3 }, 'chi-square-independence': { effectSize: 0.3, numRows: 3, numCols: 3 },
  'goodness-of-fit': { effectSize: 0.3, k: 3 },
};
const TWO_GROUP = new Set(['independent', 'mann-whitney', 'compare-correlations-independent']);

describe('a priori refinado = menor N com poder post-hoc ≥ alvo', () => {
  const apriori = (tt: string, extra: Partial<PowerAnalysisInput>) => {
    const input = { alpha: 0.05, tails: 'two' as const, ...extra } as PowerAnalysisInput;
    return refineAPriori(tt, input, TEST_FN_MAP[tt](input));
  };
  it('âncoras do pacote preservadas', () => {
    expect(apriori('one-sample', { effectSize: 0.5, power: 0.8 }).requiredN).toBe(34);
    expect(apriori('regression-multiple-total', { effectSize: 0.15, numPredictors: 5, power: 0.8 }).requiredN).toBe(92);
    expect(apriori('poisson-regression', { effectSize: 1.3, baseRate: 0.85, power: 0.8, r2OtherPredictors: 0, xDistribution: 'normal', xDistMu: 0, xDistSigma: 1 }).requiredN).toBe(130);
    expect(apriori('manova-factorial', { effectSize: 0.0625, power: 0.95, numResponseVars: 2, k: 6, numPredictors: 3 }).requiredN).toBe(171);
    expect(apriori('independent', { effectSize: 0.5, power: 0.8 }).requiredN1).toBe(64);
    expect(apriori('anova-oneway', { effectSize: 0.25, k: 3, power: 0.8 }).requiredN).toBe(53);
  });
  it('correções', () => {
    expect(apriori('chi-square-2x2', { effectSize: 0.3, power: 0.8 }).requiredN).toBe(88);
    expect(apriori('anova-repeated', { effectSize: 0.1, power: 0.95, numMeasurements: 3, correlationBetweenMeasures: 0.5, sphericityCorrection: 1 }).requiredN).toBe(259);
    const ind = apriori('independent', { effectSize: 0.15, power: 0.95, n1: 1.5 });
    expect([ind.requiredN1, ind.requiredN2]).toEqual([1445, 964]);
  });
  it('todos os testes: N mínimo e poder real coerentes', () => {
    for (const [tt, ex] of Object.entries(EX)) {
      for (const power of [0.8, 0.95]) {
        const r = apriori(tt, { ...ex, power });
        const N = TWO_GROUP.has(tt) && r.requiredN1 !== undefined ? r.requiredN1 : r.requiredN!;
        expect(r.actualPower, tt).toBeGreaterThanOrEqual(power);
        const unit = tt === 'anova-mixed' ? 2 : 1;
        const base: any = { alpha: 0.05, tails: 'two', ...ex };
        const prev = TWO_GROUP.has(tt)
          ? TEST_FN_MAP[tt]({ ...base, n1: N - 1, n2: tt === 'compare-correlations-independent' ? N - 1 : r.requiredN2! - (r.requiredN2 === N ? 1 : 0) })
          : (() => { try { return TEST_FN_MAP[tt]({ ...base, n: N - unit }); } catch { return { power: 0 } as any; } })();
        expect(prev.power ?? 0, `${tt} N-1`).toBeLessThan(power + 1e-12);
      }
    }
  });
});

describe('curva consistente com o resultado (3 modos, todos os testes)', () => {
  for (const [tt, ex] of Object.entries(EX)) {
    it(tt, () => {
      const base = { alpha: 0.05, tails: 'two' as const, ...ex } as any;
      // a priori
      const inA = { ...base, power: 0.9 };
      const resA = refineAPriori(tt, inA, TEST_FN_MAP[tt](inA));
      const cA = generateConsistentCurve({ testType: tt, mode: 'calculate-n', input: inA, result: resA });
      const N = TWO_GROUP.has(tt) && resA.requiredN1 !== undefined ? resA.requiredN1 : resA.requiredN!;
      expect(cA.refX).toBe(N);
      close(cA.refPower, resA.actualPower!, 1e-12);
      const xs = cA.points.map((p) => p.n!);
      expect(Math.max(...xs)).toBeGreaterThanOrEqual(N);
      expect(Math.min(...xs)).toBeLessThanOrEqual(N);
      // post-hoc
      const inP = TWO_GROUP.has(tt) ? { ...base, n1: 300, n2: 250 } : { ...base, n: 300 };
      const resP = TEST_FN_MAP[tt](inP);
      const cP = generateConsistentCurve({ testType: tt, mode: 'have-n-power', input: inP, result: resP });
      close(cP.refPower, resP.power!, 1e-12);
      // sensitivity
      const inS: any = { ...inP, power: 0.8 };
      if (tt.startsWith('compare-correlations')) delete inS.r1; else delete inS.effectSize;
      const resS = calculatePowerSensitivity(tt, inS);
      const cS = generateConsistentCurve({ testType: tt, mode: 'have-n-effect', input: inS, result: resS });
      close(cS.refX, resS.minDetectableEffect!, 1e-12);
      close(cS.refPower, 0.8, 2e-3);
    });
  }
});
