/**
 * Power Analysis for T-tests
 * 
 * Implements statistical power calculations for:
 * - One-sample t-test
 * - Paired (dependent) t-test  
 * - Independent (two-sample) t-test
 */

import { PowerAnalysisInput, PowerAnalysisResult } from '../types';
import {
  getCriticalValue,
  calculatePowerFromNCP,
  calculateRequiredNOneSample,
  calculateRequiredNIndependent,
  calculateRequiredN2,
} from '../utils';

/**
 * Calculate power for ONE-SAMPLE T-TEST
 * Tests if a sample mean differs from a known population value
 */
export function calculatePowerOneSampleT(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, tails } = input;
  
  if (!effectSize) {
    throw new Error('Effect size (Cohen\'s d) is required');
  }
  
  if (power && !n) {
    // Calculate required sample size
    const requiredN = calculateRequiredNOneSample(effectSize, alpha, power, tails);
    const df = requiredN - 1;
    const criticalValue = getCriticalValue(alpha, df, tails);
    
    return {
      requiredN,
      effectSize,
      alpha,
      df,
      criticalValue,
      testType: 'one-sample-t-test'
    };
  } else if (n && !power) {
    // Calculate power
    const df = n - 1;
    const ncp = effectSize * Math.sqrt(n); // Non-centrality parameter
    const criticalValue = getCriticalValue(alpha, df, tails);
    
    const calculatedPower = calculatePowerFromNCP(criticalValue, df, ncp, tails);
    
    return {
      power: calculatedPower,
      effectSize,
      alpha,
      df,
      criticalValue,
      testType: 'one-sample-t-test'
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * Calculate power for PAIRED (DEPENDENT) T-TEST
 * Tests differences between paired observations
 */
export function calculatePowerPairedT(input: PowerAnalysisInput): PowerAnalysisResult {
  // Paired t-test is mathematically equivalent to one-sample t-test on differences
  const result = calculatePowerOneSampleT(input);
  return {
    ...result,
    testType: 'paired-t-test'
  };
}

/**
 * Calculate power for INDEPENDENT (TWO-SAMPLE) T-TEST
 * Tests if two independent group means differ
 */
export function calculatePowerIndependentT(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, n1, n2, tails } = input;
  
  if (!effectSize) {
    throw new Error('Effect size (Cohen\'s d) is required');
  }
  
  // Calculate required N given power
  if (power && !n2) {
    // n1 is interpreted as allocation ratio (default 1 for equal groups)
    const ratio = n1 || 1;
    const requiredN1 = calculateRequiredNIndependent(effectSize, alpha, power, tails, ratio);
    const requiredN2 = Math.ceil(requiredN1 / ratio);
    const df = requiredN1 + requiredN2 - 2;
    const criticalValue = getCriticalValue(alpha, df, tails);
    
    return {
      requiredN1,
      requiredN2,
      effectSize,
      alpha,
      df,
      criticalValue,
      testType: 'independent-t-test'
    };
  }
  // Calculate power given sample sizes
  else if (!power && n1 && n2) {
    const df = n1 + n2 - 2;
    const harmonicMean = 2 / (1/n1 + 1/n2);
    const ncp = effectSize * Math.sqrt(harmonicMean / 2);
    const criticalValue = getCriticalValue(alpha, df, tails);
    
    const calculatedPower = calculatePowerFromNCP(criticalValue, df, ncp, tails);
    
    return {
      power: calculatedPower,
      effectSize,
      alpha,
      df,
      criticalValue,
      testType: 'independent-t-test'
    };
  } else if (!power && n && !n1 && !n2) {
    // Equal sample sizes, calculate power
    const df = 2 * n - 2;
    const ncp = effectSize * Math.sqrt(n / 2);
    const criticalValue = getCriticalValue(alpha, df, tails);
    
    const calculatedPower = calculatePowerFromNCP(criticalValue, df, ncp, tails);
    
    return {
      power: calculatedPower,
      effectSize,
      alpha,
      df,
      criticalValue,
      testType: 'independent-t-test'
    };
  } else if (power && !n && !n1 && !n2) {
    // Calculate equal sample sizes (default case)
    const requiredN = calculateRequiredNIndependent(effectSize, alpha, power, tails, 1);
    const df = 2 * requiredN - 2;
    const criticalValue = getCriticalValue(alpha, df, tails);
    
    return {
      requiredN1: requiredN,
      requiredN2: requiredN,
      effectSize,
      alpha,
      df,
      criticalValue,
      testType: 'independent-t-test'
    };
  } else {
    throw new Error('Invalid combination of parameters. Provide either: (power) OR (power + n1) OR (n1 + n2) OR (n)');
  }
}

/**
 * Generate power curve data points (power vs sample size)
 */
export function generatePowerCurveTTests(
  effectSize: number,
  alpha: number,
  testType: 'one-sample' | 'paired' | 'independent',
  tails: 'one' | 'two',
  maxN: number = 200
): Array<{ n: number; power: number }> {
  const points: Array<{ n: number; power: number }> = [];
  const step = Math.max(1, Math.floor(maxN / 50)); // 50 data points
  
  for (let n = 2; n <= maxN; n += step) {
    try {
      let result: PowerAnalysisResult;
      
      if (testType === 'independent') {
        result = calculatePowerIndependentT({
          alpha,
          effectSize,
          n,
          tails
        });
      } else {
        result = calculatePowerOneSampleT({
          alpha,
          effectSize,
          n,
          tails
        });
      }
      
      if (result.power) {
        points.push({ n, power: result.power });
      }
    } catch (error) {
      // Skip if calculation fails
      continue;
    }
  }
  
  return points;
}

/**
 * Generate power curve data points varying the effect size at a fixed N.
 * Used by the sensitivity calculation mode (have-n-effect), where the effect
 * size is the result rather than an input. Reuses the same post-hoc power
 * functions; no math changes.
 */
export function generateEffectSizeCurveTTests(
  n: number,
  alpha: number,
  testType: 'one-sample' | 'paired' | 'independent',
  tails: 'one' | 'two',
  maxEffect: number,
  n2?: number
): Array<{ effectSize: number; power: number }> {
  const points: Array<{ effectSize: number; power: number }> = [];
  const safeMax = Math.max(maxEffect, 0.1);
  const step = safeMax / 50;

  for (let es = step; es <= safeMax + step / 2; es += step) {
    try {
      let result: PowerAnalysisResult;

      if (testType === 'independent') {
        result = calculatePowerIndependentT(
          n2 !== undefined
            ? { alpha, effectSize: es, n1: n, n2, tails }
            : { alpha, effectSize: es, n, tails }
        );
      } else {
        result = calculatePowerOneSampleT({
          alpha,
          effectSize: es,
          n,
          tails
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
