/**
 * Utility functions for power analysis calculations
 * Shared across all statistical tests
 */

/**
 * Standard normal cumulative distribution function (CDF)
 *
 * Double-precision algorithm of Hart (1968) as given by West (2005), "Better
 * approximations to cumulative normal functions" — absolute error < 1e-14.
 * The previous Abramowitz–Stegun 26.2.17 polynomial (error ~1e-7) propagated
 * into every t/z critical value (e.g. t crit 2.0345181 vs G*Power 2.0345153
 * for df = 33), so reports diverged from G*Power in the 6th decimal.
 */
export function normalCDF(x: number): number {
  if (!Number.isFinite(x)) return x > 0 ? 1 : 0;
  const xa = Math.abs(x);
  let c: number;
  if (xa > 37) {
    c = 0;
  } else {
    const e = Math.exp(-xa * xa / 2);
    if (xa < 7.07106781186547) {
      let b = 3.52624965998911e-02 * xa + 0.700383064443688;
      b = b * xa + 6.37396220353165;
      b = b * xa + 33.912866078383;
      b = b * xa + 112.079291497871;
      b = b * xa + 221.213596169931;
      b = b * xa + 220.206867912376;
      let d = 8.83883476483184e-02 * xa + 1.75566716318264;
      d = d * xa + 16.064177579207;
      d = d * xa + 86.7807322029461;
      d = d * xa + 296.564248779674;
      d = d * xa + 637.333633378831;
      d = d * xa + 793.826512519948;
      d = d * xa + 440.413735824752;
      c = e * b / d;
    } else {
      let b = xa + 0.65;
      b = xa + 4 / b;
      b = xa + 3 / b;
      b = xa + 2 / b;
      b = xa + 1 / b;
      c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}

/**
 * Inverse of standard normal CDF (quantile function)
 * Using Newton-Raphson method
 */
export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new Error('Probability must be between 0 and 1');
  }
  
  // Initial guess using rational approximation
  const c = [2.515517, 0.802853, 0.010328];
  const d = [1.432788, 0.189269, 0.001308];
  
  const sign = p < 0.5 ? -1 : 1;
  const q = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(q));
  
  let x = t - (c[0] + c[1] * t + c[2] * t * t) / (1 + d[0] * t + d[1] * t * t + d[2] * t * t * t);
  
  // Newton-Raphson refinement (converges to double precision with the exact CDF)
  for (let i = 0; i < 6; i++) {
    const error = normalCDF(x) - p;
    const derivative = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    x = x - error / derivative;
  }
  
  return sign * x;
}

/**
 * Non-central t distribution CDF — P(T <= t | df, ncp)
 *
 * Exact implementation of Algorithm AS 243 (Lenth, 1989), the same series used
 * by G*Power and R's `pt(..., ncp=)`. The previous version was a crude normal
 * approximation that diverged from G*Power for moderate df (e.g. one-sample t
 * post-hoc/sensitivity); this matches G*Power to ~6 decimal places.
 */
export function noncentralTCDF(t: number, df: number, ncp: number): number {
  if (df <= 0) return NaN;

  const errmax = 1e-12;
  const itrmax = 1000;

  // AS 243 is derived for t >= 0; reflect for negative t:
  // P(T <= t | df, ncp) = 1 - P(T <= -t | df, -ncp)
  let negt = false;
  let tt = t;
  let del = ncp;
  if (t < 0) {
    negt = true;
    tt = -t;
    del = -ncp;
  }

  const x = (tt * tt) / (tt * tt + df);

  let series = 0;
  if (x > 0) {
    const lambda = del * del;
    let p = 0.5 * Math.exp(-0.5 * lambda);
    let q = Math.sqrt(2 / Math.PI) * p * del;
    let s = 0.5 - p;
    let a = 0.5;
    const b = 0.5 * df;
    const rxb = Math.pow(1 - x, b);
    const albeta = logGamma(a) + logGamma(b) - logGamma(a + b);
    let xodd = betaIncomplete(x, a, b);
    let godd = 2 * rxb * Math.exp(a * Math.log(x) - albeta);
    let xeven = 1 - rxb;
    let geven = b * x * rxb;
    series = p * xodd + q * xeven;

    let it = 1;
    let errbd = 1;
    do {
      a += 1;
      xodd -= godd;
      xeven -= geven;
      godd *= (x * (a + b - 1)) / a;
      geven *= (x * (a + b - 0.5)) / (a + 0.5);
      p *= lambda / (2 * it);
      q *= lambda / (2 * it + 1);
      s -= p;
      series += p * xodd + q * xeven;
      errbd = 2 * s * (xodd - godd);
      it++;
    } while (Math.abs(errbd) > errmax && it <= itrmax);
  }

  let result = series + normalCDF(-del);
  result = Math.min(1, Math.max(0, result));
  return negt ? 1 - result : result;
}

/**
 * Central Student's t CDF — P(T <= t | df). Special case of the noncentral CDF
 * with ncp = 0.
 */
export function tCDF(t: number, df: number): number {
  return noncentralTCDF(t, df, 0);
}

/**
 * Get critical t-value for given alpha and degrees of freedom.
 *
 * Inverts the exact central t CDF via bisection, matching G*Power. The previous
 * version used a normal/Cornish-Fisher approximation accurate only to ~1e-3.
 */
export function getCriticalValue(alpha: number, df: number, tails: 'one' | 'two'): number {
  const alphaAdjusted = tails === 'two' ? alpha / 2 : alpha;
  const target = 1 - alphaAdjusted;

  let lo = 0;
  let hi = 100;
  // Expand the upper bracket until it exceeds the target quantile so small alpha
  // / heavy tails (small df) don't silently saturate at a fixed bound.
  let guard = 0;
  while (tCDF(hi, df) < target) {
    hi *= 2;
    if (++guard > 100) break;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tCDF(mid, df) < target) {
      lo = mid;
    } else {
      hi = mid;
    }
    if (hi - lo < 1e-10) break;
  }
  return (lo + hi) / 2;
}

/**
 * Calculate power from non-centrality parameter
 */
export function calculatePowerFromNCP(criticalValue: number, df: number, ncp: number, tails: 'one' | 'two'): number {
  if (tails === 'two') {
    const power1 = 1 - noncentralTCDF(criticalValue, df, ncp);
    const power2 = noncentralTCDF(-criticalValue, df, ncp);
    return power1 + power2;
  } else {
    return 1 - noncentralTCDF(criticalValue, df, ncp);
  }
}

/**
 * Numerically invert a power function to find the minimum detectable effect.
 *
 * Used by the "sensitivity" calculation mode. Given the sample size and the
 * requested power, this finds the smallest effect size whose post-hoc power
 * equals the target. The post-hoc power functions are monotonically increasing
 * in the effect through their noncentrality parameter, so a simple
 * expand-then-bisect search converges reliably. No new statistical formula is
 * introduced here — `powerFn` simply wraps the EXISTING post-hoc power
 * computation of each test.
 *
 * The search variable runs from `lo` (where power is near alpha) upward. The
 * upper bound is doubled (capped at `maxHi`) until its power reaches the target;
 * if the target cannot be reached at `maxHi`, an error is thrown.
 */
export function solveEffectForPower(
  powerFn: (effect: number) => number,
  targetPower: number,
  options: { lo?: number; hi?: number; maxHi?: number; tol?: number; maxIter?: number } = {}
): number {
  const tol = options.tol ?? 1e-7;
  const maxIter = options.maxIter ?? 200;
  const maxHi = options.maxHi ?? 1e6;
  let lo = options.lo ?? 0;
  let hi = options.hi ?? 1;

  if (hi <= lo) hi = lo + Math.max(Math.abs(lo) * 0.1, 0.05);

  const safePower = (e: number): number => {
    try {
      const p = powerFn(e);
      return Number.isFinite(p) ? p : 0;
    } catch {
      return 0;
    }
  };

  // Expand the upper bound until its power meets/exceeds the target power.
  let guard = 0;
  while (safePower(hi) < targetPower) {
    if (hi >= maxHi) {
      throw new Error('Não foi possível determinar um tamanho de efeito detectável para os parâmetros fornecidos');
    }
    hi = Math.min(hi * 2, maxHi);
    if (++guard > 1000) {
      throw new Error('Não foi possível determinar um tamanho de efeito detectável para os parâmetros fornecidos');
    }
  }

  // Bisection between lo and hi.
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const p = safePower(mid);
    if (Math.abs(p - targetPower) < tol || (hi - lo) < tol) {
      return mid;
    }
    if (p < targetPower) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return (lo + hi) / 2;
}

/**
 * Calculate required sample size for one-sample/paired t-test
 */
export function calculateRequiredNOneSample(d: number, alpha: number, power: number, tails: 'one' | 'two'): number {
  const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);
  const zb = normalQuantile(power);
  
  // Initial approximation
  let n = Math.pow((za + zb) / d, 2);
  
  // Iterative refinement for t-distribution
  for (let i = 0; i < 10; i++) {
    const df = n - 1;
    const ta = getCriticalValue(alpha, df, tails);
    n = Math.pow((ta + zb) / d, 2);
  }
  
  return Math.ceil(n);
}

/**
 * Calculate required sample size for independent t-test (equal groups)
 */
export function calculateRequiredNIndependent(d: number, alpha: number, power: number, tails: 'one' | 'two', ratio: number = 1): number {
  const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);
  const zb = normalQuantile(power);
  
  // Initial approximation
  let n = Math.pow((za + zb) / d, 2) * 2 * (1 + 1/ratio) / (1 + ratio);
  
  // Iterative refinement
  for (let i = 0; i < 10; i++) {
    const df = 2 * n - 2;
    const ta = getCriticalValue(alpha, df, tails);
    n = Math.pow((ta + zb) / d, 2) * 2 * (1 + 1/ratio) / (1 + ratio);
  }
  
  return Math.ceil(n);
}

/**
 * Calculate required n2 given n1 for independent t-test
 */
export function calculateRequiredN2(d: number, alpha: number, power: number, n1: number, tails: 'one' | 'two'): number {
  const za = tails === 'two' ? normalQuantile(1 - alpha / 2) : normalQuantile(1 - alpha);
  const zb = normalQuantile(power);
  
  // Iterative calculation
  let n2 = n1; // Start with equal sizes
  
  for (let i = 0; i < 20; i++) {
    const df = n1 + n2 - 2;
    const ta = getCriticalValue(alpha, df, tails);
    const harmonicMean = 2 / (1/n1 + 1/n2);
    const requiredHarmonic = Math.pow((ta + zb) / d, 2) * 2;
    n2 = 1 / (2/requiredHarmonic - 1/n1);
    
    if (n2 < 2) n2 = 2; // Minimum sample size
  }
  
  return Math.ceil(n2);
}

/**
 * Incomplete beta function using continued fractions
 * Used for F-distribution CDF calculation
 */
function betaIncompleteCF(x: number, a: number, b: number): number {
  const maxIterations = 200;
  const epsilon = 1e-10;
  
  // Continued fraction coefficients
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  
  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    
    if (Math.abs(del - 1) < epsilon) break;
  }
  
  return h;
}

/**
 * Log-gamma function using Lanczos approximation
 * Numerically stable for all z > 0
 */
function logGamma(z: number): number {
  // Lanczos approximation coefficients (g=7)
  const g = 7;
  const coef = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  
  if (z < 0.5) {
    // Use reflection formula: Γ(1-z)Γ(z) = π/sin(πz)
    return Math.log(Math.PI) - Math.log(Math.abs(Math.sin(Math.PI * z))) - logGamma(1 - z);
  }
  
  z -= 1;
  let x = coef[0];
  for (let i = 1; i < g + 2; i++) {
    x += coef[i] / (z + i);
  }
  
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Regularized incomplete beta function I_x(a,b)
 * Used for F and Beta distribution CDFs
 */
function betaIncomplete(x: number, a: number, b: number): number {
  if (x < 0 || x > 1) return 0;
  if (x === 0) return 0;
  if (x === 1) return 1;
  
  // Handle edge cases for very small a or b
  if (a < 1e-10) return 1;
  if (b < 1e-10) return 0;
  
  // Log of beta function: ln(B(a,b)) = ln(Γ(a)) + ln(Γ(b)) - ln(Γ(a+b))
  const logBetaAB = logGamma(a) + logGamma(b) - logGamma(a + b);
  const logBetaX = Math.log(x) * a + Math.log(1 - x) * b - logBetaAB;

  // The prefactor exp(logBetaX) can underflow to 0 or overflow to ∞ for
  // extreme parameters (e.g. large df with x near 1). The under/overflow limit
  // must be resolved PER BRANCH: in the upper-tail branch I_x → 1 as the
  // prefactor vanishes, not 0. Resolving it before choosing the branch (as the
  // previous code did) made the t/F CDFs collapse to 0.5 for large df, which in
  // turn made getCriticalValue diverge.
  const betaX = Math.exp(logBetaX);

  // Use continued fraction
  if (x < (a + 1) / (a + b + 2)) {
    if (betaX === 0) return 0;
    if (!Number.isFinite(betaX)) return 1;
    return betaX * betaIncompleteCF(x, a, b) / a;
  } else {
    if (betaX === 0) return 1;
    if (!Number.isFinite(betaX)) return 0;
    return 1 - betaX * betaIncompleteCF(1 - x, b, a) / b;
  }
}

/**
 * F-distribution CDF using Beta distribution relationship
 * F(x; df1, df2) = I_{df1*x/(df1*x + df2)}(df1/2, df2/2)
 */
function fCDF(f: number, df1: number, df2: number): number {
  if (f <= 0) return 0;
  const x = (df1 * f) / (df1 * f + df2);
  return betaIncomplete(x, df1 / 2, df2 / 2);
}

/**
 * Get critical F-value for given alpha and degrees of freedom
 * F distribution is always one-tailed (right tail)
 * Uses bisection method with exact F-CDF via Beta distribution
 */
export function getFCriticalValue(alpha: number, df1: number, df2: number): number {
  // Use bisection to find F such that P(F > f_crit) = alpha
  // Equivalently: P(F <= f_crit) = 1 - alpha
  
  const targetCDF = 1 - alpha;
  const tolerance = 1e-13;
  const maxIterations = 200;
  
  // Initial bounds - use rough approximation for starting point
  let fLow = 0;
  let fHigh = 100;
  
  // Expand upper bound if needed
  while (fCDF(fHigh, df1, df2) < targetCDF && fHigh < 10000) {
    fHigh *= 2;
  }
  
  // Bisection search
  for (let i = 0; i < maxIterations; i++) {
    const fMid = (fLow + fHigh) / 2;
    const cdfMid = fCDF(fMid, df1, df2);
    
    if (Math.abs(cdfMid - targetCDF) < tolerance || fHigh - fLow < 1e-12 * Math.max(1, fMid)) {
      return fMid;
    }
    
    if (cdfMid < targetCDF) {
      fLow = fMid;
    } else {
      fHigh = fMid;
    }
  }
  
  // Return midpoint after max iterations
  return (fLow + fHigh) / 2;
}

/**
 * Non-central F distribution CDF using Poisson mixture expansion
 * This is the standard method for non-central F CDF calculation
 * F'(x | df1, df2, λ) = Σ P(λ/2, j) * F(x*(df1+2j)/df1 | df1+2j, df2)
 */
export function noncentralFCDF(f: number, df1: number, df2: number, lambda: number): number {
  if (f <= 0) return 0;
  
  // For lambda ≈ 0, use central F distribution
  if (lambda < 0.001) {
    return fCDF(f, df1, df2);
  }
  
  // Poisson mixture expansion for non-central F
  // CDF = Σ_{j=0}^{∞} [e^(-λ/2) * (λ/2)^j / j!] * F_CDF(f * (df1+2j)/df1 | df1+2j, df2)
  
  const halfLambda = lambda / 2;
  const maxTerms = 150; // Sufficient for convergence
  const tolerance = 1e-12;
  
  let cdf = 0;
  let poissonWeight = Math.exp(-halfLambda); // P(λ/2, 0) = e^(-λ/2)
  
  for (let j = 0; j < maxTerms; j++) {
    // Adjust degrees of freedom for this term
    const adjustedDf1 = df1 + 2 * j;
    // Scale F value DOWN to maintain equivalence with beta function formulation
    // F_nc uses: I_{df1*x/(df1*x+df2)}((df1+2j)/2, df2/2)
    // Which corresponds to central F with: y = x * df1 / (df1 + 2j)
    const adjustedF = f * df1 / adjustedDf1;
    
    // Central F CDF for this term
    const centralFCDF = fCDF(adjustedF, adjustedDf1, df2);
    
    // Add weighted contribution
    const term = poissonWeight * centralFCDF;
    cdf += term;
    
    // Check for convergence
    if (j > 5 && term < tolerance) break;
    
    // Update Poisson weight for next term: P(j+1) = P(j) * (λ/2) / (j+1)
    poissonWeight *= halfLambda / (j + 1);
    
    // Prevent underflow
    if (poissonWeight < 1e-300) break;
  }
  
  return Math.min(1, Math.max(0, cdf));
}

/**
 * Calculate power from non-centrality parameter for F-test
 * Always one-tailed (right tail) for ANOVA-type tests
 */
export function calculatePowerFromNCPF(criticalF: number, df1: number, df2: number, lambda: number): number {
  // Power = P(F > F_crit | lambda) = 1 - CDF_noncentral_F(F_crit | df1, df2, lambda)
  return 1 - noncentralFCDF(criticalF, df1, df2, lambda);
}

/**
 * Chi-square distribution CDF using incomplete gamma function
 * χ²(x | df) = γ(df/2, x/2) / Γ(df/2)
 */
export function chiSquareCDF(x: number, df: number): number {
  if (x <= 0) return 0;
  if (df <= 0) return 0;
  
  // Use relationship: χ²(df) = Γ(df/2, x/2)
  // P(X ≤ x) = gammainc(df/2, x/2)
  return regularizedGammaP(df / 2, x / 2);
}

/**
 * Regularized lower incomplete gamma function P(a, x) = γ(a, x) / Γ(a)
 * Uses series expansion for x < a+1, continued fraction otherwise
 */
function regularizedGammaP(a: number, x: number): number {
  if (x < 0 || a <= 0) return 0;
  if (x === 0) return 0;
  
  if (x < a + 1) {
    // Series expansion: P(a,x) = e^(-x) * x^a * Σ(x^n / Γ(a+n+1))
    return gammaSeriesP(a, x);
  } else {
    // Continued fraction: P(a,x) = 1 - Q(a,x)
    return 1 - gammaContinuedFractionQ(a, x);
  }
}

/**
 * Lower incomplete gamma using series expansion
 */
function gammaSeriesP(a: number, x: number): number {
  const maxIterations = 200;
  const epsilon = 1e-10;
  
  let sum = 1 / a;
  let term = 1 / a;
  
  for (let n = 1; n < maxIterations; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < epsilon * Math.abs(sum)) break;
  }
  
  const logResult = a * Math.log(x) - x - logGammaPublic(a) + Math.log(sum);
  return Math.exp(logResult);
}

/**
 * Upper incomplete gamma using continued fraction
 */
function gammaContinuedFractionQ(a: number, x: number): number {
  const maxIterations = 200;
  const epsilon = 1e-10;
  
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  
  for (let i = 1; i < maxIterations; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < epsilon) break;
  }
  
  const logResult = a * Math.log(x) - x - logGammaPublic(a) + Math.log(h);
  return Math.exp(logResult);
}

/**
 * Public log-gamma function 
 */
function logGammaPublic(z: number): number {
  const g = 7;
  const coef = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  
  if (z < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.abs(Math.sin(Math.PI * z))) - logGammaPublic(1 - z);
  }
  
  z -= 1;
  let x = coef[0];
  for (let i = 1; i < g + 2; i++) {
    x += coef[i] / (z + i);
  }
  
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Chi-square critical value using bisection
 */
export function getChiSquareCriticalValue(alpha: number, df: number): number {
  const targetCDF = 1 - alpha;
  const tolerance = 1e-13;
  const maxIterations = 200;
  
  // Initial bounds
  let low = 0;
  let high = df + 10 * Math.sqrt(2 * df); // Reasonable upper bound
  
  // Expand if needed
  while (chiSquareCDF(high, df) < targetCDF && high < 1000) {
    high *= 2;
  }
  
  // Bisection
  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const cdf = chiSquareCDF(mid, df);
    
    if (Math.abs(cdf - targetCDF) < tolerance || high - low < 1e-12 * Math.max(1, mid)) {
      return mid;
    }
    
    if (cdf < targetCDF) {
      low = mid;
    } else {
      high = mid;
    }
  }
  
  return (low + high) / 2;
}

/**
 * Noncentral chi-square CDF using Poisson mixture
 * χ²'(x | df, λ) = Σ P(λ/2, j) * χ²(x | df + 2j)
 */
export function noncentralChiSquareCDF(x: number, df: number, lambda: number): number {
  if (x <= 0) return 0;
  
  // For λ ≈ 0, use central chi-square
  if (lambda < 0.001) {
    return chiSquareCDF(x, df);
  }
  
  const halfLambda = lambda / 2;
  const maxTerms = 200;
  const tolerance = 1e-12;
  
  let cdf = 0;
  let poissonWeight = Math.exp(-halfLambda);
  
  for (let j = 0; j < maxTerms; j++) {
    const adjustedDf = df + 2 * j;
    const centralCDF = chiSquareCDF(x, adjustedDf);
    
    const term = poissonWeight * centralCDF;
    cdf += term;
    
    if (j > 5 && term < tolerance) break;
    
    poissonWeight *= halfLambda / (j + 1);
    if (poissonWeight < 1e-300) break;
  }
  
  return Math.min(1, Math.max(0, cdf));
}

/**
 * Calculate power for chi-square test using noncentral distribution
 * Power = P(χ² > χ²_crit | λ) = 1 - CDF_noncentral(χ²_crit | df, λ)
 */
export function calculatePowerChiSquareFromNCP(criticalChi: number, df: number, lambda: number): number {
  return 1 - noncentralChiSquareCDF(criticalChi, df, lambda);
}
