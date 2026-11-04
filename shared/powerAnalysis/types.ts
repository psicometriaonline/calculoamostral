/**
 * Shared types for power analysis calculations
 */

export interface PowerAnalysisInput {
  alpha: number; // Significance level (usually 0.05)
  power?: number; // Desired power (usually 0.80 or 0.90)
  effectSize?: number; // Cohen's d or other effect size measure
  n?: number; // Sample size (for one group)
  n1?: number; // Sample size group 1 (for independent samples)
  n2?: number; // Sample size group 2 (for independent samples)
  k?: number; // Number of groups (for ANOVA, Kruskal-Wallis, Friedman)
  tails: 'one' | 'two'; // One-tailed or two-tailed test
  r1?: number; // First correlation (for correlation comparison tests)
  r2?: number; // Second correlation (for correlation comparison tests)
  r3?: number; // Third correlation (for dependent correlations: r_yz when comparing r_xy vs r_xz)
  numPredictors?: number; // Number of predictors (for regression). In increment model = total predictors in the full model.
  numTestedPredictors?: number; // Number of predictors being tested (increment model, df1 = q)
  baseProportion?: number; // Baseline event probability P (logistic regression, Demidenko 2007)
  r2OtherPredictors?: number; // R² of the predictor of interest on the other covariates (multiple logistic regression, Hsieh correction)
  // Logistic regression predictor (X) distribution (Demidenko 2007 / G*Power). Defaults to 'normal'.
  xDistribution?: 'normal' | 'binomial' | 'exponential' | 'lognormal' | 'poisson';
  xDistMu?: number; // Normal & Lognormal: mean (Lognormal: mean of ln X)
  xDistSigma?: number; // Normal & Lognormal: SD (Lognormal: SD of ln X)
  xDistPi?: number; // Binomial (Bernoulli predictor X ∈ {0,1}): probability of success
  xDistLambda?: number; // Exponential (mean) & Poisson (mean) parameter
  baseRate?: number; // Baseline mean event rate (Poisson regression, Signorini)
  numLevelsA?: number; // Number of levels for factor A (factorial ANOVA)
  numLevelsB?: number; // Number of levels for factor B (factorial ANOVA)
  numeratorDf?: number; // Numerator df of the tested effect (G*Power "special" factorial ANOVA)
  effectType?: 'main_a' | 'main_b' | 'interaction' | 'within' | 'between' | 'within_between'; // Type of effect
  // Repeated measures parameters
  numMeasurements?: number; // Number of repeated measurements (within-subjects levels)
  numGroups?: number; // Number of between-subjects groups (for mixed designs)
  correlationBetweenMeasures?: number; // Correlation between repeated measures (0 to 1)
  sphericityCorrection?: number; // Epsilon for sphericity correction (0 to 1, 1 = sphericity assumed)
  nonsphericity?: number; // Nonsphericity correction epsilon (alternative to sphericityCorrection)
  allocationRatio?: number; // Allocation ratio n2/n1 (default = 1 for equal groups)
  // Chi-square family extras
  numRows?: number; // Number of rows (chi-square test of independence, r >= 2)
  numCols?: number; // Number of columns (chi-square test of independence, c >= 2)
  // MANOVA extras
  numResponseVars?: number; // Number of response (dependent) variables (MANOVA, p)
}

export interface PowerAnalysisResult {
  power?: number; // Calculated statistical power
  requiredN?: number; // Required sample size for one group
  requiredN1?: number; // Required sample size for group 1
  requiredN2?: number; // Required sample size for group 2
  n1?: number; // Sample size for group 1 (when calculating power)
  n2?: number; // Sample size for group 2 (when calculating power)
  minDetectableEffect?: number; // Minimum detectable effect size
  effectSize: number; // Cohen's d or other effect size measure
  alpha: number; // Significance level
  df: number; // Degrees of freedom (numerator for F-tests)
  df2?: number; // Degrees of freedom (denominator for F-tests)
  criticalValue: number; // Critical value (t, z, F, etc.)
  testType: string; // Test identifier
  k?: number; // Number of groups (returned for ANOVA)
  numLevelsA?: number; // Number of levels for factor A (factorial ANOVA)
  numLevelsB?: number; // Number of levels for factor B (factorial ANOVA)
  numeratorDf?: number; // Numerator df of the tested effect (G*Power "special" factorial ANOVA)
  effectType?: 'main_a' | 'main_b' | 'interaction' | 'within' | 'between' | 'within_between'; // Type of effect
  effectLabel?: string; // Human-readable label for the effect
  // Repeated measures specific
  numMeasurements?: number; // Number of repeated measurements
  numGroups?: number; // Number of between-subjects groups
  correlationBetweenMeasures?: number; // Correlation between measures used
  sphericityCorrection?: number; // Epsilon correction applied
  nPerGroup?: number; // Sample size per group (for mixed ANOVA)
  // Regression specific
  numPredictors?: number; // Number of predictors used (multiple regression)
  numTestedPredictors?: number; // Number of predictors tested (increment model)
  baseProportion?: number; // Baseline event probability used (logistic regression)
  r2OtherPredictors?: number; // R² of other predictors used (multiple logistic regression)
  xDistribution?: string; // Predictor (X) distribution used (logistic regression)
  xDistMu?: number; // Predictor distribution: mean (Normal & Lognormal)
  xDistSigma?: number; // Predictor distribution: SD (Normal & Lognormal)
  xDistPi?: number; // Predictor distribution: success probability (Binomial)
  xDistLambda?: number; // Predictor distribution: mean (Exponential & Poisson)
  baseRate?: number; // Baseline mean event rate used (Poisson regression)
  // MANOVA specific
  numResponseVars?: number; // Number of response (dependent) variables used (MANOVA, p)
  pillaiV?: number; // Pillai-Bartlett trace V implied by the effect size (MANOVA)
  // G*Power-style report extras
  ncp?: number; // Noncentrality parameter (δ for t tests, λ for F / χ²)
  actualPower?: number; // Power achieved at the reported (integer) sample size
  totalN?: number; // Total sample size when requiredN is per group
  are?: number; // Asymptotic relative efficiency used (rank tests, A.R.E. method)
  parentDistribution?: string; // Parent distribution assumed by the A.R.E. method
  approximation?: string; // Method note when the power is approximated (e.g. Fisher exact)
}
