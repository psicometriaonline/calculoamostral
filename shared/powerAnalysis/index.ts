/**
 * Power Analysis Module - Central Export Point
 * 
 * This module provides statistical power analysis calculations for various tests.
 * Organized by category for easy maintenance and scalability.
 */

// Export types
export type { PowerAnalysisInput, PowerAnalysisResult } from './types';

// Export utility functions (for advanced usage)
export {
  normalCDF,
  normalQuantile,
  noncentralTCDF,
  getCriticalValue,
  calculatePowerFromNCP,
  calculateRequiredNOneSample,
  calculateRequiredNIndependent,
  calculateRequiredN2,
  getFCriticalValue,
  noncentralFCDF,
  calculatePowerFromNCPF,
  solveEffectForPower,
} from './utils';

// Export sensitivity (minimum detectable effect) dispatcher
export { calculatePowerSensitivity } from './sensitivity';

// Export generic power-curve generators (advanced tests)
export {
  generatePowerCurveByN,
  generateEffectSizeCurveByEffect,
} from './curves';

// Export means/t-tests functions
export {
  calculatePowerOneSampleT,
  calculatePowerPairedT,
  calculatePowerIndependentT,
  generatePowerCurveTTests,
  generateEffectSizeCurveTTests,
} from './means/t-tests';

// Export nonparametric means tests
export {
  calculatePowerWilcoxonOneSample,
  calculatePowerMannWhitney,
  calculatePowerWilcoxonPaired,
  calculatePowerKruskalWallis,
  calculatePowerFriedman,
} from './means/nonparametric';

// Export ANOVA functions
export {
  calculatePowerAnovaOneWay,
  calculatePowerAnovaFactorial,
  calculatePowerAnovaRepeated,
  calculatePowerAnovaMixed,
  generatePowerCurveAnova,
  generateEffectSizeCurveAnova,
} from './means/anova';

// Export MANOVA functions
export {
  calculatePowerManovaOneWay,
  calculatePowerManovaFactorial,
  calculatePowerManovaRepeated,
} from './means/manova';

// Export correlation functions
export {
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
  generatePowerCurveCorrelations,
  generateEffectSizeCurveCorrelations,
} from './correlations/correlations';

// Export proportion functions
export {
  cohensH,
  calculatePowerOneSampleProportion,
  calculatePowerTwoProportions,
  calculatePowerSignTest,
  calculatePowerChiSquare2x2,
  calculatePowerFisherExact,
  calculatePowerMcNemar,
  calculatePowerCochranQ,
  calculatePowerChiSquareIndependence,
  calculatePowerGoodnessOfFit,
  generatePowerCurveProportions,
  generateEffectSizeCurveProportions,
} from './proportions/proportions';
