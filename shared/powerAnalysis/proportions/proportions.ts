/**
 * Power Analysis for Proportion Tests
 * 
 * Implements power calculations for:
 * - One-sample proportion test (binomial/z-test)
 * - Two independent proportions (z-test)
 * 
 * Effect size: Cohen's h = 2 * arcsin(√p1) - 2 * arcsin(√p2)
 * Conventions: small = 0.2, medium = 0.5, large = 0.8
 */

import type { PowerAnalysisInput, PowerAnalysisResult } from '../types';
import { normalCDF, normalQuantile, getChiSquareCriticalValue, calculatePowerChiSquareFromNCP } from '../utils';

/**
 * Calculate Cohen's h effect size for proportions
 * h = 2 * arcsin(√p1) - 2 * arcsin(√p2)
 * 
 * For one-sample test: p2 is the null hypothesis proportion (p0)
 * For two-sample test: p1 and p2 are the two proportions being compared
 */
export function cohensH(p1: number, p2: number): number {
  const phi1 = 2 * Math.asin(Math.sqrt(p1));
  const phi2 = 2 * Math.asin(Math.sqrt(p2));
  return phi1 - phi2;
}

/**
 * Calculate power for ONE-SAMPLE PROPORTION TEST
 * Tests if an observed proportion differs from a hypothesized value
 * 
 * Uses exact binomial or normal approximation (z-test)
 * G*Power: "Exact - Proportion: Difference from constant (binomial test, one sample case)"
 * 
 * Effect size: Cohen's h = 2 * arcsin(√p1) - 2 * arcsin(√p0)
 * where p1 = expected proportion, p0 = null hypothesis proportion
 */
export function calculatePowerOneSampleProportion(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, tails } = input;
  
  if (!effectSize && effectSize !== 0) {
    throw new Error('Effect size (Cohen\'s h) is required');
  }
  
  const h = Math.abs(effectSize);
  
  if (power && !n) {
    // Calculate required sample size given power
    // Formula: n = (z_α + z_β)² / h²
    // For two-tailed: z_α = z_(α/2)
    
    const zAlpha = tails === 'two' 
      ? normalQuantile(1 - alpha / 2) 
      : normalQuantile(1 - alpha);
    const zBeta = normalQuantile(power);
    
    // Sample size formula for one-sample proportion
    const requiredN = Math.ceil(Math.pow((zAlpha + zBeta) / h, 2));
    
    // Critical z-value
    const criticalZ = zAlpha;
    
    return {
      requiredN: Math.max(requiredN, 5), // Minimum sample size
      effectSize: h,
      alpha,
      df: requiredN - 1,
      criticalValue: criticalZ,
      testType: 'proportion-one-sample'
    };
  } else if (n && !power) {
    // Calculate power given sample size
    if (n < 5) {
      throw new Error('Sample size must be at least 5 for proportion test');
    }
    
    const zAlpha = tails === 'two' 
      ? normalQuantile(1 - alpha / 2) 
      : normalQuantile(1 - alpha);
    
    // Noncentrality parameter: h * √n
    const ncp = h * Math.sqrt(n);
    
    // Power calculation
    let calculatedPower: number;
    if (tails === 'two') {
      // Two-tailed: P(Z > z_α - ncp) + P(Z < -z_α - ncp)
      const upperPower = 1 - normalCDF(zAlpha - ncp);
      const lowerPower = normalCDF(-zAlpha - ncp);
      calculatedPower = upperPower + lowerPower;
    } else {
      // One-tailed
      calculatedPower = 1 - normalCDF(zAlpha - ncp);
    }
    
    return {
      power: Math.max(0, Math.min(1, calculatedPower)),
      effectSize: h,
      alpha,
      df: n - 1,
      criticalValue: zAlpha,
      testType: 'proportion-one-sample'
    };
  } else {
    throw new Error('Forneça power OU tamanho amostral (n), não ambos');
  }
}

/**
 * Calculate power for TWO INDEPENDENT PROPORTIONS (Z-TEST)
 * Tests if two proportions from independent samples differ
 * 
 * G*Power: "Proportions: Difference between two independent proportions"
 * 
 * Effect size: Cohen's h = 2 * arcsin(√p1) - 2 * arcsin(√p2)
 * 
 * The test uses a z-test with pooled variance estimate
 */
export function calculatePowerTwoProportions(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, tails, allocationRatio = 1 } = input;
  
  if (!effectSize && effectSize !== 0) {
    throw new Error('Effect size (Cohen\'s h) is required');
  }
  
  const h = Math.abs(effectSize);
  const k = allocationRatio; // n2/n1 ratio
  
  if (power && !n) {
    // Calculate required sample size per group
    // For two independent proportions:
    // n per group = (z_α + z_β)² / h² (for equal groups)
    // For unequal allocation (k = n2/n1):
    // n1 = (z_α + z_β)² / h² × (1 + 1/k) / 2
    // n2 = k × n1
    
    const zAlpha = tails === 'two' 
      ? normalQuantile(1 - alpha / 2) 
      : normalQuantile(1 - alpha);
    const zBeta = normalQuantile(power);
    
    // Sample size for group 1
    // Formula accounts for allocation ratio
    const n1 = Math.pow((zAlpha + zBeta), 2) * (1 + 1/k) / (2 * Math.pow(h, 2));
    const n2 = n1 * k;
    
    // Total sample size
    const totalN = Math.ceil(n1) + Math.ceil(n2);
    
    // Critical z-value
    const criticalZ = zAlpha;
    
    return {
      requiredN: totalN,
      n1: Math.ceil(n1),
      n2: Math.ceil(n2),
      effectSize: h,
      alpha,
      df: totalN - 2, // For z-test, df approaches infinity, but we report n-2 for reference
      criticalValue: criticalZ,
      testType: 'two-proportions'
    };
  } else if (n && !power) {
    // Calculate power given total sample size
    // Assume equal groups if allocation ratio is 1
    const n1 = Math.floor(n / (1 + k));
    const n2 = n - n1;
    
    if (n1 < 5 || n2 < 5) {
      throw new Error('Each group must have at least 5 observations');
    }
    
    const zAlpha = tails === 'two' 
      ? normalQuantile(1 - alpha / 2) 
      : normalQuantile(1 - alpha);
    
    // Effective sample size for unequal groups
    // n_eff = (n1 * n2) / (n1 + n2) = harmonic mean / 2
    const nEff = (n1 * n2) / (n1 + n2);
    
    // Noncentrality parameter: h * √(2 * n_eff) for equal groups
    // For unequal groups: h * √(n1 * n2 / (n1 + n2))
    const ncp = h * Math.sqrt(2 * nEff);
    
    // Power calculation
    let calculatedPower: number;
    if (tails === 'two') {
      const upperPower = 1 - normalCDF(zAlpha - ncp);
      const lowerPower = normalCDF(-zAlpha - ncp);
      calculatedPower = upperPower + lowerPower;
    } else {
      calculatedPower = 1 - normalCDF(zAlpha - ncp);
    }
    
    return {
      power: Math.max(0, Math.min(1, calculatedPower)),
      effectSize: h,
      alpha,
      df: n - 2,
      n1,
      n2,
      criticalValue: zAlpha,
      testType: 'two-proportions'
    };
  } else {
    throw new Error('Forneça power OU tamanho amostral (n), não ambos');
  }
}

/**
 * Calculate power for SIGN TEST
 * Nonparametric test for paired data comparing median difference to zero
 * 
 * G*Power: "Exact - Proportions: Sign test (binomial test)"
 * 
 * Effect size: g = P(+) - 0.5
 * where P(+) is the probability of a positive sign under H1
 * 
 * Conventions (G*Power):
 * - Small: g = 0.05 (55% positive)
 * - Medium: g = 0.15 (65% positive)  
 * - Large: g = 0.25 (75% positive)
 * 
 * The test is based on the binomial distribution with p = 0.5 under H0
 */
export function calculatePowerSignTest(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, tails } = input;
  
  if (!effectSize && effectSize !== 0) {
    throw new Error('Effect size (g) is required');
  }
  
  const g = Math.abs(effectSize);
  
  // Convert g to Cohen's h for calculation
  // g represents deviation from 0.5, so p1 = 0.5 + g, p0 = 0.5
  // h = 2 * arcsin(√(0.5+g)) - 2 * arcsin(√0.5)
  const p1 = 0.5 + g;
  const p0 = 0.5;
  
  if (p1 > 1) {
    throw new Error('Effect size g deve ser no máximo 0.5');
  }
  
  const h = 2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p0));
  
  if (power && !n) {
    // Calculate required sample size given power
    // Formula: n = (z_α + z_β)² / h²
    
    const zAlpha = tails === 'two' 
      ? normalQuantile(1 - alpha / 2) 
      : normalQuantile(1 - alpha);
    const zBeta = normalQuantile(power);
    
    // Sample size formula
    const requiredN = Math.ceil(Math.pow((zAlpha + zBeta) / h, 2));
    
    // Critical z-value
    const criticalZ = zAlpha;
    
    return {
      requiredN: Math.max(requiredN, 6), // Minimum sample size for sign test
      effectSize: g,
      alpha,
      df: requiredN - 1,
      criticalValue: criticalZ,
      testType: 'sign-test'
    };
  } else if (n && !power) {
    // Calculate power given sample size
    if (n < 6) {
      throw new Error('Sample size must be at least 6 for sign test');
    }
    
    const zAlpha = tails === 'two' 
      ? normalQuantile(1 - alpha / 2) 
      : normalQuantile(1 - alpha);
    
    // Noncentrality parameter: h * √n
    const ncp = h * Math.sqrt(n);
    
    // Power calculation
    let calculatedPower: number;
    if (tails === 'two') {
      const upperPower = 1 - normalCDF(zAlpha - ncp);
      const lowerPower = normalCDF(-zAlpha - ncp);
      calculatedPower = upperPower + lowerPower;
    } else {
      calculatedPower = 1 - normalCDF(zAlpha - ncp);
    }
    
    return {
      power: Math.max(0, Math.min(1, calculatedPower)),
      effectSize: g,
      alpha,
      df: n - 1,
      criticalValue: zAlpha,
      testType: 'sign-test'
    };
  } else {
    throw new Error('Forneça power OU tamanho amostral (n), não ambos');
  }
}

/**
 * Calculate power for CHI-SQUARE 2x2 TEST OF INDEPENDENCE
 * Tests association between two categorical variables in a 2x2 table
 * 
 * G*Power: "χ² tests: Goodness-of-fit tests: Contingency tables"
 * 
 * Effect size: Cohen's w = √(Σ(P_i - P_0i)² / P_0i)
 * For 2x2 tables, w is related to phi coefficient
 * 
 * Conventions:
 * - Small: w = 0.10
 * - Medium: w = 0.30
 * - Large: w = 0.50
 * 
 * df = (rows - 1) × (cols - 1) = 1 for 2x2 table
 * 
 * Uses noncentral chi-square distribution for accurate power calculation
 * λ (noncentrality) = w² × N
 */
export function calculatePowerChiSquare2x2(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n } = input;
  
  if (!effectSize && effectSize !== 0) {
    throw new Error('Effect size (Cohen\'s w) is required');
  }
  
  const w = Math.abs(effectSize);
  const df = 1; // For 2x2 table: (2-1)(2-1) = 1
  
  // Chi-square critical value
  const criticalChi = getChiSquareCriticalValue(alpha, df);
  
  if (power && !n) {
    // Calculate required sample size using iterative approach
    // λ = w² × N, solve for N given target power
    
    let low = 10;
    let high = 10000;
    const targetPower = power;
    
    // Binary search for required N
    for (let i = 0; i < 50; i++) {
      const mid = Math.floor((low + high) / 2);
      const lambda = w * w * mid;
      const calculatedPower = calculatePowerChiSquareFromNCP(criticalChi, df, lambda);
      
      if (Math.abs(calculatedPower - targetPower) < 0.001) {
        return {
          requiredN: mid,
          effectSize: w,
          alpha,
          df,
          criticalValue: criticalChi,
          testType: 'chi-square-2x2'
        };
      }
      
      if (calculatedPower < targetPower) {
        low = mid;
      } else {
        high = mid;
      }
    }
    
    const finalN = Math.ceil((low + high) / 2);
    return {
      requiredN: Math.max(finalN, 20),
      effectSize: w,
      alpha,
      df,
      criticalValue: criticalChi,
      testType: 'chi-square-2x2'
    };
  } else if (n && !power) {
    // Calculate power given sample size
    if (n < 10) {
      throw new Error('Sample size must be at least 10 for chi-square test');
    }
    
    // Noncentrality parameter: λ = w² × N
    const lambda = w * w * n;
    
    // Power using noncentral chi-square
    const calculatedPower = calculatePowerChiSquareFromNCP(criticalChi, df, lambda);
    
    return {
      power: Math.max(0, Math.min(1, calculatedPower)),
      effectSize: w,
      alpha,
      df,
      criticalValue: criticalChi,
      testType: 'chi-square-2x2'
    };
  } else {
    throw new Error('Forneça power OU tamanho amostral (n), não ambos');
  }
}

/**
 * Calculate power for FISHER EXACT TEST
 * Exact test for 2x2 contingency tables
 * Used when sample sizes are small (n < 20) or expected frequencies < 5
 * 
 * G*Power: "Exact - Proportions: Inequality, two independent groups (Fisher's exact test)"
 * 
 * Effect size: Cohen's w (same as chi-square)
 * 
 * Fisher's exact test is more conservative than chi-square
 * For power analysis, we use chi-square approximation with ~15% sample size inflation
 */
export function calculatePowerFisherExact(input: PowerAnalysisInput): PowerAnalysisResult {
  // NORMAL APPROXIMATION — this is NOT the exact (enumeration) power of
  // Fisher's test. The 2×2 association is tested with the large-sample z test
  // (equivalently χ² with 1 df, z² = χ²): power = P(|Z + δ| > z₁₋α/₂) with
  // δ = w·√(N / 1.15). The factor 1.15 inflates N by 15% to approximate the
  // conservativeness of the exact test. G*Power computes Fisher's power by exact
  // enumeration, so results are not expected to match it exactly.
  const { alpha, power, effectSize, n, allocationRatio = 1 } = input;

  if (!effectSize && effectSize !== 0) {
    throw new Error('Effect size (Cohen\'s w) is required');
  }

  const w = Math.abs(effectSize);
  const k = allocationRatio;
  const INFLATION = 1.15;
  const N_MIN = 10;
  const criticalChi = getChiSquareCriticalValue(alpha, 1);
  const criticalZ = Math.sqrt(criticalChi);
  const approximation = 'normal-15pct';

  const at = (m: number) => {
    const lambda = (w * w * m) / INFLATION;
    return { lambda, power: Math.max(0, Math.min(1, calculatePowerChiSquareFromNCP(criticalChi, 1, lambda))) };
  };

  if (power && !n) {
    if (!(w > 0)) throw new Error('Effect size (Cohen\'s w) is required');
    // Smallest integer N ≥ 10 whose approximate power reaches the target
    // (same function as the post-hoc mode, so N and power are consistent).
    let lo = N_MIN;
    let hi = N_MIN;
    if (at(lo).power < power) {
      while (at(hi).power < power) {
        lo = hi;
        hi *= 2;
        if (hi > 1e8) throw new Error('Sample size must be positive');
      }
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (at(mid).power >= power) hi = mid; else lo = mid;
      }
    }
    const requiredN = hi;
    const r = at(requiredN);
    const n1 = Math.ceil(requiredN / (1 + k));
    const n2 = requiredN - n1;
    return {
      requiredN,
      n1,
      n2,
      effectSize: w,
      alpha,
      df: 0,
      criticalValue: criticalZ,
      ncp: Math.sqrt(r.lambda),
      actualPower: r.power,
      approximation,
      testType: 'fisher-exact'
    };
  } else if (n && !power) {
    if (n < N_MIN) {
      throw new Error('Sample size must be at least 10 for Fisher exact test');
    }
    const r = at(n);
    const n1 = Math.floor(n / (1 + k));
    const n2 = n - n1;
    return {
      power: r.power,
      effectSize: w,
      alpha,
      df: 0,
      n1,
      n2,
      criticalValue: criticalZ,
      ncp: Math.sqrt(r.lambda),
      approximation,
      testType: 'fisher-exact'
    };
  } else {
    throw new Error('Forneça power OU tamanho amostral (n), não ambos');
  }
}

/**
 * Calculate power for McNEMAR TEST
 * Tests for changes in paired binary data (before/after, matched pairs)
 * 
 * G*Power: "Exact - Proportions: McNemar test (matched pairs)"
 * 
 * Effect size: Cohen's g = |p₁₂ - p₂₁| / 2
 * where p₁₂ and p₂₁ are the off-diagonal proportions
 * OR odds ratio OR = p₁₂ / p₂₁
 * 
 * Conventions for g:
 * - Small: g = 0.05
 * - Medium: g = 0.15
 * - Large: g = 0.25
 * 
 * Alternative: Can use proportion of discordant pairs (π_d) and odds ratio
 */
export function calculatePowerMcNemar(input: PowerAnalysisInput): PowerAnalysisResult {
  const { alpha, power, effectSize, n, tails } = input;
  
  if (!effectSize && effectSize !== 0) {
    throw new Error('Effect size (g) is required');
  }
  
  const g = Math.abs(effectSize);
  
  // Convert g to proportion difference
  // g = (p12 - p21) / 2 where p12 and p21 are off-diagonal cell probabilities
  // For simplicity, assume p12 + p21 = 0.5 (50% discordant pairs)
  // Then p12 = 0.25 + g, p21 = 0.25 - g
  
  // McNemar test statistic: (b - c)² / (b + c) ~ χ²(1)
  // Noncentrality parameter: (p12 - p21)² × n / (p12 + p21) = 4g² × n / (p12 + p21)
  
  // Assuming 50% discordant pairs, the formula simplifies
  const discordantProp = 0.5; // Proportion of discordant pairs
  
  // Effect size h for McNemar (similar to sign test approach)
  const p1 = 0.5 + g; // proportion of changes in one direction among discordant
  const p0 = 0.5;
  const h = 2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p0));
  
  if (power && !n) {
    // Calculate required number of PAIRS
    const zAlpha = tails === 'two' 
      ? normalQuantile(1 - alpha / 2) 
      : normalQuantile(1 - alpha);
    const zBeta = normalQuantile(power);
    
    // Number of discordant pairs needed
    const nDiscordant = Math.ceil(Math.pow((zAlpha + zBeta) / h, 2));
    
    // Total pairs needed (assuming 50% discordant)
    const requiredN = Math.ceil(nDiscordant / discordantProp);
    
    // Chi-square critical value for df=1
    const criticalChi = Math.pow(normalQuantile(1 - alpha / 2), 2);
    
    return {
      requiredN: Math.max(requiredN, 10), // Minimum pairs
      effectSize: g,
      alpha,
      df: 1,
      criticalValue: criticalChi,
      testType: 'mcnemar'
    };
  } else if (n && !power) {
    // Calculate power given number of pairs
    if (n < 10) {
      throw new Error('At least 10 pairs are required for McNemar test');
    }
    
    const zAlpha = tails === 'two' 
      ? normalQuantile(1 - alpha / 2) 
      : normalQuantile(1 - alpha);
    
    // Expected number of discordant pairs
    const nDiscordant = n * discordantProp;
    
    // Noncentrality parameter
    const ncp = h * Math.sqrt(nDiscordant);
    
    let calculatedPower: number;
    if (tails === 'two') {
      const upperPower = 1 - normalCDF(zAlpha - ncp);
      const lowerPower = normalCDF(-zAlpha - ncp);
      calculatedPower = upperPower + lowerPower;
    } else {
      calculatedPower = 1 - normalCDF(zAlpha - ncp);
    }
    
    // Chi-square critical value
    const criticalChi = Math.pow(normalQuantile(1 - alpha / 2), 2);
    
    return {
      power: Math.max(0, Math.min(1, calculatedPower)),
      effectSize: g,
      alpha,
      df: 1,
      criticalValue: criticalChi,
      testType: 'mcnemar'
    };
  } else {
    throw new Error('Forneça power OU tamanho amostral (n), não ambos');
  }
}

/**
 * Generic chi-square power calculation using Cohen's w with arbitrary df.
 *
 * Used for: Cochran's Q (df = k-1), chi-square test of independence (df = (r-1)(c-1))
 * and goodness-of-fit (df = k-1).
 *
 * Follows the convention adopted by Cohen (1988, ch. 7) and the `pwr` R package
 * (`pwr::pwr.chisq.test`): the noncentral chi-square has noncentrality
 * λ = w² · N, where N is the total sample size and w is Cohen's w
 * (small = 0.10, medium = 0.30, large = 0.50).
 *
 * For the chi-square test of independence, w can also be obtained from
 * Cramér's V via w = V · √(min(r-1, c-1)).
 *
 * For Cochran's Q, the same chi-square approximation is used:
 * Q ~ χ²(k-1) under H₀; under H₁, Q ~ noncentral χ²(k-1, λ = N·w²)
 * with w defined from the marginal proportions across the k conditions.
 */
function calculatePowerGenericChiSquare(
  input: PowerAnalysisInput,
  df: number,
  testType: string,
  extraResultFields: Partial<PowerAnalysisResult> = {}
): PowerAnalysisResult {
  const { alpha, power, effectSize, n } = input;

  if (!effectSize && effectSize !== 0) {
    throw new Error("Effect size (Cohen's w) is required");
  }
  if (!Number.isFinite(df) || df < 1) {
    throw new Error('Degrees of freedom must be a finite integer >= 1');
  }

  const w = Math.abs(effectSize);
  const criticalChi = getChiSquareCriticalValue(alpha, df);

  if (power && !n) {
    // Iterative search for required N: smallest N such that
    // 1 - F_{χ²'}(crit; df, w²·N) >= target power.
    const targetPower = power;
    let lo = 4;
    let hi = 4;
    // Exponential bracketing
    while (calculatePowerChiSquareFromNCP(criticalChi, df, w * w * hi) < targetPower && hi < 10_000_000) {
      hi *= 2;
    }
    // Bisection
    for (let i = 0; i < 60; i++) {
      if (hi - lo <= 1) break;
      const mid = Math.floor((lo + hi) / 2);
      const p = calculatePowerChiSquareFromNCP(criticalChi, df, w * w * mid);
      if (p < targetPower) lo = mid;
      else hi = mid;
    }
    return {
      requiredN: Math.max(hi, 5),
      effectSize: w,
      alpha,
      df,
      criticalValue: criticalChi,
      testType,
      ...extraResultFields,
    };
  } else if (n && !power) {
    if (n < 5) {
      throw new Error('Sample size must be at least 5 for chi-square test');
    }
    const lambda = w * w * n;
    const calculatedPower = calculatePowerChiSquareFromNCP(criticalChi, df, lambda);
    return {
      power: Math.max(0, Math.min(1, calculatedPower)),
      effectSize: w,
      alpha,
      df,
      criticalValue: criticalChi,
      testType,
      ...extraResultFields,
    };
  } else {
    throw new Error('Forneça power OU tamanho amostral (n), não ambos');
  }
}

/**
 * Calculate power for COCHRAN'S Q TEST
 * Tests whether the proportion of "successes" is the same across k >= 3
 * related/paired conditions (e.g. same subjects rated yes/no in 3+ moments).
 *
 * Asymptotically Q ~ χ²(df = k - 1). For sample size purposes we follow the
 * generic Cohen (1988) chi-square framework: λ = w² · N (where N is the
 * number of subjects, each contributing one response per condition).
 *
 * Effect size: Cohen's w (small = 0.10, medium = 0.30, large = 0.50).
 */
export function calculatePowerCochranQ(input: PowerAnalysisInput): PowerAnalysisResult {
  const k = input.k ?? 3;
  if (!Number.isFinite(k) || !Number.isInteger(k) || k < 3) {
    throw new Error('Number of conditions (k) must be at least 3');
  }
  const df = k - 1;
  return calculatePowerGenericChiSquare(input, df, 'cochran-q', { k });
}

/**
 * Calculate power for CHI-SQUARE TEST OF INDEPENDENCE (general r × c)
 * Tests association between two categorical variables in a contingency
 * table with r rows and c columns. Generalises chi-square-2x2.
 *
 * df = (r - 1) · (c - 1)
 * λ = w² · N (Cohen, 1988; pwr::pwr.chisq.test)
 *
 * Effect size: Cohen's w. For 2×2 tables w equals |φ| (phi coefficient);
 * for larger tables w = V · √(min(r-1, c-1)) where V is Cramér's V.
 */
export function calculatePowerChiSquareIndependence(input: PowerAnalysisInput): PowerAnalysisResult {
  const r = input.numRows ?? 2;
  const c = input.numCols ?? 2;
  if (!Number.isFinite(r) || !Number.isInteger(r) || !Number.isFinite(c) || !Number.isInteger(c) || r < 2 || c < 2) {
    throw new Error('Number of rows and columns must be at least 2');
  }
  if (r === 2 && c === 2) {
    throw new Error('Para tabelas 2×2 utilize o teste qui-quadrado 2×2 dedicado');
  }
  const df = (r - 1) * (c - 1);
  return calculatePowerGenericChiSquare(input, df, 'chi-square-independence', {
    numLevelsA: r,
    numLevelsB: c,
  });
}

/**
 * Calculate power for CHI-SQUARE GOODNESS-OF-FIT TEST
 * Tests whether observed proportions across k mutually-exclusive categories
 * differ from a specified expected distribution.
 *
 * df = k - 1
 * λ = w² · N where w = √(Σ (p_i - p_0i)² / p_0i)
 *
 * Effect size: Cohen's w (small = 0.10, medium = 0.30, large = 0.50).
 */
export function calculatePowerGoodnessOfFit(input: PowerAnalysisInput): PowerAnalysisResult {
  const k = input.k ?? 2;
  if (!Number.isFinite(k) || !Number.isInteger(k) || k < 2) {
    throw new Error('Number of categories (k) must be at least 2');
  }
  const df = k - 1;
  return calculatePowerGenericChiSquare(input, df, 'goodness-of-fit', { k });
}

/**
 * Generate power curve for proportion tests
 */
export function generatePowerCurveProportions(
  effectSize: number,
  alpha: number,
  testType: 'proportion-one-sample' | 'two-proportions' | 'sign-test' | 'chi-square-2x2' | 'fisher-exact' | 'mcnemar' | 'cochran-q' | 'chi-square-independence' | 'goodness-of-fit',
  tails: 'one' | 'two',
  maxN: number = 200,
  extras: { k?: number; numRows?: number; numCols?: number } = {}
): Array<{ n: number; power: number }> {
  const curve: Array<{ n: number; power: number }> = [];
  
  for (let n = 10; n <= maxN; n += 5) {
    try {
      const input: PowerAnalysisInput = {
        alpha,
        effectSize,
        n,
        tails,
        k: extras.k,
        numRows: extras.numRows,
        numCols: extras.numCols,
      };
      
      let result: PowerAnalysisResult;
      if (testType === 'proportion-one-sample') {
        result = calculatePowerOneSampleProportion(input);
      } else if (testType === 'sign-test') {
        result = calculatePowerSignTest(input);
      } else if (testType === 'chi-square-2x2') {
        result = calculatePowerChiSquare2x2(input);
      } else if (testType === 'fisher-exact') {
        result = calculatePowerFisherExact(input);
      } else if (testType === 'mcnemar') {
        result = calculatePowerMcNemar(input);
      } else if (testType === 'cochran-q') {
        result = calculatePowerCochranQ(input);
      } else if (testType === 'chi-square-independence') {
        result = calculatePowerChiSquareIndependence(input);
      } else if (testType === 'goodness-of-fit') {
        result = calculatePowerGoodnessOfFit(input);
      } else {
        result = calculatePowerTwoProportions(input);
      }
      
      if (result.power !== undefined) {
        curve.push({ n, power: result.power });
      }
    } catch (e) {
      // Skip invalid configurations
    }
  }
  
  return curve;
}

/**
 * Generate power curve data varying the effect size at a fixed N.
 * Used by the sensitivity calculation mode (have-n-effect). Reuses the same
 * post-hoc power functions; no math changes.
 */
export function generateEffectSizeCurveProportions(
  n: number,
  alpha: number,
  testType: 'proportion-one-sample' | 'two-proportions' | 'sign-test' | 'chi-square-2x2' | 'fisher-exact' | 'mcnemar' | 'cochran-q' | 'chi-square-independence' | 'goodness-of-fit',
  tails: 'one' | 'two',
  maxEffect: number,
  extras: { k?: number; numRows?: number; numCols?: number } = {}
): Array<{ effectSize: number; power: number }> {
  const curve: Array<{ effectSize: number; power: number }> = [];
  const safeMax = Math.max(maxEffect, 0.1);
  const step = safeMax / 50;

  for (let es = step; es <= safeMax + step / 2; es += step) {
    try {
      const input: PowerAnalysisInput = {
        alpha,
        effectSize: es,
        n,
        tails,
        k: extras.k,
        numRows: extras.numRows,
        numCols: extras.numCols,
      };

      let result: PowerAnalysisResult;
      if (testType === 'proportion-one-sample') {
        result = calculatePowerOneSampleProportion(input);
      } else if (testType === 'sign-test') {
        result = calculatePowerSignTest(input);
      } else if (testType === 'chi-square-2x2') {
        result = calculatePowerChiSquare2x2(input);
      } else if (testType === 'fisher-exact') {
        result = calculatePowerFisherExact(input);
      } else if (testType === 'mcnemar') {
        result = calculatePowerMcNemar(input);
      } else if (testType === 'cochran-q') {
        result = calculatePowerCochranQ(input);
      } else if (testType === 'chi-square-independence') {
        result = calculatePowerChiSquareIndependence(input);
      } else if (testType === 'goodness-of-fit') {
        result = calculatePowerGoodnessOfFit(input);
      } else {
        result = calculatePowerTwoProportions(input);
      }

      if (result.power !== undefined) {
        curve.push({ effectSize: es, power: result.power });
      }
    } catch (e) {
      // Skip invalid configurations
    }
  }

  return curve;
}
