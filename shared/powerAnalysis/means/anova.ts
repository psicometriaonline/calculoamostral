/**
 * Power Analysis for ANOVA Tests
 * 
 * Implements statistical power calculations for:
 * - One-way ANOVA (k independent groups)
 * - Factorial ANOVA (two factors)
 */

import { PowerAnalysisInput, PowerAnalysisResult } from '../types';
import {
  normalQuantile,
  getFCriticalValue,
  calculatePowerFromNCPF,
} from '../utils';

/**
 * Calculate required sample size per group for one-way ANOVA
 * Using iterative refinement with F distribution
 */
function calculateRequiredNAnovaOneWay(
  f: number,        // Cohen's f effect size
  alpha: number,
  power: number,
  k: number         // Number of groups
): number {
  const za = normalQuantile(1 - alpha);
  const zb = normalQuantile(power);
  
  // Initial approximation using normal approximation
  let n = Math.pow((za + zb) / f, 2) * (1 + 1/k) / 2 + 1;
  n = Math.max(2, Math.ceil(n));
  
  // Iterative refinement using exact F distribution
  for (let iter = 0; iter < 50; iter++) {
    const df1 = k - 1;
    const df2 = k * (n - 1);
    const lambda = n * k * f * f;  // Non-centrality parameter
    
    const criticalF = getFCriticalValue(alpha, df1, df2);
    const currentPower = calculatePowerFromNCPF(criticalF, df1, df2, lambda);
    
    if (Math.abs(currentPower - power) < 0.0001) {
      break;
    }
    
    // Adjust n based on power difference
    if (currentPower < power) {
      n = n + 1;
    } else if (n > 2) {
      // Check if we can reduce
      const testN = n - 1;
      const testDf2 = k * (testN - 1);
      const testLambda = testN * k * f * f;
      const testCritF = getFCriticalValue(alpha, df1, testDf2);
      const testPower = calculatePowerFromNCPF(testCritF, df1, testDf2, testLambda);
      
      if (testPower >= power) {
        n = testN;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  
  return Math.max(2, Math.ceil(n));
}

/**
 * Calculate power for ONE-WAY ANOVA
 * Tests if k independent group means differ
 * Effect size: Cohen's f
 */
export function calculatePowerAnovaOneWay(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, k } = input;
  
  if (!effectSize) {
    throw new Error("Effect size (Cohen's f) is required");
  }
  
  const numGroups = k || 3; // Default to 3 groups
  
  if (numGroups < 2) {
    throw new Error('Number of groups (k) must be at least 2');
  }
  
  // Calculate required N given power (a priori)
  if (power && !n) {
    const requiredN = calculateRequiredNAnovaOneWay(effectSize, alpha, power, numGroups);
    const df1 = numGroups - 1;
    const df2 = numGroups * (requiredN - 1);
    const criticalValue = getFCriticalValue(alpha, df1, df2);
    
    return {
      requiredN,
      effectSize,
      alpha,
      df: df1,
      df2,
      criticalValue,
      testType: 'anova-oneway',
      k: numGroups
    };
  }
  // Calculate power given sample size (post-hoc)
  else if (n && !power) {
    const df1 = numGroups - 1;
    const df2 = numGroups * (n - 1);
    const lambda = n * numGroups * effectSize * effectSize; // NCP = n * k * f²
    const criticalValue = getFCriticalValue(alpha, df1, df2);
    
    const calculatedPower = calculatePowerFromNCPF(criticalValue, df1, df2, lambda);
    
    return {
      power: calculatedPower,
      effectSize,
      alpha,
      df: df1,
      df2,
      criticalValue,
      testType: 'anova-oneway',
      k: numGroups
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * FACTORIAL ANOVA — G*Power "Fixed effects, special, main effects and interactions"
 *
 * G*Power's "special" procedure does NOT require the user to declare each factor and
 * its levels. The user supplies, independently:
 *   - Number of groups (k): total number of groups/cells in the design. Only used to
 *     derive the denominator df.
 *   - Numerator df (df1): degrees of freedom of the specific effect being tested.
 *
 * The model is:
 *   df1 = numeratorDf            (user-supplied)
 *   df2 = N − k                  (N = total sample size, k = number of groups)
 *   λ   = f² × N                 (non-centrality parameter, N total)
 *
 * This generalizes the two-factor case to any factorial design and exactly reproduces
 * G*Power's "special" output (e.g. N=65, df1=10, k=6 → df2=59, λ=f²·65).
 */

/**
 * Solve the minimum TOTAL sample size for the G*Power "special" factorial ANOVA.
 * Power increases monotonically with N (λ = f²·N grows, df2 = N−k grows), so we
 * bracket an upper bound by doubling and then bisect for the smallest integer N
 * whose achieved power meets the target.
 */
function calculateRequiredNAnovaFactorialSpecial(
  f: number,          // Cohen's f effect size
  alpha: number,
  power: number,
  numGroups: number,  // total number of groups/cells (k)
  numeratorDf: number // df of the effect being tested (df1)
): number {
  const df1 = numeratorDf;
  const minN = numGroups + 1; // need df2 = N − k ≥ 1

  const powerAt = (N: number): number => {
    const df2 = N - numGroups;
    if (df2 < 1) return 0;
    const lambda = f * f * N;
    const criticalF = getFCriticalValue(alpha, df1, df2);
    return calculatePowerFromNCPF(criticalF, df1, df2, lambda);
  };

  if (powerAt(minN) >= power) return minN;

  // Exponential search for an upper bound
  let hi = Math.max(minN * 2, minN + 8);
  let guard = 0;
  while (powerAt(hi) < power) {
    hi *= 2;
    if (hi > 1e8 || guard++ > 200) break;
  }

  // Bisection for the smallest integer N
  let lo = minN;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (powerAt(mid) >= power) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}

/**
 * Calculate power for FACTORIAL ANOVA (G*Power "special" model)
 * Inputs: number of groups (k) + numerator df (df1) + Cohen's f.
 */
export function calculatePowerAnovaFactorial(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, numGroups, numeratorDf } = input;

  if (!effectSize) {
    throw new Error("Effect size (Cohen's f) is required");
  }

  const groups = numGroups || 2;    // total number of groups/cells (k)
  const df1 = numeratorDf || 1;     // numerator df of the tested effect

  if (groups < 2) {
    throw new Error('Number of groups must be at least 2');
  }
  if (df1 < 1) {
    throw new Error('Numerator df must be at least 1');
  }

  const effectLabel = `Efeito (gl do numerador = ${df1})`;

  // Calculate required total N given power (a priori)
  if (power && !n) {
    const requiredN = calculateRequiredNAnovaFactorialSpecial(
      effectSize, alpha, power, groups, df1
    );
    const df2 = requiredN - groups;
    const criticalValue = getFCriticalValue(alpha, df1, df2);

    return {
      requiredN,
      effectSize,
      alpha,
      df: df1,
      df2,
      criticalValue,
      testType: 'anova-factorial',
      numGroups: groups,
      numeratorDf: df1,
      effectLabel
    };
  }
  // Calculate power given TOTAL sample size (post-hoc)
  else if (n && !power) {
    const df2 = n - groups;
    if (df2 < 1) {
      throw new Error('Total sample size (N) must be greater than the number of groups');
    }
    const lambda = effectSize * effectSize * n; // λ = f² × N (N total)
    const criticalValue = getFCriticalValue(alpha, df1, df2);

    const calculatedPower = calculatePowerFromNCPF(criticalValue, df1, df2, lambda);

    return {
      power: calculatedPower,
      effectSize,
      alpha,
      df: df1,
      df2,
      criticalValue,
      testType: 'anova-factorial',
      numGroups: groups,
      numeratorDf: df1,
      effectLabel
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * ANOVA REPEATED MEASURES (Within-subjects)
 * 
 * For repeated measures designs, the non-centrality parameter is:
 * λ = n × m × f² / (1 - ρ)
 * where:
 *   n = number of subjects
 *   m = number of measurements (within-subjects levels)
 *   f = Cohen's f effect size
 *   ρ = correlation between repeated measures
 * 
 * The correction for sphericity is applied to the degrees of freedom:
 *   df_effect = ε × (m - 1)
 *   df_error = ε × (m - 1) × (n - 1)
 * where ε is the sphericity correction (Greenhouse-Geisser or Huynh-Feldt)
 */

function calculateRequiredNAnovaRepeated(
  f: number,           // Cohen's f effect size
  alpha: number,
  power: number,
  numMeasurements: number,  // Number of repeated measurements
  rho: number,              // Correlation between measures
  epsilon: number = 1       // Sphericity correction (1 = sphericity assumed)
): number {
  const m = numMeasurements;
  
  // Degrees of freedom (with sphericity correction)
  const dfEffect = epsilon * (m - 1);
  
  // Initial approximation
  let n = 10;
  
  // Iterative refinement
  for (let iter = 0; iter < 100; iter++) {
    const dfError = epsilon * (m - 1) * (n - 1);
    
    // Non-centrality parameter for repeated measures
    // λ = n × m × f² / (1 - ρ)
    // The (1 - ρ) factor accounts for the correlation reducing variability
    const lambda = (n * m * f * f) / (1 - rho);
    
    const criticalF = getFCriticalValue(alpha, dfEffect, dfError);
    const currentPower = calculatePowerFromNCPF(criticalF, dfEffect, dfError, lambda);
    
    if (Math.abs(currentPower - power) < 0.0001) {
      break;
    }
    
    if (currentPower < power) {
      n = n + 1;
    } else if (n > 2) {
      const testN = n - 1;
      const testDfError = epsilon * (m - 1) * (testN - 1);
      const testLambda = (testN * m * f * f) / (1 - rho);
      const testCritF = getFCriticalValue(alpha, dfEffect, testDfError);
      const testPower = calculatePowerFromNCPF(testCritF, dfEffect, testDfError, testLambda);
      
      if (testPower >= power) {
        n = testN;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  
  return Math.max(2, Math.ceil(n));
}

/**
 * Calculate power for REPEATED MEASURES ANOVA
 * Tests if measurements differ across time points within subjects
 * Effect size: Cohen's f
 */
export function calculatePowerAnovaRepeated(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, numMeasurements, correlationBetweenMeasures, sphericityCorrection } = input;
  
  if (!effectSize) {
    throw new Error("Effect size (Cohen's f) is required");
  }
  
  const m = numMeasurements || 3; // Default to 3 measurements
  const rho = correlationBetweenMeasures ?? 0.5; // Default correlation
  const epsilon = sphericityCorrection ?? 1; // Default: sphericity assumed
  
  if (m < 2) {
    throw new Error('Number of measurements must be at least 2');
  }
  
  if (rho < 0 || rho >= 1) {
    throw new Error('Correlation between measures must be between 0 and 1 (exclusive)');
  }
  
  if (epsilon <= 0 || epsilon > 1) {
    throw new Error('Sphericity correction (epsilon) must be between 0 and 1');
  }
  
  const dfEffect = epsilon * (m - 1);
  
  // Calculate required N given power (a priori)
  if (power && !n) {
    const requiredN = calculateRequiredNAnovaRepeated(effectSize, alpha, power, m, rho, epsilon);
    const dfError = epsilon * (m - 1) * (requiredN - 1);
    const criticalValue = getFCriticalValue(alpha, dfEffect, dfError);
    
    return {
      requiredN,
      effectSize,
      alpha,
      df: dfEffect,
      df2: dfError,
      criticalValue,
      testType: 'anova-repeated',
      numMeasurements: m,
      correlationBetweenMeasures: rho,
      sphericityCorrection: epsilon,
      effectLabel: 'Efeito within-subjects'
    };
  }
  // Calculate power given sample size (post-hoc)
  else if (n && !power) {
    const dfError = epsilon * (m - 1) * (n - 1);
    const lambda = (n * m * effectSize * effectSize) / (1 - rho);
    const criticalValue = getFCriticalValue(alpha, dfEffect, dfError);
    
    const calculatedPower = calculatePowerFromNCPF(criticalValue, dfEffect, dfError, lambda);
    
    return {
      power: calculatedPower,
      effectSize,
      alpha,
      df: dfEffect,
      df2: dfError,
      criticalValue,
      testType: 'anova-repeated',
      numMeasurements: m,
      correlationBetweenMeasures: rho,
      sphericityCorrection: epsilon,
      effectLabel: 'Efeito within-subjects'
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * MIXED ANOVA (Between-Within / Split-Plot Design)
 * 
 * Combines between-subjects factor(s) with within-subjects factor
 * 
 * Effects:
 * - Between-subjects: Effect of group membership
 * - Within-subjects: Effect of repeated measurements
 * - Interaction: Between × Within interaction
 * 
 * Non-centrality parameters:
 * - Between: λ = n × m × g × f² (where g = number of groups)
 * - Within: λ = n × g × m × f² / (1 - ρ)
 * - Interaction: λ = n × g × m × f² / (1 - ρ)
 */

function calculateRequiredNAnovaMixed(
  f: number,
  alpha: number,
  power: number,
  numGroups: number,
  numMeasurements: number,
  rho: number,
  epsilon: number,
  effectType: 'between' | 'within' | 'within_between'
): number {
  const g = numGroups;
  const m = numMeasurements;
  
  // Degrees of freedom depend on effect type
  let dfEffect: number;
  
  if (effectType === 'between') {
    dfEffect = g - 1;
  } else if (effectType === 'within') {
    dfEffect = epsilon * (m - 1);
  } else {
    // Interaction
    dfEffect = epsilon * (g - 1) * (m - 1);
  }
  
  // Initial approximation
  let n = 10;
  
  for (let iter = 0; iter < 100; iter++) {
    let dfError: number;
    let lambda: number;
    
    if (effectType === 'between') {
      // Between-subjects error: g * (n - 1)
      dfError = g * (n - 1);
      // Lambda for between effect
      lambda = n * m * g * f * f;
    } else if (effectType === 'within') {
      // Within-subjects error: ε × (m-1) × g × (n-1)
      dfError = epsilon * (m - 1) * g * (n - 1);
      // Lambda for within effect (accounts for correlation)
      lambda = (n * g * m * f * f) / (1 - rho);
    } else {
      // Interaction error: ε × (g-1) × (m-1) × (n-1) × g
      dfError = epsilon * (m - 1) * g * (n - 1);
      // Lambda for interaction
      lambda = (n * g * m * f * f) / (1 - rho);
    }
    
    const criticalF = getFCriticalValue(alpha, dfEffect, dfError);
    const currentPower = calculatePowerFromNCPF(criticalF, dfEffect, dfError, lambda);
    
    if (Math.abs(currentPower - power) < 0.0001) {
      break;
    }
    
    if (currentPower < power) {
      n = n + 1;
    } else if (n > 2) {
      const testN = n - 1;
      let testDfError: number;
      let testLambda: number;
      
      if (effectType === 'between') {
        testDfError = g * (testN - 1);
        testLambda = testN * m * g * f * f;
      } else {
        testDfError = epsilon * (m - 1) * g * (testN - 1);
        testLambda = (testN * g * m * f * f) / (1 - rho);
      }
      
      const testCritF = getFCriticalValue(alpha, dfEffect, testDfError);
      const testPower = calculatePowerFromNCPF(testCritF, dfEffect, testDfError, testLambda);
      
      if (testPower >= power) {
        n = testN;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  
  return Math.max(2, Math.ceil(n));
}

/**
 * Calculate power for MIXED ANOVA (Between-Within Design)
 * Tests between-subjects, within-subjects, and interaction effects
 * Effect size: Cohen's f
 */
export function calculatePowerAnovaMixed(input: PowerAnalysisInput): PowerAnalysisResult {
  const { 
    alpha, power, effectSize, n, 
    numGroups, numMeasurements, 
    correlationBetweenMeasures, sphericityCorrection,
    effectType 
  } = input;
  
  if (!effectSize) {
    throw new Error("Effect size (Cohen's f) is required");
  }
  
  const g = numGroups || 2; // Default to 2 groups
  const m = numMeasurements || 3; // Default to 3 measurements
  const rho = correlationBetweenMeasures ?? 0.5; // Default correlation
  const epsilon = sphericityCorrection ?? 1; // Default: sphericity assumed
  const effect = (effectType as 'between' | 'within' | 'within_between') || 'within_between'; // Default to interaction
  
  if (g < 2) {
    throw new Error('Number of groups must be at least 2');
  }
  
  if (m < 2) {
    throw new Error('Number of measurements must be at least 2');
  }
  
  if (rho < 0 || rho >= 1) {
    throw new Error('Correlation between measures must be between 0 and 1 (exclusive)');
  }
  
  // Determine degrees of freedom and effect label
  let dfEffect: number;
  let effectLabel: string;
  
  if (effect === 'between') {
    dfEffect = g - 1;
    effectLabel = 'Efeito between-subjects';
  } else if (effect === 'within') {
    dfEffect = epsilon * (m - 1);
    effectLabel = 'Efeito within-subjects';
  } else {
    dfEffect = epsilon * (g - 1) * (m - 1);
    effectLabel = 'Interação Grupo × Tempo';
  }
  
  // Calculate required N given power (a priori)
  if (power && !n) {
    // calculateRequiredNAnovaMixed returns n per group
    const nPerGroup = calculateRequiredNAnovaMixed(
      effectSize, alpha, power, g, m, rho, epsilon, effect
    );
    
    // Total N = n per group × number of groups (like G*Power)
    const totalN = nPerGroup * g;
    
    let dfError: number;
    if (effect === 'between') {
      dfError = g * (nPerGroup - 1);
    } else {
      dfError = epsilon * (m - 1) * g * (nPerGroup - 1);
    }
    
    const criticalValue = getFCriticalValue(alpha, dfEffect, dfError);
    
    return {
      requiredN: totalN,  // Return total N, not per group
      effectSize,
      alpha,
      df: dfEffect,
      df2: dfError,
      criticalValue,
      testType: 'anova-mixed',
      numGroups: g,
      numMeasurements: m,
      correlationBetweenMeasures: rho,
      sphericityCorrection: epsilon,
      effectType: effect,
      effectLabel,
      nPerGroup  // Also include n per group for reference
    };
  }
  // Calculate power given sample size (post-hoc)
  // Note: n is expected to be TOTAL sample size (like G*Power)
  else if (n && !power) {
    // Convert total N to n per group
    const nPerGroup = Math.floor(n / g);
    
    let dfError: number;
    let lambda: number;
    
    if (effect === 'between') {
      dfError = g * (nPerGroup - 1);
      lambda = nPerGroup * m * g * effectSize * effectSize;
    } else {
      dfError = epsilon * (m - 1) * g * (nPerGroup - 1);
      lambda = (nPerGroup * g * m * effectSize * effectSize) / (1 - rho);
    }
    
    const criticalValue = getFCriticalValue(alpha, dfEffect, dfError);
    const calculatedPower = calculatePowerFromNCPF(criticalValue, dfEffect, dfError, lambda);
    
    return {
      power: calculatedPower,
      effectSize,
      alpha,
      df: dfEffect,
      df2: dfError,
      criticalValue,
      testType: 'anova-mixed',
      numGroups: g,
      numMeasurements: m,
      correlationBetweenMeasures: rho,
      sphericityCorrection: epsilon,
      effectType: effect,
      effectLabel,
      nPerGroup
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * Generate power curve data for ANOVA
 */
export function generatePowerCurveAnova(
  effectSize: number,
  alpha: number,
  testType: 'one-way' | 'factorial',
  k: number = 3,
  numGroups: number = 2,
  numeratorDf: number = 1,
  maxN: number = 100
): Array<{ n: number; power: number }> {
  const points: Array<{ n: number; power: number }> = [];
  const step = Math.max(1, Math.floor(maxN / 50));
  
  for (let n = 2; n <= maxN; n += step) {
    try {
      let result: PowerAnalysisResult;
      
      if (testType === 'one-way') {
        result = calculatePowerAnovaOneWay({
          alpha,
          effectSize,
          n,
          k,
          tails: 'two' // ANOVA is always one-tailed (F-test)
        });
      } else {
        // G*Power "special" factorial ANOVA uses TOTAL N
        if (n <= numGroups) continue;
        result = calculatePowerAnovaFactorial({
          alpha,
          effectSize,
          n,
          numGroups,
          numeratorDf,
          tails: 'two'
        });
      }
      
      if (result.power) {
        points.push({ n, power: result.power });
      }
    } catch (error) {
      continue;
    }
  }
  
  return points;
}

/**
 * Generate power curve data varying the effect size (Cohen's f) at a fixed N.
 * Used by the sensitivity calculation mode (have-n-effect). Reuses the same
 * post-hoc power functions; no math changes.
 */
export function generateEffectSizeCurveAnova(
  n: number,
  alpha: number,
  testType: 'one-way' | 'factorial',
  maxEffect: number,
  k: number = 3,
  numGroups: number = 2,
  numeratorDf: number = 1
): Array<{ effectSize: number; power: number }> {
  const points: Array<{ effectSize: number; power: number }> = [];
  const safeMax = Math.max(maxEffect, 0.1);
  const step = safeMax / 50;

  for (let es = step; es <= safeMax + step / 2; es += step) {
    try {
      let result: PowerAnalysisResult;

      if (testType === 'one-way') {
        result = calculatePowerAnovaOneWay({
          alpha,
          effectSize: es,
          n,
          k,
          tails: 'two'
        });
      } else {
        result = calculatePowerAnovaFactorial({
          alpha,
          effectSize: es,
          n,
          numGroups,
          numeratorDf,
          tails: 'two'
        });
      }

      if (result.power) {
        points.push({ effectSize: es, power: result.power });
      }
    } catch (error) {
      continue;
    }
  }

  return points;
}
