/**
 * Power Analysis for Correlations
 * 
 * Implements statistical power calculations for:
 * - Pearson correlation (r)
 * - Spearman correlation (rho/ρ)
 */

import { PowerAnalysisInput, PowerAnalysisResult } from '../types';
import { normalCDF, normalQuantile, getCriticalValue, noncentralTCDF, getFCriticalValue, noncentralFCDF } from '../utils';

/**
 * Fisher Z transformation
 * Transforms correlation coefficient to approximately normal distribution
 */
function fisherZ(r: number): number {
  if (r >= 1 || r <= -1) {
    throw new Error('Correlation must be between -1 and 1 (exclusive)');
  }
  return 0.5 * Math.log((1 + r) / (1 - r));
}

/**
 * Inverse Fisher Z transformation
 */
function inverseFisherZ(z: number): number {
  const e2z = Math.exp(2 * z);
  return (e2z - 1) / (e2z + 1);
}

/**
 * Calculate power for PEARSON CORRELATION
 * Tests if correlation between two continuous variables differs from zero
 */
export function calculatePowerPearsonCorrelation(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, tails } = input;
  
  // effectSize is the population correlation coefficient (rho)
  if (!effectSize) {
    throw new Error('Effect size (correlation coefficient ρ) is required');
  }
  
  if (effectSize <= -1 || effectSize >= 1) {
    throw new Error('Correlation coefficient must be between -1 and 1 (exclusive)');
  }
  
  if (power && !n) {
    // Calculate required sample size
    const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);
    const zb = normalQuantile(power);
    
    // Fisher Z transformation of effect size
    const zr = fisherZ(effectSize);
    
    // Sample size formula using Fisher Z
    // SE of Fisher Z is 1/sqrt(n-3)
    // n - 3 = ((za + zb) / zr)^2
    const requiredN = Math.ceil(Math.pow((za + zb) / zr, 2) + 3);
    
    // For correlation, df = n - 2
    const df = requiredN - 2;
    
    // Critical r value (approximate)
    const criticalZ = za / Math.sqrt(requiredN - 3);
    const criticalR = Math.tanh(criticalZ); // tanh is inverse of Fisher Z for small values
    
    return {
      requiredN,
      effectSize,
      alpha,
      df,
      criticalValue: criticalR,
      testType: 'pearson-correlation'
    };
  } else if (n && !power) {
    // Calculate power given sample size
    if (n < 4) {
      throw new Error('Sample size must be at least 4 for correlation');
    }
    
    const df = n - 2;
    
    // Fisher Z transformation
    const zr = fisherZ(effectSize);
    
    // Standard error of Fisher Z
    const se = 1 / Math.sqrt(n - 3);
    
    // Z-score for the effect
    const z = zr / se;
    
    // Critical value
    const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);
    
    // Power calculation
    let calculatedPower: number;
    if (tails === 'two') {
      // Two-tailed: power on both sides
      const power1 = 1 - normalCDF(za - z);
      const power2 = normalCDF(-za - z);
      calculatedPower = power1 + power2;
    } else {
      // One-tailed
      calculatedPower = 1 - normalCDF(za - z);
    }
    
    // Critical r value
    const criticalZ = za / Math.sqrt(n - 3);
    const criticalR = Math.tanh(criticalZ);
    
    return {
      power: calculatedPower,
      effectSize,
      alpha,
      df,
      criticalValue: criticalR,
      testType: 'pearson-correlation'
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * Calculate power for SPEARMAN CORRELATION
 * Tests if rank correlation between two variables differs from zero
 * 
 * Note: For large samples, Spearman's rho has similar properties to Pearson's r
 * and can use the same Fisher Z transformation as an approximation
 */
export function calculatePowerSpearmanCorrelation(input: PowerAnalysisInput): PowerAnalysisResult {
  // Spearman correlation uses same calculation as Pearson for power analysis
  // The effect size interpretation is slightly different (rank correlation vs linear)
  // but the statistical properties are very similar for n > 10
  
  const result = calculatePowerPearsonCorrelation(input);
  
  return {
    ...result,
    testType: 'spearman-correlation'
  };
}

/**
 * Calculate power for KENDALL TAU CORRELATION
 * Tests if rank correlation (tau) between two variables differs from zero
 * 
 * Kendall's tau uses a different variance formula than Spearman's rho.
 * For large n, the asymptotic variance of tau is:
 *   Var(τ) = 2(2n+5) / (9n(n-1))
 * 
 * The relationship between Kendall's tau (τ) and Spearman's rho (ρ) is approximately:
 *   ρ ≈ 1.5τ (for many bivariate distributions)
 * 
 * Power analysis uses asymptotic normal approximation with the tau-specific variance.
 */

/**
 * Power for Kendall's tau at a given n, using the EXACT asymptotic variance
 * Var(τ) = 2(2n+5)/(9n(n-1)). This is the single source of truth shared by both
 * the "calculate power" and "calculate sample size" modes so the two modes agree.
 */
function kendallPowerAtN(
  n: number,
  effectSize: number,
  alpha: number,
  tails: 'one' | 'two'
): number {
  const variance = (2 * (2 * n + 5)) / (9 * n * (n - 1));
  const se = Math.sqrt(variance);
  const z = effectSize / se;
  const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);
  if (tails === 'two') {
    return (1 - normalCDF(za - Math.abs(z))) + normalCDF(-za - Math.abs(z));
  }
  return 1 - normalCDF(za - Math.abs(z));
}

export function calculatePowerKendallCorrelation(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, tails } = input;
  
  // effectSize is the population Kendall's tau coefficient
  if (!effectSize) {
    throw new Error('Effect size (Kendall τ) is required');
  }
  
  if (effectSize <= -1 || effectSize >= 1) {
    throw new Error('Kendall τ must be between -1 and 1 (exclusive)');
  }
  
  if (power && !n) {
    // Calculate required sample size.
    // Both modes use the SAME exact asymptotic variance (kendallPowerAtN), so the
    // returned N achieves the target power when re-checked in "calculate power" mode.
    const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);
    const zb = normalQuantile(power);

    // Closed-form approximation (simplified variance 4/(9n)) used only as a starting
    // guess; the search below corrects it against the exact variance.
    const tauAbs = Math.abs(effectSize);
    let requiredN = Math.max(
      Math.ceil(4 * Math.pow(za + zb, 2) / (9 * tauAbs * tauAbs)),
      4
    );

    const MAX_N = 10_000_000;
    // Walk up until the exact power reaches the target.
    while (
      requiredN < MAX_N &&
      kendallPowerAtN(requiredN, effectSize, alpha, tails) < power
    ) {
      requiredN++;
    }
    // Walk down in case the starting guess overshot (smallest N that still meets target).
    while (
      requiredN > 4 &&
      kendallPowerAtN(requiredN - 1, effectSize, alpha, tails) >= power
    ) {
      requiredN--;
    }

    const finalN = requiredN;

    // For Kendall, df is approximately n-2 (for reference)
    const df = finalN - 2;

    // Critical tau value (approximate using normal distribution)
    const variance = (2 * (2 * finalN + 5)) / (9 * finalN * (finalN - 1));
    const criticalTau = za * Math.sqrt(variance);

    return {
      requiredN: finalN,
      effectSize,
      alpha,
      df,
      criticalValue: criticalTau,
      testType: 'kendall-correlation'
    };
  } else if (n && !power) {
    // Calculate power given sample size
    if (n < 4) {
      throw new Error('Sample size must be at least 4 for Kendall correlation');
    }
    
    const df = n - 2;
    
    // Kendall's tau asymptotic variance
    const variance = (2 * (2 * n + 5)) / (9 * n * (n - 1));
    const se = Math.sqrt(variance);
    
    // Z-score for the effect
    const z = effectSize / se;
    
    // Critical value
    const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);
    
    // Power calculation
    let calculatedPower: number;
    if (tails === 'two') {
      // Two-tailed: power on both sides
      const power1 = 1 - normalCDF(za - Math.abs(z));
      const power2 = normalCDF(-za - Math.abs(z));
      calculatedPower = power1 + power2;
    } else {
      // One-tailed
      calculatedPower = 1 - normalCDF(za - Math.abs(z));
    }
    
    // Critical tau value
    const criticalTau = za * se;
    
    return {
      power: calculatedPower,
      effectSize,
      alpha,
      df,
      criticalValue: criticalTau,
      testType: 'kendall-correlation'
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * Calculate power for COMPARISON OF TWO INDEPENDENT CORRELATIONS
 * Tests if two correlations from independent samples differ significantly
 * 
 * CORRECT Fisher Z approach:
 * - User provides r₁ and r₂ (the two correlation values to compare)
 * - Transform to Fisher Z: z₁ = atanh(r₁), z₂ = atanh(r₂)
 * - Calculate difference: Δz = |z₁ - z₂|
 * - SE in Fisher Z scale: sqrt(1/(n1-3) + 1/(n2-3))
 * - Test statistic: z = Δz / SE
 * 
 * Alternative: User can provide effectSize as Δz directly for advanced usage
 */
export function calculatePowerCompareCorrelationsIndependent(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, r1, r2, n1, n2, tails } = input;
  
  // Calculate Fisher Z difference from r1 and r2, or use effectSize if provided
  let deltaZ: number;
  
  if (r1 !== undefined && r2 !== undefined) {
    // User provided r1 and r2 - calculate Fisher Z difference
    if (r1 <= -1 || r1 >= 1) {
      throw new Error('r₁ must be between -1 and 1 (exclusive)');
    }
    if (r2 <= -1 || r2 >= 1) {
      throw new Error('r₂ must be between -1 and 1 (exclusive)');
    }
    
    // Transform to Fisher Z and preserve sign for directionality
    // For power calculations, we'll use the magnitude later
    const z1 = fisherZ(r1);
    const z2 = fisherZ(r2);
    deltaZ = z1 - z2;
  } else if (effectSize !== undefined) {
    // Advanced: User provided Δz directly (can be signed)
    if (Math.abs(effectSize) >= 4) {
      throw new Error('Effect size (|Δz|) must be less than 4');
    }
    deltaZ = effectSize;
  } else {
    throw new Error('Either provide r₁ and r₂, or effectSize (Δz)');
  }
  
  // Validate that deltaZ is not too close to zero (would cause division by zero)
  if (Math.abs(deltaZ) < 0.0001) {
    throw new Error('Effect size is too small (r₁ and r₂ are nearly identical). Cannot perform power analysis.');
  }
  
  if (power && !n1) {
    // Calculate required sample size (assumes equal n)
    const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);
    const zb = normalQuantile(power);
    
    // For equal sample sizes: SE = sqrt(2/(n-3))
    // We need: (za + zb) = |deltaZ| / SE = |deltaZ| * sqrt((n-3)/2)
    // Solving for n: n = 2 * ((za + zb) / |deltaZ|)^2 + 3
    // Use absolute value of deltaZ for sample size calculation
    
    const deltaZMag = Math.abs(deltaZ);
    const requiredN = Math.ceil(2 * Math.pow((za + zb) / deltaZMag, 2) + 3);
    
    // df for comparison of correlations (approximation)
    const df = (requiredN - 3) * 2;
    
    // Critical z value
    const criticalZ = za;
    
    return {
      requiredN,
      effectSize: deltaZMag,
      alpha,
      df,
      criticalValue: criticalZ,
      testType: 'compare-correlations-independent'
    };
  } else if (n1 && n2 && !power) {
    // Calculate power given sample sizes
    if (n1 < 4 || n2 < 4) {
      throw new Error('Both sample sizes must be at least 4 for correlation comparison');
    }
    
    const deltaZMag = Math.abs(deltaZ);
    
    // Standard error in Fisher Z scale for independent correlations
    const se = Math.sqrt(1 / (n1 - 3) + 1 / (n2 - 3));
    
    // Z-score for the effect in Fisher Z scale
    const z = deltaZ / se;
    
    // Critical value
    const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);
    
    // Power calculation
    let calculatedPower: number;
    if (tails === 'two') {
      // Two-tailed: power on both sides
      const power1 = 1 - normalCDF(za - z);
      const power2 = normalCDF(-za - z);
      calculatedPower = power1 + power2;
    } else {
      // One-tailed
      calculatedPower = 1 - normalCDF(za - z);
    }
    
    // df for comparison of correlations (approximation)
    const df = (n1 - 3) + (n2 - 3);
    
    return {
      power: calculatedPower,
      effectSize: deltaZMag,
      alpha,
      df,
      criticalValue: za,
      testType: 'compare-correlations-independent'
    };
  } else if (n1 && !n2 && !power) {
    // Equal sample sizes (n1 is the shared n)
    if (n1 < 4) {
      throw new Error('Sample size must be at least 4 for correlation comparison');
    }
    
    const deltaZMag = Math.abs(deltaZ);
    
    // Standard error for equal sample sizes in Fisher Z scale
    const se = Math.sqrt(2 / (n1 - 3));
    
    // Z-score for the effect
    const z = deltaZ / se;
    
    // Critical value
    const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);
    
    // Power calculation
    let calculatedPower: number;
    if (tails === 'two') {
      const power1 = 1 - normalCDF(za - z);
      const power2 = normalCDF(-za - z);
      calculatedPower = power1 + power2;
    } else {
      calculatedPower = 1 - normalCDF(za - z);
    }
    
    const df = 2 * (n1 - 3);
    
    return {
      power: calculatedPower,
      effectSize: deltaZMag,
      alpha,
      df,
      criticalValue: za,
      testType: 'compare-correlations-independent'
    };
  } else {
    throw new Error('Provide either power OR sample sizes (n1, n2), not both');
  }
}

/**
 * Calculate power for COMPARISON OF TWO DEPENDENT CORRELATIONS
 * Tests if two correlations from the same sample differ significantly
 * 
 * Uses Steiger's (1980) modification of Hotelling's test.
 * Given correlations r_xy, r_xz (the two correlations to compare)
 * and r_yz (the correlation between the two non-common variables),
 * the test statistic follows a t-distribution.
 * 
 * Effect size is the difference between the two correlations: |r_xy - r_xz|
 * 
 * Reference: Steiger, J. H. (1980). Tests for comparing elements of a correlation matrix.
 *            Psychological Bulletin, 87, 245-251.
 */

/**
 * Power for Steiger's (1980) test of two dependent (overlapping) correlations at a
 * given n, using the noncentral t distribution. This is the single source of truth
 * shared by both the "calculate power" and "calculate sample size" modes so the two
 * modes agree.
 */
function dependentCorrelationsPowerAtN(
  n: number,
  rDiff: number,
  rMean: number,
  ryz: number,
  det: number,
  alpha: number,
  tails: 'one' | 'two'
): number {
  const df = n - 3;
  const numerator = (n - 1) * (1 + ryz);
  const denominator = 2 * ((n - 1) / (n - 3)) * det + rMean * rMean * Math.pow(1 - ryz, 3);
  const ncp = Math.abs(rDiff) * Math.sqrt(numerator / denominator);
  const criticalT = getCriticalValue(alpha, df, tails);
  let p: number;
  if (tails === 'two') {
    p = (1 - noncentralTCDF(criticalT, df, ncp)) + noncentralTCDF(-criticalT, df, ncp);
  } else {
    p = 1 - noncentralTCDF(criticalT, df, ncp);
  }
  return Math.max(0, Math.min(1, p));
}

export function calculatePowerCompareCorrelationsDependent(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, r1, r2, r3, n, tails } = input;
  
  // r1 = r_xy, r2 = r_xz (correlations to compare)
  // r3 = r_yz (correlation between the two non-common variables)
  if (r1 === undefined || r2 === undefined) {
    throw new Error('r₁ (r_xy) and r₂ (r_xz) are required');
  }
  
  if (r1 <= -1 || r1 >= 1) {
    throw new Error('r₁ must be between -1 and 1 (exclusive)');
  }
  if (r2 <= -1 || r2 >= 1) {
    throw new Error('r₂ must be between -1 and 1 (exclusive)');
  }
  
  // r3 defaults to 0 if not provided (assumes uncorrelated predictors)
  const ryz = r3 !== undefined ? r3 : 0;
  if (ryz <= -1 || ryz >= 1) {
    throw new Error('r₃ (r_yz) must be between -1 and 1 (exclusive)');
  }
  
  // Calculate the difference
  const rDiff = r1 - r2;
  
  // Validate that difference is meaningful
  if (Math.abs(rDiff) < 0.0001) {
    throw new Error('A diferença entre as correlações é muito pequena para análise de poder.');
  }
  
  // Mean of the two correlations for Steiger's formula
  const rMean = (r1 + r2) / 2;
  
  // Steiger's determinant formula
  // det = 1 - r1² - r2² - ryz² + 2*r1*r2*ryz
  const det = 1 - r1 * r1 - r2 * r2 - ryz * ryz + 2 * r1 * r2 * ryz;
  
  if (det <= 0) {
    throw new Error('A matriz de correlações não é positiva definida. Verifique os valores de correlação.');
  }
  
  if (power && !n) {
    // Calculate required sample size.
    // Both modes use the SAME Steiger noncentral-t power (dependentCorrelationsPowerAtN),
    // so the returned N achieves the target power when re-checked in "calculate power" mode.
    const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);
    const zb = normalQuantile(power);

    // Fisher Z transformation of the correlations (used only for the starting guess).
    const z1 = fisherZ(r1);
    const z2 = fisherZ(r2);
    const deltaZ = Math.abs(z1 - z2);

    // Closed-form Fisher-Z approximation used only as a starting guess; the search
    // below corrects it against the exact Steiger noncentral-t power.
    const rawN = 2 * (1 - ryz) * Math.pow((za + zb) / deltaZ, 2) + 3;
    let requiredN = Math.max(Math.ceil(rawN), 10);

    const MAX_N = 10_000_000;
    // Walk up until the exact Steiger power reaches the target.
    while (
      requiredN < MAX_N &&
      dependentCorrelationsPowerAtN(requiredN, rDiff, rMean, ryz, det, alpha, tails) < power
    ) {
      requiredN++;
    }
    // Walk down in case the starting guess overshot (smallest N that still meets target).
    while (
      requiredN > 10 &&
      dependentCorrelationsPowerAtN(requiredN - 1, rDiff, rMean, ryz, det, alpha, tails) >= power
    ) {
      requiredN--;
    }

    // df for dependent correlation comparison
    const df = requiredN - 3;

    // Critical t-value
    const criticalT = getCriticalValue(alpha, df, tails);

    return {
      requiredN,
      effectSize: Math.abs(rDiff),
      alpha,
      df,
      criticalValue: criticalT,
      testType: 'compare-correlations-dependent'
    };
  } else if (n && !power) {
    // Calculate power given sample size
    if (n < 10) {
      throw new Error('O tamanho amostral deve ser pelo menos 10 para comparação de correlações dependentes');
    }
    
    const df = n - 3;
    
    // Steiger's (1980) test statistic variance approximation
    // Using Williams' modification of Hotelling's t
    const numerator = (n - 1) * (1 + ryz);
    const denominator = 2 * ((n - 1) / (n - 3)) * det + rMean * rMean * Math.pow(1 - ryz, 3);
    
    // Noncentrality parameter (approximate)
    const ncp = Math.abs(rDiff) * Math.sqrt(numerator / denominator);
    
    // Critical value
    const criticalT = getCriticalValue(alpha, df, tails);
    
    // Calculate power using noncentral t distribution
    let calculatedPower: number;
    if (tails === 'two') {
      const upperPower = 1 - noncentralTCDF(criticalT, df, ncp);
      const lowerPower = noncentralTCDF(-criticalT, df, ncp);
      calculatedPower = upperPower + lowerPower;
    } else {
      calculatedPower = 1 - noncentralTCDF(criticalT, df, ncp);
    }
    
    // Bound power between 0 and 1
    calculatedPower = Math.max(0, Math.min(1, calculatedPower));
    
    return {
      power: calculatedPower,
      effectSize: Math.abs(rDiff),
      alpha,
      df,
      criticalValue: criticalT,
      testType: 'compare-correlations-dependent'
    };
  } else {
    throw new Error('Forneça power OU tamanho amostral (n), não ambos');
  }
}

/**
 * Calculate power for SIMPLE LINEAR REGRESSION
 * Tests if the regression coefficient (slope) differs from zero
 * 
 * Effect size: f² = R² / (1 - R²)
 * where R² is the coefficient of determination
 * 
 * Cohen's conventions for f²:
 * - Small: 0.02
 * - Medium: 0.15
 * - Large: 0.35
 * 
 * The test uses an F-distribution with df1 = 1 (one predictor) and df2 = n - 2
 */
export function calculatePowerSimpleRegression(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, tails } = input;
  
  if (!effectSize && effectSize !== 0) {
    throw new Error('Effect size (f²) is required');
  }
  
  if (effectSize < 0) {
    throw new Error('f² must be non-negative');
  }
  
  // For simple regression: df1 = 1, df2 = n - 2
  const df1 = 1;
  
  if (power && !n) {
    // Calculate required sample size
    // Using F-test approximation
    // λ = f² * n (noncentrality parameter)
    // We need to find n such that power is achieved
    
    const targetPower = power;
    
    // Binary search for sample size
    let low = 4;  // Minimum n for regression
    let high = 10000;
    let requiredN = 50; // Initial guess
    
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      const df2 = mid - 2;
      // Noncentrality parameter: λ = f² × n (for testing if R² differs from zero)
      // This matches G*Power's formula where δ = √(f² × n) for t-test, λ = f² × n for F-test
      const lambda = effectSize * mid;
      
      // Get critical F value
      const criticalF = getFCriticalValue(alpha, df1, df2);
      
      // Calculate power using noncentral F
      const currentPower = 1 - noncentralFCDF(criticalF, df1, df2, lambda);
      
      if (currentPower < targetPower) {
        low = mid;
      } else {
        high = mid;
        requiredN = mid;
      }
    }
    
    // Ensure minimum sample size
    requiredN = Math.max(requiredN, 4);
    
    const df2 = requiredN - 2;
    // For display, use t-critical (equivalent to F-test with df1=1)
    // G*Power shows t-critical from t-distribution with df = n-2
    const tCritical = getCriticalValue(alpha, df2, tails);
    
    return {
      requiredN,
      effectSize,
      alpha,
      df: df2,  // Show residual df (n-2) to match G*Power
      criticalValue: tCritical,  // Show t-critical to match G*Power
      testType: 'regression-simple'
    };
  } else if (n && !power) {
    // Calculate power given sample size
    if (n < 4) {
      throw new Error('Sample size must be at least 4 for simple regression');
    }
    
    const df2 = n - 2;
    
    // Noncentrality parameter: λ = f² × n (for testing if R² differs from zero)
    // This matches G*Power's formula where δ = √(f² × n) for t-test, λ = f² × n for F-test
    const lambda = effectSize * n;
    
    // Critical F value for power calculation
    const criticalF = getFCriticalValue(alpha, df1, df2);
    
    // Calculate power using noncentral F distribution
    const calculatedPower = 1 - noncentralFCDF(criticalF, df1, df2, lambda);
    
    // For display, use t-critical (equivalent to F-test with df1=1)
    const tCritical = getCriticalValue(alpha, df2, tails);
    
    return {
      power: Math.max(0, Math.min(1, calculatedPower)),
      effectSize,
      alpha,
      df: df2,  // Show residual df (n-2) to match G*Power
      criticalValue: tCritical,  // Show t-critical to match G*Power
      testType: 'regression-simple'
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * Calculate power for MULTIPLE LINEAR REGRESSION — overall model (total R²)
 * Tests H0: R² = 0 for a model with p predictors.
 *
 * Effect size: f² = R² / (1 − R²)
 * F-test with df1 = p, df2 = n − p − 1, noncentrality λ = f² × n
 * (Cohen, 1988, ch. 9; matches G*Power "Linear multiple regression: Fixed model, R² deviation from zero")
 */
export function calculatePowerMultipleRegressionTotal(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n } = input;
  const p = input.numPredictors;

  if (effectSize === undefined || effectSize === null) {
    throw new Error('Effect size (f²) is required');
  }
  if (effectSize < 0) {
    throw new Error('f² must be non-negative');
  }
  if (!p || p < 1) {
    throw new Error('Number of predictors must be at least 1');
  }

  const df1 = p;

  if (power && !n) {
    const targetPower = power;
    let low = p + 2; // need df2 = n − p − 1 >= 1
    let high = 1000000;
    let requiredN = low;

    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      const df2 = mid - p - 1;
      const lambda = effectSize * mid;
      const criticalF = getFCriticalValue(alpha, df1, df2);
      const currentPower = 1 - noncentralFCDF(criticalF, df1, df2, lambda);
      if (currentPower < targetPower) {
        low = mid;
      } else {
        high = mid;
        requiredN = mid;
      }
    }

    requiredN = Math.max(requiredN, p + 2);
    const df2 = requiredN - p - 1;
    const criticalF = getFCriticalValue(alpha, df1, df2);

    return {
      requiredN,
      effectSize,
      alpha,
      df: df1,
      df2,
      criticalValue: criticalF,
      numPredictors: p,
      testType: 'regression-multiple-total'
    };
  } else if (n && !power) {
    if (n < p + 2) {
      throw new Error('Sample size must be greater than the number of predictors plus one');
    }
    const df2 = n - p - 1;
    const lambda = effectSize * n;
    const criticalF = getFCriticalValue(alpha, df1, df2);
    const calculatedPower = 1 - noncentralFCDF(criticalF, df1, df2, lambda);

    return {
      power: Math.max(0, Math.min(1, calculatedPower)),
      effectSize,
      alpha,
      df: df1,
      df2,
      criticalValue: criticalF,
      numPredictors: p,
      testType: 'regression-multiple-total'
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * Calculate power for MULTIPLE LINEAR REGRESSION — increment of R² (hierarchical)
 * Tests whether a block of q predictors adds significant variance over the others.
 *
 * Effect size: f² = (R²_full − R²_reduced) / (1 − R²_full)
 * F-test with df1 = q (tested predictors), df2 = n − p − 1 (p = total predictors),
 * noncentrality λ = f² × n
 * (Cohen, 1988, ch. 9; matches G*Power "Linear multiple regression: Fixed model, R² increase")
 */
export function calculatePowerMultipleRegressionIncrement(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n } = input;
  const p = input.numPredictors;       // total predictors in the full model
  const q = input.numTestedPredictors; // predictors being tested (the increment)

  if (effectSize === undefined || effectSize === null) {
    throw new Error('Effect size (f²) is required');
  }
  if (effectSize < 0) {
    throw new Error('f² must be non-negative');
  }
  if (!p || p < 1) {
    throw new Error('Number of predictors must be at least 1');
  }
  if (!q || q < 1) {
    throw new Error('Number of tested predictors must be at least 1');
  }
  if (q > p) {
    throw new Error('Number of tested predictors cannot exceed total predictors');
  }

  const df1 = q;

  if (power && !n) {
    const targetPower = power;
    let low = p + 2;
    let high = 1000000;
    let requiredN = low;

    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      const df2 = mid - p - 1;
      const lambda = effectSize * mid;
      const criticalF = getFCriticalValue(alpha, df1, df2);
      const currentPower = 1 - noncentralFCDF(criticalF, df1, df2, lambda);
      if (currentPower < targetPower) {
        low = mid;
      } else {
        high = mid;
        requiredN = mid;
      }
    }

    requiredN = Math.max(requiredN, p + 2);
    const df2 = requiredN - p - 1;
    const criticalF = getFCriticalValue(alpha, df1, df2);

    return {
      requiredN,
      effectSize,
      alpha,
      df: df1,
      df2,
      criticalValue: criticalF,
      numPredictors: p,
      numTestedPredictors: q,
      testType: 'regression-multiple-increment'
    };
  } else if (n && !power) {
    if (n < p + 2) {
      throw new Error('Sample size must be greater than the number of predictors plus one');
    }
    const df2 = n - p - 1;
    const lambda = effectSize * n;
    const criticalF = getFCriticalValue(alpha, df1, df2);
    const calculatedPower = 1 - noncentralFCDF(criticalF, df1, df2, lambda);

    return {
      power: Math.max(0, Math.min(1, calculatedPower)),
      effectSize,
      alpha,
      df: df1,
      df2,
      criticalValue: criticalF,
      numPredictors: p,
      numTestedPredictors: q,
      testType: 'regression-multiple-increment'
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * Predictor (X) distribution for the logistic-regression power procedure
 * (Demidenko 2007 — the G*Power 3.1 default). G*Power lets X follow several
 * distributions; we support Normal (default), Binomial (a Bernoulli 0/1
 * predictor), Exponential, Lognormal and Poisson.
 */
export type LogisticXDistribution =
  | { kind: 'normal'; mu: number; sigma: number }
  | { kind: 'lognormal'; mu: number; sigma: number }
  | { kind: 'exponential'; lambda: number }
  | { kind: 'binomial'; pi: number }
  | { kind: 'poisson'; lambda: number };

/**
 * Resolve the predictor distribution from the input, filling in G*Power's
 * default parameter values when they are not provided.
 *   Normal:      µ = 0, σ = 1
 *   Lognormal:   µ = 0, σ = 1   (µ, σ are the mean/SD of ln X)
 *   Exponential: λ = 1          (λ is the mean: f(x) = (1/λ)·e^{−x/λ})
 *   Binomial:    π = 0.5        (Bernoulli predictor, X ∈ {0, 1})
 *   Poisson:     λ = 1          (λ is the mean)
 */
function resolveLogisticXDistribution(input: PowerAnalysisInput): LogisticXDistribution {
  const kind = input.xDistribution ?? 'normal';
  switch (kind) {
    case 'normal':
      return { kind: 'normal', mu: input.xDistMu ?? 0, sigma: input.xDistSigma ?? 1 };
    case 'lognormal':
      return { kind: 'lognormal', mu: input.xDistMu ?? 0, sigma: input.xDistSigma ?? 1 };
    case 'exponential':
      return { kind: 'exponential', lambda: input.xDistLambda ?? 1 };
    case 'binomial':
      return { kind: 'binomial', pi: input.xDistPi ?? 0.5 };
    case 'poisson':
      return { kind: 'poisson', lambda: input.xDistLambda ?? 1 };
    default:
      throw new Error('Invalid X distribution');
  }
}

/** Validate the predictor-distribution parameters. */
function validateLogisticXDistribution(dist: LogisticXDistribution): void {
  switch (dist.kind) {
    case 'normal':
    case 'lognormal':
      if (!(dist.sigma > 0)) {
        throw new Error('X distribution σ must be positive');
      }
      break;
    case 'exponential':
    case 'poisson':
      if (!(dist.lambda > 0)) {
        throw new Error('X distribution λ must be positive');
      }
      break;
    case 'binomial':
      if (!(dist.pi > 0 && dist.pi < 1)) {
        throw new Error('X distribution π must be between 0 and 1 (exclusive)');
      }
      break;
  }
}

/**
 * Serialize the resolved predictor distribution's parameters for the result
 * payload, so saved results can display the exact distribution AND the
 * parameter values that were used (µ/σ for normal & lognormal, π for binomial,
 * λ for exponential & poisson).
 */
function logisticXDistParams(
  dist: LogisticXDistribution,
): Pick<PowerAnalysisResult, 'xDistMu' | 'xDistSigma' | 'xDistPi' | 'xDistLambda'> {
  switch (dist.kind) {
    case 'normal':
    case 'lognormal':
      return { xDistMu: dist.mu, xDistSigma: dist.sigma };
    case 'exponential':
    case 'poisson':
      return { xDistLambda: dist.lambda };
    case 'binomial':
      return { xDistPi: dist.pi };
  }
}

/**
 * Expectation E[g(X)] of a function g over the predictor distribution.
 * Continuous distributions use composite Simpson's rule; discrete ones sum over
 * the support. The Normal case integrates over [µ−10σ, µ+10σ] with 2000
 * intervals — identical to the original standard-normal routine, so the Normal
 * predictor reproduces the previous results exactly. The Lognormal uses the
 * substitution X = e^{µ+σZ}, Z ~ N(0, 1), which avoids its long-tail numerics.
 * (For discrete predictors the Fisher-information integrals become sums.)
 */
function logisticExpectation(dist: LogisticXDistribution, g: (x: number) => number): number {
  const invSqrt2Pi = 1 / Math.sqrt(2 * Math.PI);
  const simpson = (lo: number, hi: number, steps: number, integrand: (x: number) => number): number => {
    const h = (hi - lo) / steps;
    let sum = 0;
    for (let k = 0; k <= steps; k++) {
      const x = lo + k * h;
      const coef = k === 0 || k === steps ? 1 : k % 2 === 1 ? 4 : 2;
      sum += coef * integrand(x);
    }
    return (sum * h) / 3;
  };

  switch (dist.kind) {
    case 'normal': {
      const { mu, sigma } = dist;
      return simpson(mu - 10 * sigma, mu + 10 * sigma, 2000, (x) => {
        const z = (x - mu) / sigma;
        const f = (invSqrt2Pi / sigma) * Math.exp(-(z * z) / 2);
        return f * g(x);
      });
    }
    case 'lognormal': {
      const { mu, sigma } = dist;
      return simpson(-10, 10, 2000, (z) => {
        const phi = invSqrt2Pi * Math.exp(-(z * z) / 2);
        return phi * g(Math.exp(mu + sigma * z));
      });
    }
    case 'exponential': {
      // mean = λ (scale): f(x) = (1/λ)·e^{−x/λ}, x ≥ 0.
      const { lambda } = dist;
      return simpson(0, 50 * lambda, 6000, (x) => {
        const f = (1 / lambda) * Math.exp(-x / lambda);
        return f * g(x);
      });
    }
    case 'binomial': {
      // Bernoulli predictor X ∈ {0, 1} with P(X = 1) = π.
      const { pi } = dist;
      return (1 - pi) * g(0) + pi * g(1);
    }
    case 'poisson': {
      // mean = λ: P(X = k) = λ^k·e^{−λ}/k!, k = 0, 1, 2, …
      const { lambda } = dist;
      const kMax = Math.ceil(lambda + 12 * Math.sqrt(lambda) + 40);
      let pmf = Math.exp(-lambda); // P(0)
      let sum = pmf * g(0);
      for (let k = 1; k <= kMax; k++) {
        pmf *= lambda / k;
        sum += pmf * g(k);
      }
      return sum;
    }
  }
}

/**
 * Variance of the ML estimate β̂₁ (per single observation) in a logistic
 * regression logit(P) = β₀ + β₁·X. The (2×2) per-observation Fisher information
 * has entries i_{jk} = E[ X^{j+k} · p(X)·(1 − p(X)) ] with
 * p(X) = 1/(1 + e^{−(β₀+β₁X)}), and Var(β̂₁) = i₀₀ / (i₀₀·i₁₁ − i₀₁²). The
 * expectations are taken over the chosen predictor distribution.
 */
function logisticBeta1Variance(beta0: number, beta1: number, dist: LogisticXDistribution): number {
  const w = (x: number): number => {
    const p = 1 / (1 + Math.exp(-(beta0 + beta1 * x)));
    return p * (1 - p);
  };
  const i00 = logisticExpectation(dist, (x) => w(x));
  const i01 = logisticExpectation(dist, (x) => x * w(x));
  const i11 = logisticExpectation(dist, (x) => x * x * w(x));
  return i00 / (i00 * i11 - i01 * i01);
}

/**
 * Marginal event probability µ = E[ p(X) ] under H1, taken over the predictor
 * distribution.
 */
function logisticMarginalProbability(beta0: number, beta1: number, dist: LogisticXDistribution): number {
  return logisticExpectation(dist, (x) => 1 / (1 + Math.exp(-(beta0 + beta1 * x))));
}

/**
 * Variance-correction factor a (G*Power manual eq. 15). With variance
 * correction (G*Power's default) a = 0.75 for the lognormal, a = 0.85 for the
 * binomial, and a = 1 — i.e. s₁ = √(v₀/v₁) — for all other distributions
 * (normal, exponential, poisson, uniform). It compensates for the finite-sample
 * variance distortion that occurs for skewed X distributions.
 */
function logisticVarianceCorrectionA(dist: LogisticXDistribution): number {
  if (dist.kind === 'lognormal') return 0.75;
  if (dist.kind === 'binomial') return 0.85;
  return 1;
}

/**
 * Calculate power/sample size for LOGISTIC REGRESSION with a single continuous,
 * standard-normally distributed predictor, using the procedure of
 * Demidenko (2007) WITH variance correction — the default large-sample method
 * in G*Power 3.1.
 *
 * Effect size: the odds ratio (OR) for a one-SD increase in the predictor.
 *
 * The Wald statistic z = β̂₁ / SE(β̂₁) is asymptotically N(0, 1) under H0 and
 * N(m₁, s₁) under H1, with (G*Power manual, eqs. 14–15):
 *   m₁ = √(N / v₁) · β₁
 *   s₁ = √(v₀ / v₁)          (variance correction, a = 1 for the normal X)
 * where v₁ = Var(β̂₁) under H1 and v₀ = Var(β̂₁) under H0 evaluated at the
 * intercept b₀* = ln(µ/(1−µ)) with µ the marginal event probability under H1.
 *
 * Solving the power equation gives
 *   N = (z_{1−α(/2)}·√v₁ + z_{1−β}·√v₀)² / (β₁)²
 * which reproduces G*Power's results exactly (e.g. OR=1.3, P=0.5, one-tailed,
 * α=.05, power=.80 → N=372; OR=1.5, P=0.5, two-tailed, α=.05, power=.95 → 337).
 */
export function calculatePowerLogisticRegression(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, tails } = input;
  const P = input.baseProportion;

  if (effectSize === undefined || effectSize === null) {
    throw new Error('Odds ratio is required');
  }
  if (effectSize <= 0) {
    throw new Error('Odds ratio must be positive');
  }
  if (effectSize === 1) {
    throw new Error('Odds ratio must differ from 1');
  }
  if (P === undefined || P === null) {
    throw new Error('Baseline event probability is required');
  }
  if (P <= 0 || P >= 1) {
    throw new Error('Baseline event probability must be between 0 and 1 (exclusive)');
  }

  const dist = resolveLogisticXDistribution(input);
  validateLogisticXDistribution(dist);

  const beta1 = Math.log(effectSize);
  // P is the event probability at the predictor mean, so β₀ = logit(P).
  const beta0 = Math.log(P / (1 - P));

  // Variance of β̂₁ under H1 (full model with β₁ ≠ 0).
  const v1 = logisticBeta1Variance(beta0, beta1, dist);
  // Variance of β̂₁ under H0: marginal probability under H1 defines the null
  // intercept b₀* = logit(µ), then β₁ = 0.
  const mu = logisticMarginalProbability(beta0, beta1, dist);
  const b0Star = Math.log(mu / (1 - mu));
  const v0 = logisticBeta1Variance(b0Star, 0, dist);

  // Variance correction (G*Power manual eq. 15): s₁ = √((a·v₀ + (1−a)·v₁)/v₁).
  const a = logisticVarianceCorrectionA(dist);
  const s1 = Math.sqrt((a * v0 + (1 - a) * v1) / v1);

  const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);

  if (power && !n) {
    const zb = normalQuantile(power);
    // m₁ = √(N/v₁)·β₁ = za + zb·s₁  ⇒  N = v₁·(za + zb·s₁)² / β₁².
    const nRaw = (v1 * Math.pow(za + zb * s1, 2)) / (beta1 * beta1);
    const requiredN = Math.max(Math.ceil(nRaw), 1);

    return {
      requiredN,
      effectSize,
      alpha,
      df: 0,
      criticalValue: za,
      baseProportion: P,
      xDistribution: dist.kind,
      ...logisticXDistParams(dist),
      testType: 'logistic-regression'
    };
  } else if (n && !power) {
    if (n < 1) {
      throw new Error('Sample size must be positive');
    }
    // Under H1 the Wald statistic ~ N(m₁, s₁).
    const m1 = Math.sqrt(n / v1) * Math.abs(beta1);
    let calculatedPower = normalCDF((m1 - za) / s1);
    if (tails === 'two') {
      calculatedPower += normalCDF((-m1 - za) / s1);
    }

    return {
      power: Math.max(0, Math.min(1, calculatedPower)),
      effectSize,
      alpha,
      df: 0,
      criticalValue: za,
      baseProportion: P,
      xDistribution: dist.kind,
      ...logisticXDistParams(dist),
      testType: 'logistic-regression'
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * Calculate power/sample size for MULTIPLE LOGISTIC REGRESSION: a continuous,
 * standard-normal predictor of interest accompanied by other covariates.
 *
 * It reuses the Demidenko (2007) WITH variance-correction base (see
 * calculatePowerLogisticRegression) and applies the Hsieh, Bloch & Larsen
 * (1998) correction for the influence of the other covariates:
 *   N' = N / (1 − R²)
 * where R² = ρ²₁·₂₃...ₚ is the squared multiple correlation of the predictor of
 * interest (X₁) with the remaining covariates (X₂, …, Xₚ). This is exactly the
 * (1 − R²) factor that appears inside m₁ in the G*Power manual (eq. 14):
 *   m₁ = √(N(1 − R²)/v₁) · β₁ ,  s₁ = √(v₀/v₁)   (a = 1 for the normal X).
 *
 * Effect size: the odds ratio (OR) for a one-SD increase in the predictor.
 * With R² = 0 this reduces to the single-predictor logistic regression.
 */
export function calculatePowerMultipleLogisticRegression(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, tails } = input;
  const P = input.baseProportion;
  const R2 = input.r2OtherPredictors ?? 0;

  if (effectSize === undefined || effectSize === null) {
    throw new Error('Odds ratio is required');
  }
  if (effectSize <= 0) {
    throw new Error('Odds ratio must be positive');
  }
  if (effectSize === 1) {
    throw new Error('Odds ratio must differ from 1');
  }
  if (P === undefined || P === null) {
    throw new Error('Baseline event probability is required');
  }
  if (P <= 0 || P >= 1) {
    throw new Error('Baseline event probability must be between 0 and 1 (exclusive)');
  }
  if (R2 < 0 || R2 >= 1) {
    throw new Error('R² of other predictors must be between 0 and 1 (1 exclusive)');
  }

  const dist = resolveLogisticXDistribution(input);
  validateLogisticXDistribution(dist);

  const beta1 = Math.log(effectSize);
  // P is the event probability at the predictor mean, so β₀ = logit(P).
  const beta0 = Math.log(P / (1 - P));

  // Variance of β̂₁ under H1 (full model with β₁ ≠ 0).
  const v1 = logisticBeta1Variance(beta0, beta1, dist);
  // Variance of β̂₁ under H0: marginal probability under H1 defines the null
  // intercept b₀* = logit(µ), then β₁ = 0.
  const mu = logisticMarginalProbability(beta0, beta1, dist);
  const b0Star = Math.log(mu / (1 - mu));
  const v0 = logisticBeta1Variance(b0Star, 0, dist);

  // Variance correction (G*Power manual eq. 15): s₁ = √((a·v₀ + (1−a)·v₁)/v₁).
  const a = logisticVarianceCorrectionA(dist);
  const s1 = Math.sqrt((a * v0 + (1 - a) * v1) / v1);

  const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);

  if (power && !n) {
    const zb = normalQuantile(power);
    // m₁ = √(N(1−R²)/v₁)·β₁ = za + zb·s₁ and the Hsieh (1998) correction for
    // additional covariates ⇒ N = v₁·(za + zb·s₁)² / (β₁²·(1 − R²)).
    const nRaw = (v1 * Math.pow(za + zb * s1, 2)) / (beta1 * beta1 * (1 - R2));
    const requiredN = Math.max(Math.ceil(nRaw), 1);

    return {
      requiredN,
      effectSize,
      alpha,
      df: 0,
      criticalValue: za,
      baseProportion: P,
      r2OtherPredictors: R2,
      xDistribution: dist.kind,
      ...logisticXDistParams(dist),
      testType: 'multiple-logistic-regression'
    };
  } else if (n && !power) {
    if (n < 1) {
      throw new Error('Sample size must be positive');
    }
    // Variance inflation by 1/(1 − R²) ⇒ effective sample size n(1 − R²) in m₁.
    const m1 = Math.sqrt((n * (1 - R2)) / v1) * Math.abs(beta1);
    let calculatedPower = normalCDF((m1 - za) / s1);
    if (tails === 'two') {
      calculatedPower += normalCDF((-m1 - za) / s1);
    }

    return {
      power: Math.max(0, Math.min(1, calculatedPower)),
      effectSize,
      alpha,
      df: 0,
      criticalValue: za,
      baseProportion: P,
      r2OtherPredictors: R2,
      xDistribution: dist.kind,
      ...logisticXDistParams(dist),
      testType: 'multiple-logistic-regression'
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * Per-observation variance of β̂₁ in a Poisson regression
 * log(µ(X)) = β₀ + β₁·X (with the mean exposure t folded into the rate). The
 * (2×2) Fisher information has entries i_{jk} = E[ X^{j+k} · w(X) ] with the
 * Poisson weight w(X) = µ(X) = exp(β₀ + β₁·X)·t (Poisson variance = mean), and
 * Var(β̂₁) = i₀₀ / (i₀₀·i₁₁ − i₀₁²). Expectations are taken over the chosen
 * predictor distribution. This is the Poisson analogue of logisticBeta1Variance
 * (only the weight changes from p(1−p) to the mean µ(X)).
 */
function poissonBeta1Variance(beta0: number, beta1: number, t: number, dist: LogisticXDistribution): number {
  const w = (x: number): number => Math.exp(beta0 + beta1 * x) * t;
  const i00 = logisticExpectation(dist, (x) => w(x));
  const i01 = logisticExpectation(dist, (x) => x * w(x));
  const i11 = logisticExpectation(dist, (x) => x * x * w(x));
  return i00 / (i00 * i11 - i01 * i01);
}

/**
 * Marginal mean event rate µ = E[ exp(β₀ + β₁·X)·t ] under H1, over the
 * predictor distribution. Used to set the null intercept b₀* = ln(µ/t).
 */
function poissonMarginalMean(beta0: number, beta1: number, t: number, dist: LogisticXDistribution): number {
  return logisticExpectation(dist, (x) => Math.exp(beta0 + beta1 * x) * t);
}

/**
 * Calculate power/sample size for POISSON REGRESSION with a single predictor,
 * using the procedure of Demidenko (2007) WITH variance correction — the
 * default large-sample method in G*Power 3.1 ("Poisson regression").
 *
 * Effect size: the rate ratio RR = exp(β₁) for a one-unit increase in X.
 *
 * Like the logistic procedure, the Wald statistic z = β̂₁ / SE(β̂₁) is
 * asymptotically N(0, 1) under H0 and N(m₁, s₁) under H1 with
 *   m₁ = √(N(1 − R²)/v₁) · β₁ ,  s₁ = √((a·v₀ + (1−a)·v₁)/v₁)
 * where v₁ = Var(β̂₁) under H1 and v₀ = Var(β̂₁) under H0 (β₁ = 0 at the null
 * intercept b₀* = ln(µ/t), µ the marginal mean rate under H1). The Poisson
 * weight in the Fisher information is the mean µ(X) = exp(β₀ + β₁X)·t. Solving
 * the power equation gives
 *   N = v₁·(z_{1−α(/2)} + z_{1−β}·s₁)² / (β₁²·(1 − R²)).
 * R² is the squared multiple correlation of the predictor of interest with the
 * other covariates (Hsieh 1998 correction); R² = 0 ⇒ single predictor. The mean
 * exposure t is fixed at 1 (G*Power's default) and absorbed by the base rate.
 *
 * This reproduces G*Power exactly, e.g. RR=1.3, two-tailed, α=.05, power=.80,
 * base rate exp(β₀)=0.85, X ~ N(0, 1), R²=0 → N=130, actual power=0.8011838.
 */
export function calculatePowerPoissonRegression(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, tails } = input;
  const baseRate = input.baseRate;
  const R2 = input.r2OtherPredictors ?? 0;
  const t = 1; // mean exposure (G*Power default); exp(β₀) is encoded by baseRate

  if (effectSize === undefined || effectSize === null) {
    throw new Error('Rate ratio is required');
  }
  if (effectSize <= 0) {
    throw new Error('Rate ratio must be positive');
  }
  if (effectSize === 1) {
    throw new Error('Rate ratio must differ from 1');
  }
  if (baseRate === undefined || baseRate === null) {
    throw new Error('Baseline event rate is required');
  }
  if (baseRate <= 0) {
    throw new Error('Baseline event rate must be positive');
  }
  if (R2 < 0 || R2 >= 1) {
    throw new Error('R² of other predictors must be between 0 and 1 (1 exclusive)');
  }

  const dist = resolveLogisticXDistribution(input);
  validateLogisticXDistribution(dist);

  const beta1 = Math.log(effectSize);
  // baseRate is the mean event rate at the predictor mean ⇒ β₀ = ln(baseRate).
  const beta0 = Math.log(baseRate);

  // For RR > 1 (β₁ > 0) the expected Poisson count E[exp(β₀+β₁X)] is the moment
  // generating function of X at β₁. For the lognormal it NEVER exists, and for
  // the exponential (scale λ) it exists only when β₁·λ < 1. Outside those ranges
  // the Fisher information diverges, so reject analytically rather than returning
  // a truncation-dependent (wrong) number or NaN.
  if (beta1 > 0) {
    if (dist.kind === 'lognormal' || (dist.kind === 'exponential' && beta1 * dist.lambda >= 1)) {
      throw new Error('Predictor distribution leads to an undefined expected count for this rate ratio');
    }
  }

  // Variance of β̂₁ under H1 (full model with β₁ ≠ 0).
  const v1 = poissonBeta1Variance(beta0, beta1, t, dist);
  // Variance of β̂₁ under H0: the marginal mean rate under H1 sets the null
  // intercept b₀* = ln(µ/t), then β₁ = 0.
  const mu = poissonMarginalMean(beta0, beta1, t, dist);
  const b0Star = Math.log(mu / t);
  const v0 = poissonBeta1Variance(b0Star, 0, t, dist);

  // Variance correction (G*Power manual eq. 15): s₁ = √((a·v₀ + (1−a)·v₁)/v₁).
  const a = logisticVarianceCorrectionA(dist);
  const s1 = Math.sqrt((a * v0 + (1 - a) * v1) / v1);

  // Heavy-tailed predictors (lognormal always; exponential when β₁·escala ≥ 1)
  // make the expected count E[exp(β₀+β₁X)] diverge to infinity, so the Fisher
  // information and these variances are mathematically undefined. Fail loudly
  // instead of returning NaN to the API.
  if (!Number.isFinite(v1) || !Number.isFinite(v0) || !Number.isFinite(mu) || !Number.isFinite(s1) || v1 <= 0) {
    throw new Error('Predictor distribution leads to an undefined expected count for this rate ratio');
  }

  const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);

  if (power && !n) {
    const zb = normalQuantile(power);
    // m₁ = √(N(1−R²)/v₁)·β₁ = za + zb·s₁ ⇒ N = v₁·(za + zb·s₁)²/(β₁²·(1 − R²)).
    const nRaw = (v1 * Math.pow(za + zb * s1, 2)) / (beta1 * beta1 * (1 - R2));
    const requiredN = Math.max(Math.ceil(nRaw), 1);

    return {
      requiredN,
      effectSize,
      alpha,
      df: 0,
      criticalValue: za,
      baseRate,
      r2OtherPredictors: R2,
      xDistribution: dist.kind,
      ...logisticXDistParams(dist),
      testType: 'poisson-regression'
    };
  } else if (n && !power) {
    if (n < 1) {
      throw new Error('Sample size must be positive');
    }
    // Under H1 the Wald statistic ~ N(m₁, s₁), with the 1/(1 − R²) inflation.
    const m1 = Math.sqrt((n * (1 - R2)) / v1) * Math.abs(beta1);
    let calculatedPower = normalCDF((m1 - za) / s1);
    if (tails === 'two') {
      calculatedPower += normalCDF((-m1 - za) / s1);
    }

    return {
      power: Math.max(0, Math.min(1, calculatedPower)),
      effectSize,
      alpha,
      df: 0,
      criticalValue: za,
      baseRate,
      r2OtherPredictors: R2,
      xDistribution: dist.kind,
      ...logisticXDistParams(dist),
      testType: 'poisson-regression'
    };
  } else {
    throw new Error('Provide either power OR sample size (n), not both');
  }
}

/**
 * Generate power curve for correlations
 * Shows relationship between sample size and statistical power
 */
export function generatePowerCurveCorrelations(
  effectSize: number,
  alpha: number,
  testType: 'pearson-correlation' | 'spearman-correlation' | 'kendall-correlation' | 'compare-correlations-independent',
  tails: 'one' | 'two',
  maxN: number = 200
): Array<{ n: number; power: number }> {
  const curve: Array<{ n: number; power: number }> = [];
  
  // Generate curve from n=5 to maxN
  for (let n = 5; n <= maxN; n++) {
    try {
      const input: PowerAnalysisInput = {
        alpha,
        effectSize,
        n,
        tails
      };
      
      let result: PowerAnalysisResult;
      if (testType === 'pearson-correlation') {
        result = calculatePowerPearsonCorrelation(input);
      } else if (testType === 'spearman-correlation') {
        result = calculatePowerSpearmanCorrelation(input);
      } else if (testType === 'kendall-correlation') {
        result = calculatePowerKendallCorrelation(input);
      } else if (testType === 'compare-correlations-independent') {
        // For comparison test, n represents equal sample sizes
        result = calculatePowerCompareCorrelationsIndependent({
          alpha,
          effectSize,
          n1: n,
          tails
        });
      } else {
        continue;
      }
      
      if (result.power !== undefined) {
        curve.push({ n, power: result.power });
      }
    } catch (error) {
      // Skip invalid configurations
      continue;
    }
  }
  
  return curve;
}

/**
 * Generate power curve data varying the effect size (correlation r) at a fixed N.
 * Used by the sensitivity calculation mode (have-n-effect). Reuses the same
 * post-hoc power functions; no math changes. Only the single-correlation tests
 * are supported (the comparison test has no single scalar effect size).
 */
export function generateEffectSizeCurveCorrelations(
  n: number,
  alpha: number,
  testType: 'pearson-correlation' | 'spearman-correlation' | 'kendall-correlation',
  tails: 'one' | 'two',
  maxEffect: number
): Array<{ effectSize: number; power: number }> {
  const curve: Array<{ effectSize: number; power: number }> = [];
  // Correlations are bounded by |r| < 1; keep the range strictly inside.
  const safeMax = Math.min(Math.max(maxEffect, 0.1), 0.99);
  const step = safeMax / 50;

  for (let es = step; es <= safeMax + step / 2; es += step) {
    try {
      const input: PowerAnalysisInput = {
        alpha,
        effectSize: es,
        n,
        tails
      };

      let result: PowerAnalysisResult;
      if (testType === 'pearson-correlation') {
        result = calculatePowerPearsonCorrelation(input);
      } else if (testType === 'spearman-correlation') {
        result = calculatePowerSpearmanCorrelation(input);
      } else if (testType === 'kendall-correlation') {
        result = calculatePowerKendallCorrelation(input);
      } else {
        continue;
      }

      if (result.power !== undefined) {
        curve.push({ effectSize: es, power: result.power });
      }
    } catch (error) {
      continue;
    }
  }

  return curve;
}
