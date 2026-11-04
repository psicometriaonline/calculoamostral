// @ts-nocheck
// Camada de API local: executa no navegador os MESMOS handlers do backend
// (trechos exatos de referencias-backend/rotas-poder.ts.txt e rotas-precisao.ts.txt),
// com o núcleo matemático original de @shared. Persistência/acesso da Academy
// foram substituídos por: acesso público, histórico local no navegador.
import * as power from "@shared/powerAnalysis";
import * as precision from "@shared/sampleSizePrecision";
import { z } from "zod";

const {
  calculatePowerOneSampleT, calculatePowerPairedT, calculatePowerIndependentT,
  generatePowerCurveTTests, generateEffectSizeCurveTTests,
  calculatePowerPearsonCorrelation, calculatePowerSpearmanCorrelation, calculatePowerKendallCorrelation,
  calculatePowerCompareCorrelationsIndependent, calculatePowerCompareCorrelationsDependent,
  calculatePowerSimpleRegression, calculatePowerMultipleRegressionTotal, calculatePowerMultipleRegressionIncrement,
  calculatePowerLogisticRegression, calculatePowerMultipleLogisticRegression, calculatePowerPoissonRegression,
  generatePowerCurveCorrelations, generateEffectSizeCurveCorrelations,
  calculatePowerWilcoxonOneSample, calculatePowerMannWhitney, calculatePowerWilcoxonPaired,
  calculatePowerKruskalWallis, calculatePowerFriedman,
  calculatePowerAnovaOneWay, calculatePowerAnovaFactorial, calculatePowerAnovaRepeated, calculatePowerAnovaMixed,
  calculatePowerManovaOneWay, calculatePowerManovaFactorial, calculatePowerManovaRepeated,
  generatePowerCurveAnova, generateEffectSizeCurveAnova,
  calculatePowerOneSampleProportion, calculatePowerTwoProportions, calculatePowerSignTest,
  calculatePowerChiSquare2x2, calculatePowerFisherExact, calculatePowerMcNemar, calculatePowerCochranQ,
  calculatePowerChiSquareIndependence, calculatePowerGoodnessOfFit,
  generatePowerCurveProportions, generateEffectSizeCurveProportions,
  calculatePowerSensitivity, generatePowerCurveByN, generateEffectSizeCurveByEffect,
} = power as any;
const { calculateSampleSizePrevalence, calculateSampleSizeMean, calculateSampleSizeTwoMeans, calculateSampleSizeTwoProportions } = precision as any;

type Handler = (req: any, res: any) => any;
const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = [];
function register(method: string, path: string, ...cbs: any[]) {
  const keys: string[] = [];
  const pattern = new RegExp("^" + path.replace(/:([a-zA-Z]+)/g, (_m, k) => { keys.push(k); return "([^/]+)"; }) + "$");
  routes.push({ method, pattern, keys, handler: cbs[cbs.length - 1] });
}
const app = {
  get: (p: string, ...c: any[]) => register("GET", p, ...c),
  post: (p: string, ...c: any[]) => register("POST", p, ...c),
  delete: (p: string, ...c: any[]) => register("DELETE", p, ...c),
};
// Políticas da Academy substituídas por pass-through explícito (acesso público).
const requireAuth = null;
const checkExpiredUsageLimit = (..._a: any[]) => null;
const checkContentAccess = (..._a: any[]) => null;
const asyncHandler = (h: Handler) => h;
const logTrialEventFireAndForget = (..._a: any[]) => {};
// Dependências de banco/PDF não existem aqui; as rotas que as usam são
// substituídas abaixo pela versão de histórico local.
const db: any = undefined, eq: any = undefined, desc: any = undefined, fs: any = undefined, pdfService: any = undefined;
const powerAnalysisCalculations: any = undefined, sampleSizePrecisionCalculations: any = undefined;
const insertPowerAnalysisCalculationSchema: any = undefined, insertSampleSizePrecisionCalculationSchema: any = undefined;
type PowerAnalysisInput = any; type PrecisionInput = any;

// ======== INÍCIO: trechos exatos do backend original ========
// EXTRAÍDO DE server/routes.ts:21351. Referência, não módulo executável.
  // ==================== POWER ANALYSIS ROUTES ====================

  // Calculate statistical power (without saving)
  app.post("/api/power-analysis/calculate", requireAuth, checkExpiredUsageLimit('power_analysis', 'calculation'), checkContentAccess('tool', 'poder-amostral'), asyncHandler(async (req, res) => {
      const userId = (req.session as any)?.userId;
      const { testType, ...input } = req.body as { testType: string } & PowerAnalysisInput;
      
      let result;
      try {
      // SENSITIVITY mode: requested power + sample size, no effect provided.
      // Distinguishes from a-priori (power + effect, no n) and post-hoc
      // (effect + n, no power). Comparison tests send r2/r3 but not r1.
      const hasSample = input.n != null || input.n1 != null || input.n2 != null;
      const isSensitivity =
        input.power != null &&
        hasSample &&
        input.effectSize == null &&
        input.r1 == null;
      if (isSensitivity) {
        result = calculatePowerSensitivity(testType, input);
      } else {
      switch (testType) {
        case 'one-sample':
          result = calculatePowerOneSampleT(input);
          break;
        case 'paired':
          result = calculatePowerPairedT(input);
          break;
        case 'independent':
          result = calculatePowerIndependentT(input);
          break;
        case 'wilcoxon-one-sample':
          result = calculatePowerWilcoxonOneSample(input);
          break;
        case 'mann-whitney':
          result = calculatePowerMannWhitney(input);
          break;
        case 'wilcoxon-paired':
          result = calculatePowerWilcoxonPaired(input);
          break;
        case 'kruskal-wallis':
          result = calculatePowerKruskalWallis(input);
          break;
        case 'friedman':
          result = calculatePowerFriedman(input);
          break;
        case 'anova-oneway':
          result = calculatePowerAnovaOneWay(input);
          break;
        case 'anova-factorial':
          result = calculatePowerAnovaFactorial(input);
          break;
        case 'anova-repeated':
          result = calculatePowerAnovaRepeated(input);
          break;
        case 'anova-mixed':
          result = calculatePowerAnovaMixed(input);
          break;
        case 'manova-oneway':
          result = calculatePowerManovaOneWay(input);
          break;
        case 'manova-factorial':
          result = calculatePowerManovaFactorial(input);
          break;
        case 'manova-repeated':
          result = calculatePowerManovaRepeated(input);
          break;
        case 'pearson-correlation':
          result = calculatePowerPearsonCorrelation(input);
          break;
        case 'spearman-correlation':
          result = calculatePowerSpearmanCorrelation(input);
          break;
        case 'kendall-correlation':
          result = calculatePowerKendallCorrelation(input);
          break;
        case 'compare-correlations-independent':
          result = calculatePowerCompareCorrelationsIndependent(input);
          break;
        case 'compare-correlations-dependent':
          result = calculatePowerCompareCorrelationsDependent(input);
          break;
        case 'regression-simple':
          result = calculatePowerSimpleRegression(input);
          break;
        case 'regression-multiple-total':
          result = calculatePowerMultipleRegressionTotal(input);
          break;
        case 'regression-multiple-increment':
          result = calculatePowerMultipleRegressionIncrement(input);
          break;
        case 'logistic-regression':
          result = calculatePowerLogisticRegression(input);
          break;
        case 'multiple-logistic-regression':
          result = calculatePowerMultipleLogisticRegression(input);
          break;
        case 'poisson-regression':
          result = calculatePowerPoissonRegression(input);
          break;
        case 'proportion-one-sample':
          result = calculatePowerOneSampleProportion(input);
          break;
        case 'two-proportions':
          result = calculatePowerTwoProportions(input);
          break;
        case 'sign-test':
          result = calculatePowerSignTest(input);
          break;
        case 'chi-square-2x2':
          result = calculatePowerChiSquare2x2(input);
          break;
        case 'fisher-exact':
          result = calculatePowerFisherExact(input);
          break;
        case 'mcnemar':
          result = calculatePowerMcNemar(input);
          break;
        case 'cochran-q':
          result = calculatePowerCochranQ(input);
          break;
        case 'chi-square-independence':
          result = calculatePowerChiSquareIndependence(input);
          break;
        case 'goodness-of-fit':
          result = calculatePowerGoodnessOfFit(input);
          break;
        default:
          return res.status(400).json({ error: 'Invalid test type' });
      }
      }
      } catch (err: any) {
        const msgMap: Record<string, string> = {
          "Effect size (Cohen's d) is required": "Tamanho de efeito (Cohen's d) é obrigatório",
          "Effect size (Cohen's d equivalent) is required": "Tamanho de efeito (Cohen's d equivalente) é obrigatório",
          "Effect size (Cohen's f) is required": "Tamanho de efeito (Cohen's f) é obrigatório",
          "Effect size (Cohen's h) is required": "Tamanho de efeito (Cohen's h) é obrigatório",
          "Effect size (Cohen's w) is required": "Tamanho de efeito (Cohen's w) é obrigatório",
          "Effect size (g) is required": "Tamanho de efeito (g) é obrigatório",
          "Effect size (f²) is required": "Tamanho de efeito (f²) é obrigatório",
          "Effect size (correlation coefficient ρ) is required": "Tamanho de efeito (coeficiente de correlação ρ) é obrigatório",
          "Effect size (Kendall τ) is required": "Tamanho de efeito (Kendall τ) é obrigatório",
          "Effect size is required": "Tamanho de efeito é obrigatório",
          "Probability must be between 0 and 1": "Probabilidade deve estar entre 0 e 1",
          "Sample size must be positive": "Tamanho amostral deve ser positivo",
          "Sample size must be at least 4 for correlation": "Tamanho amostral deve ser pelo menos 4 para correlação",
          "Sample size must be at least 4 for simple regression": "Tamanho amostral deve ser pelo menos 4 para regressão simples",
          "Sample size must be at least 5 for proportion test": "Tamanho amostral deve ser pelo menos 5 para teste de proporção",
          "Sample size must be at least 10 for chi-square test": "Tamanho amostral deve ser pelo menos 10 para teste qui-quadrado",
          "Sample size must be at least 10 for Fisher exact test": "Tamanho amostral deve ser pelo menos 10 para teste exato de Fisher",
          "Sample size must be at least 4 for Kendall correlation": "Tamanho amostral deve ser pelo menos 4 para correlação de Kendall",
          "Both sample sizes must be at least 4 for correlation comparison": "Ambos os tamanhos amostrais devem ser pelo menos 4 para comparação de correlações",
          "Sample size must be at least 4 for correlation comparison": "Tamanho amostral deve ser pelo menos 4 para comparação de correlações",
          "At least 10 pairs are required for McNemar test": "São necessários pelo menos 10 pares para o teste de McNemar",
          "Each group must have at least 5 observations": "Cada grupo deve ter pelo menos 5 observações",
          "Sample size must be at least 6 for sign test": "Tamanho amostral deve ser pelo menos 6 para teste de sinais",
          "Number of groups (k) must be at least 2": "Número de grupos (k) deve ser pelo menos 2",
          "Number of groups (k) must be at least 3": "Número de grupos (k) deve ser pelo menos 3",
          "Number of conditions (k) must be at least 3": "Número de condições (k) deve ser pelo menos 3",
          "Number of categories (k) must be at least 2": "Número de categorias (k) deve ser pelo menos 2",
          "Number of rows and columns must be at least 2": "Número de linhas e colunas deve ser pelo menos 2",
          "Para tabelas 2×2 utilize o teste qui-quadrado 2×2 dedicado": "Para tabelas 2×2 utilize o teste qui-quadrado 2×2 dedicado",
          "Number of groups must be at least 2": "Número de grupos deve ser pelo menos 2",
          "Number of measurements must be at least 2": "Número de medidas deve ser pelo menos 2",
          "Each factor must have at least 2 levels": "Cada fator deve ter pelo menos 2 níveis",
          "Correlation between measures must be between 0 and 1 (exclusive)": "Correlação entre medidas deve estar entre 0 e 1 (exclusive)",
          "Sphericity correction (epsilon) must be between 0 and 1": "Correção de esfericidade (epsilon) deve estar entre 0 e 1",
          "Correlation must be between -1 and 1 (exclusive)": "Correlação deve estar entre -1 e 1 (exclusive)",
          "Correlation coefficient must be between -1 and 1 (exclusive)": "Coeficiente de correlação deve estar entre -1 e 1 (exclusive)",
          "Kendall τ must be between -1 and 1 (exclusive)": "Kendall τ deve estar entre -1 e 1 (exclusive)",
          "r₁ must be between -1 and 1 (exclusive)": "r₁ deve estar entre -1 e 1 (exclusive)",
          "r₂ must be between -1 and 1 (exclusive)": "r₂ deve estar entre -1 e 1 (exclusive)",
          "r₃ (r_yz) must be between -1 and 1 (exclusive)": "r₃ (r_yz) deve estar entre -1 e 1 (exclusive)",
          "f² must be non-negative": "f² deve ser não negativo",
          "Number of predictors must be at least 1": "Número de preditores deve ser pelo menos 1",
          "Number of tested predictors must be at least 1": "Número de preditores testados deve ser pelo menos 1",
          "Number of tested predictors cannot exceed total predictors": "O número de preditores testados não pode exceder o total de preditores",
          "Sample size must be greater than the number of predictors plus one": "Tamanho amostral deve ser maior que o número de preditores mais um",
          "Odds ratio is required": "Odds ratio (OR) é obrigatório",
          "Odds ratio must be positive": "Odds ratio (OR) deve ser positivo",
          "Odds ratio must differ from 1": "Odds ratio (OR) deve ser diferente de 1",
          "Baseline event probability is required": "Probabilidade basal do evento (P) é obrigatória",
          "Baseline event probability must be between 0 and 1 (exclusive)": "Probabilidade basal do evento (P) deve estar entre 0 e 1 (exclusive)",
          "R² of other predictors must be between 0 and 1 (1 exclusive)": "R² dos demais preditores deve estar entre 0 e 1 (1 exclusivo)",
          "Invalid X distribution": "Distribuição do preditor (X) inválida",
          "X distribution σ must be positive": "O parâmetro σ da distribuição do preditor deve ser positivo",
          "X distribution λ must be positive": "O parâmetro λ da distribuição do preditor deve ser positivo",
          "X distribution π must be between 0 and 1 (exclusive)": "O parâmetro π da distribuição do preditor deve estar entre 0 e 1 (exclusivo)",
          "Rate ratio is required": "Razão de taxas (RR) é obrigatória",
          "Rate ratio must be positive": "Razão de taxas (RR) deve ser positiva",
          "Rate ratio must differ from 1": "Razão de taxas (RR) deve ser diferente de 1",
          "Baseline event rate is required": "Taxa basal de eventos é obrigatória",
          "Baseline event rate must be positive": "Taxa basal de eventos deve ser positiva",
          "Predictor distribution leads to an undefined expected count for this rate ratio": "Para esta distribuição do preditor e razão de taxas, a contagem esperada de eventos é infinita (indefinida). Use a distribuição Normal, Binomial ou Poisson, ou reduza a razão de taxas.",
          "Effect size g deve ser no máximo 0.5": "Tamanho de efeito g deve ser no máximo 0,5",
          "Effect size (|Δz|) must be less than 4": "Tamanho de efeito (|Δz|) deve ser menor que 4",
          "Effect size is too small (r₁ and r₂ are nearly identical). Cannot perform power analysis.": "Tamanho de efeito muito pequeno (r₁ e r₂ são quase idênticos). Não é possível realizar a análise de poder.",
          "Either provide r₁ and r₂, or effectSize (Δz)": "Forneça r₁ e r₂, ou o tamanho de efeito (Δz)",
          "r₁ (r_xy) and r₂ (r_xz) are required": "r₁ (r_xy) e r₂ (r_xz) são obrigatórios",
          "Provide either power OR sample size (n), not both": "Forneça power OU tamanho amostral (n), não ambos",
          "Provide either power OR sample sizes (n1, n2), not both": "Forneça power OU tamanhos amostrais (n1, n2), não ambos",
          "Invalid combination of parameters. Provide either: (power) OR (power + n1) OR (n1 + n2) OR (n)": "Combinação inválida de parâmetros. Forneça: (power) OU (power + n1) OU (n1 + n2) OU (n)",
        };
        const originalMsg = err.message || '';
        const validationPatterns = [
          /required/i, /must be/i, /invalid.*param/i, /between/i,
          /at least/i, /positive/i, /provide either/i,
          /forneça/i,
        ];
        const isValidationError = msgMap[originalMsg] || validationPatterns.some(p => p.test(originalMsg));
        if (isValidationError) {
          const translatedMsg = msgMap[originalMsg] || originalMsg || 'Parâmetros de cálculo inválidos';
          return res.status(400).json({ error: translatedMsg });
        }
        throw err;
      }

      if (userId) logTrialEventFireAndForget(userId, 'tool_calculadora_amostral_used', testType);
      
      res.json(result);
  }));

  // Advanced tests whose power curves are produced by the generic generators
  // (reusing each test's own post-hoc power function). Excludes the families that
  // already have dedicated curve helpers (t-tests, one-way/factorial ANOVA,
  // single correlations, proportion family). compare-correlations-independent is
  // included for the EFFECT-SIZE curve only; its power-vs-N curve still uses the
  // dedicated correlations helper above.
  const ADVANCED_CURVE_TESTS = new Set<string>([
    'compare-correlations-independent',
    'compare-correlations-dependent',
    'regression-simple',
    'regression-multiple-total',
    'regression-multiple-increment',
    'logistic-regression',
    'multiple-logistic-regression',
    'poisson-regression',
    'anova-repeated',
    'anova-mixed',
    'manova-oneway',
    'manova-factorial',
    'manova-repeated',
  ]);

  // Build a PowerAnalysisInput carrying the fixed parameters for an advanced
  // curve. The varied dimension (N or the effect field) is filled in by the
  // generic generators; everything else is held constant here.
  const buildAdvancedCurveInput = (
    tt: string,
    body: any,
    alpha: number,
    tails: 'one' | 'two'
  ): PowerAnalysisInput => {
    const input: PowerAnalysisInput = {
      alpha,
      tails,
      effectSize: body.effectSize,
      r1: body.r1,
      r2: body.r2,
      r3: body.r3,
      n: body.n,
      numPredictors: body.numPredictors,
      numTestedPredictors: body.numTestedPredictors,
      baseProportion: body.baseProportion,
      r2OtherPredictors: body.r2OtherPredictors,
      baseRate: body.baseRate,
      xDistribution: body.xDistribution,
      xDistMu: body.xDistMu,
      xDistSigma: body.xDistSigma,
      xDistPi: body.xDistPi,
      xDistLambda: body.xDistLambda,
      numResponseVars: body.numResponseVars,
      k: body.k,
      numGroups: body.numGroups,
      numMeasurements: body.numMeasurements,
      correlationBetweenMeasures: body.correlationBetweenMeasures,
      sphericityCorrection: body.sphericityCorrection,
      effectType: body.effectType,
      numeratorDf: body.numeratorDf,
    };
    // The independent comparison reads two-group sample sizes; the frontend
    // sends n (= n1) and n2 in the effect-size payload.
    if (tt === 'compare-correlations-independent') {
      input.n1 = body.n;
      input.n2 = body.n2;
    }
    return input;
  };

  // Starting sample size for the power-vs-N curve, kept just above each test's
  // degrees-of-freedom floor so the curve does not begin with a flat zero run.
  const advancedCurveMinN = (tt: string, input: PowerAnalysisInput): number => {
    const p = input.numPredictors ?? 1;
    switch (tt) {
      case 'regression-simple':
        return 3;
      case 'regression-multiple-total':
      case 'regression-multiple-increment':
        return p + 2;
      case 'compare-correlations-dependent':
        return 4;
      case 'logistic-regression':
      case 'multiple-logistic-regression':
      case 'poisson-regression':
        return 5;
      case 'anova-mixed':
        return (input.numGroups ?? 2) + 1;
      case 'manova-oneway':
      case 'manova-factorial':
        return (input.k ?? 2) + (input.numResponseVars ?? 2) + 1;
      case 'manova-repeated':
        return (input.numGroups ?? 1) + (input.numResponseVars ?? 2) + 1;
      default:
        return 2;
    }
  };

  // Generate power curve data
  app.post("/api/power-analysis/curve", requireAuth, checkContentAccess('tool', 'poder-amostral'), asyncHandler(async (req, res) => {
      const { testType, effectSize, r1, r2, alpha, tails, maxN = 200, curveType = 'power-vs-n' } = req.body;

      // --- Sensitivity mode: power vs effect size at a fixed N ---
      if (curveType === 'effect-size') {
        const { n, n2, maxEffect = 1, k, numGroups = 2, numeratorDf = 1, numRows, numCols } = req.body;
        if (n === undefined || !alpha || !tails) {
          return res.status(400).json({ error: 'Missing required parameters (n, alpha, tails)' });
        }

        let esCurve: Array<{ effectSize: number; power: number }> = [];
        if (testType === 'pearson-correlation' || testType === 'spearman-correlation' || testType === 'kendall-correlation') {
          esCurve = generateEffectSizeCurveCorrelations(n, alpha, testType, tails, maxEffect);
        } else if (testType === 'anova-oneway') {
          esCurve = generateEffectSizeCurveAnova(n, alpha, 'one-way', maxEffect, k ?? 3, 2, 1);
        } else if (testType === 'anova-factorial') {
          esCurve = generateEffectSizeCurveAnova(n, alpha, 'factorial', maxEffect, 3, numGroups, numeratorDf);
        } else if (testType === 'proportion-one-sample' || testType === 'two-proportions' || testType === 'sign-test' || testType === 'chi-square-2x2' || testType === 'fisher-exact' || testType === 'mcnemar' || testType === 'cochran-q' || testType === 'chi-square-independence' || testType === 'goodness-of-fit') {
          esCurve = generateEffectSizeCurveProportions(n, alpha, testType, tails, maxEffect, { k, numRows, numCols });
        } else if (
          testType === 'one-sample' || testType === 'paired' || testType === 'independent' ||
          testType === 'wilcoxon-one-sample' || testType === 'mann-whitney' || testType === 'wilcoxon-paired' ||
          testType === 'kruskal-wallis' || testType === 'friedman'
        ) {
          // Mirror the power-vs-N fallback: nonparametric means tests reuse the
          // t-test power functions (same approximation already used elsewhere).
          const ttType: 'one-sample' | 'paired' | 'independent' =
            (testType === 'independent' || testType === 'mann-whitney')
              ? 'independent'
              : (testType === 'paired' || testType === 'wilcoxon-paired')
                ? 'paired'
                : 'one-sample';
          esCurve = generateEffectSizeCurveTTests(n, alpha, ttType, tails, maxEffect, n2);
        } else if (ADVANCED_CURVE_TESTS.has(testType)) {
          // Comparison correlations, regression family, repeated/mixed ANOVA and
          // MANOVA: reuse their own post-hoc functions via the generic generator.
          const baseInput = buildAdvancedCurveInput(testType, req.body, alpha, tails);
          esCurve = generateEffectSizeCurveByEffect(testType, baseInput, maxEffect);
        }
        // Truly unsupported families return an empty curve.
        return res.json(esCurve);
      }

      // --- A priori / post-hoc: power vs N ---
      // For correlation comparison, calculate effectSize from r1 and r2
      let computedEffectSize = effectSize;
      if (testType === 'compare-correlations-independent') {
        if (r1 === undefined || r2 === undefined || !alpha || !tails) {
          return res.status(400).json({ error: 'Missing required parameters (r1, r2, alpha, tails)' });
        }
        
        // Import fisherZ (defined earlier in correlations.ts - we need access to it)
        // For now, inline the Fisher Z calculation
        const fisherZ = (r: number) => 0.5 * Math.log((1 + r) / (1 - r));
        const z1 = fisherZ(r1);
        const z2 = fisherZ(r2);
        // Keep signed delta for proper directionality
        computedEffectSize = z1 - z2;
      } else if (testType === 'compare-correlations-dependent') {
        // The dependent-comparison power function reads r1/r2/r3 directly; no
        // single scalar effect size is needed for the power-vs-N curve.
        if (r1 === undefined || r2 === undefined || !alpha || !tails) {
          return res.status(400).json({ error: 'Missing required parameters (r1, r2, alpha, tails)' });
        }
      } else if (ADVANCED_CURVE_TESTS.has(testType)) {
        // Regression family, repeated/mixed ANOVA and MANOVA carry their effect
        // in `effectSize` (f², f, OR, RR) plus test-specific extras.
        if (effectSize === undefined || effectSize === null || !alpha || !tails) {
          return res.status(400).json({ error: 'Missing required parameters' });
        }
      } else if (!effectSize || !alpha || !tails) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      let curve;
      if (testType === 'pearson-correlation' || testType === 'spearman-correlation' || testType === 'kendall-correlation' || testType === 'compare-correlations-independent') {
        curve = generatePowerCurveCorrelations(computedEffectSize, alpha, testType, tails, maxN);
      } else if (testType === 'anova-oneway') {
        const { k = 3 } = req.body;
        curve = generatePowerCurveAnova(computedEffectSize, alpha, 'one-way', k, 2, 1, maxN);
      } else if (testType === 'anova-factorial') {
        const { numGroups = 2, numeratorDf = 1 } = req.body;
        curve = generatePowerCurveAnova(computedEffectSize, alpha, 'factorial', 3, numGroups, numeratorDf, maxN);
      } else if (testType === 'proportion-one-sample' || testType === 'two-proportions' || testType === 'sign-test' || testType === 'chi-square-2x2' || testType === 'fisher-exact' || testType === 'mcnemar' || testType === 'cochran-q' || testType === 'chi-square-independence' || testType === 'goodness-of-fit') {
        const { k, numRows, numCols } = req.body;
        curve = generatePowerCurveProportions(computedEffectSize, alpha, testType, tails, maxN, { k, numRows, numCols });
      } else if (ADVANCED_CURVE_TESTS.has(testType)) {
        // Comparison correlations (dependent), regression family, repeated/mixed
        // ANOVA and MANOVA: vary N over their own post-hoc power functions.
        const baseInput = buildAdvancedCurveInput(testType, req.body, alpha, tails);
        curve = generatePowerCurveByN(testType, baseInput, maxN, advancedCurveMinN(testType, baseInput));
      } else {
        curve = generatePowerCurveTTests(computedEffectSize, alpha, testType, tails, maxN);
      }
      
      // Always return array format for consistency with existing frontend code
      res.json(curve);
  }));

  // Save power analysis calculation to history
  app.post("/api/power-analysis/save", requireAuth, checkContentAccess('tool', 'poder-amostral'), asyncHandler(async (req, res) => {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const calculationData = insertPowerAnalysisCalculationSchema.parse({
        ...req.body,
        userId,
      });
      
      const [saved] = await db.insert(powerAnalysisCalculations)
        .values(calculationData)
        .returning();

      logTrialEventFireAndForget(userId, 'tool_calculadora_amostral_saved');
      
      res.status(201).json(saved);
  }));

  // Get user's power analysis history
  app.get("/api/power-analysis/history", requireAuth, checkContentAccess('tool', 'poder-amostral'), asyncHandler(async (req, res) => {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const history = await db.select()
        .from(powerAnalysisCalculations)
        .where(eq(powerAnalysisCalculations.userId, userId))
        .orderBy(desc(powerAnalysisCalculations.createdAt))
        .limit(100); // Last 100 calculations
      
      res.json(history);
  }));

  // Delete power analysis calculation from history
  app.delete("/api/power-analysis/:id", requireAuth, checkContentAccess('tool', 'poder-amostral'), asyncHandler(async (req, res) => {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const { id } = req.params;
      
      // Ensure user owns this calculation
      const [calculation] = await db.select()
        .from(powerAnalysisCalculations)
        .where(eq(powerAnalysisCalculations.id, id))
        .limit(1);
      
      if (!calculation) {
        return res.status(404).json({ error: 'Calculation not found' });
      }
      
      if (calculation.userId !== userId) {
        return res.status(403).json({ error: 'Not authorized to delete this calculation' });
      }
      
      await db.delete(powerAnalysisCalculations)
        .where(eq(powerAnalysisCalculations.id, id));
      
      res.json({ message: 'Calculation deleted successfully' });
  }));

  // Download power analysis report as PDF
  app.post("/api/power-analysis/download-pdf", requireAuth, checkContentAccess('tool', 'poder-amostral'), asyncHandler(async (req, res) => {
      const userId = (req.session as any)?.userId;
      const { testType, calculationType, inputs, results } = req.body;
      
      if (!testType || !calculationType || !inputs || !results) {
        return res.status(400).json({ error: 'Missing required data' });
      }
      
      const pdfPath = await pdfService.generatePowerAnalysisPDF({
        testType,
        calculationType,
        inputs,
        results,
      });

      if (userId) logTrialEventFireAndForget(userId, 'tool_calculadora_amostral_downloaded');
      
      res.download(pdfPath, `analise_poder_${testType}.pdf`, (err) => {
        if (err) {
          console.error('Error sending PDF:', err);
          res.status(500).json({ error: 'Failed to download PDF' });
        }
        
        fs.unlink(pdfPath).catch(console.error);
      });
  }));


// EXTRAÍDO DE server/routes.ts:21863. Referência, não módulo executável.
  // ==================== SAMPLE SIZE BY PRECISION ROUTES ====================

  const precisionInputSchema = z.object({
    prevalenceP: z.number().gt(0).lt(1),
    marginD: z.number().gt(0),
    confidenceLevel: z.number().gt(0).lt(100),
    precisionMode: z.enum(['absolute', 'relative']),
    populationN: z.number().int().positive().nullable().optional(),
    nonResponseRate: z.number().min(0).lt(1).nullable().optional(),
  });

  const meanInputSchema = z.object({
    sigmaSD: z.number().gt(0),
    meanMu: z.number().nullable().optional(),
    marginD: z.number().gt(0),
    confidenceLevel: z.number().gt(0).lt(100),
    precisionMode: z.enum(['absolute', 'relative']),
    populationN: z.number().int().positive().nullable().optional(),
    nonResponseRate: z.number().min(0).lt(1).nullable().optional(),
    useTDistribution: z.boolean().nullable().optional(),
  }).refine(
    (data) => data.precisionMode !== 'relative' || (data.meanMu != null && data.meanMu !== 0),
    { message: 'Informe a média esperada (μ) diferente de zero para o modo de precisão relativa.', path: ['meanMu'] },
  );

  const twoMeansInputSchema = z.object({
    sigmaSD: z.number().gt(0).optional(),
    sigma1: z.number().gt(0).optional(),
    sigma2: z.number().gt(0).optional(),
    sigmaMode: z.enum(['pooled', 'separate']).optional(),
    allocationRatio: z.number().gt(0).nullable().optional(),
    marginD: z.number().gt(0),
    confidenceLevel: z.number().gt(0).lt(100),
    precisionMode: z.enum(['absolute', 'relative']),
    populationN: z.number().int().positive().nullable().optional(),
    nonResponseRate: z.number().min(0).lt(1).nullable().optional(),
    useTDistribution: z.boolean().nullable().optional(),
  }).refine(
    (data) => (data.sigmaMode ?? 'pooled') !== 'pooled' || data.sigmaSD != null,
    { message: 'Informe o desvio-padrão comum (σ) para o modo pooled.', path: ['sigmaSD'] },
  ).refine(
    (data) => (data.sigmaMode ?? 'pooled') !== 'separate' || (data.sigma1 != null && data.sigma2 != null),
    { message: 'Informe σ₁ e σ₂ para o modo de desvios separados.', path: ['sigma1'] },
  );

  const twoProportionsInputSchema = z.object({
    p1: z.number().gt(0).lt(1),
    p2: z.number().gt(0).lt(1),
    allocationRatio: z.number().gt(0).nullable().optional(),
    marginD: z.number().gt(0),
    confidenceLevel: z.number().gt(0).lt(100),
    precisionMode: z.literal('absolute'),
    populationN: z.number().int().positive().nullable().optional(),
    nonResponseRate: z.number().min(0).lt(1).nullable().optional(),
  });

  app.post(
    "/api/sample-size-precision/calculate",
    requireAuth,
    checkExpiredUsageLimit('power_analysis', 'calculation'),
    checkContentAccess('tool', 'precisao-amostral'),
    asyncHandler(async (req, res) => {
      const userId = (req.session as any)?.userId;
      const { procedureType = 'prevalence-cochran', ...rest } = req.body ?? {};

      try {
        let result;
        if (procedureType === 'mean-population') {
          const parsed = meanInputSchema.safeParse(rest);
          if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Parâmetros inválidos' });
          }
          result = calculateSampleSizeMean(parsed.data as PrecisionInput);
        } else if (procedureType === 'diff-means') {
          const parsed = twoMeansInputSchema.safeParse(rest);
          if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Parâmetros inválidos' });
          }
          result = calculateSampleSizeTwoMeans(parsed.data as PrecisionInput);
        } else if (procedureType === 'diff-proportions') {
          const parsed = twoProportionsInputSchema.safeParse(rest);
          if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Parâmetros inválidos' });
          }
          result = calculateSampleSizeTwoProportions(parsed.data as PrecisionInput);
        } else {
          const parsed = precisionInputSchema.safeParse(rest);
          if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Parâmetros inválidos' });
          }
          result = calculateSampleSizePrevalence(parsed.data as PrecisionInput);
        }
        if (userId) logTrialEventFireAndForget(userId, 'tool_precisao_amostral_used', procedureType);
        res.json({ ...result, procedureType });
      } catch (err: any) {
        return res.status(400).json({ error: err?.message ?? 'Erro no cálculo' });
      }
    })
  );

  app.post(
    "/api/sample-size-precision/save",
    requireAuth,
    checkContentAccess('tool', 'precisao-amostral'),
    asyncHandler(async (req, res) => {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const payload = insertSampleSizePrecisionCalculationSchema.parse({
        ...req.body,
        userId,
        zUsed: String(req.body?.zUsed ?? ''),
      });

      const [saved] = await db.insert(sampleSizePrecisionCalculations).values(payload).returning();
      logTrialEventFireAndForget(userId, 'tool_calculadora_amostral_saved', `precisao:${payload.procedureType}`);
      res.status(201).json(saved);
    })
  );

  app.get(
    "/api/sample-size-precision/history",
    requireAuth,
    checkContentAccess('tool', 'precisao-amostral'),
    asyncHandler(async (req, res) => {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      const history = await db.select().from(sampleSizePrecisionCalculations)
        .where(eq(sampleSizePrecisionCalculations.userId, userId))
        .orderBy(desc(sampleSizePrecisionCalculations.createdAt))
        .limit(100);
      res.json(history);
    })
  );

  app.delete(
    "/api/sample-size-precision/:id",
    requireAuth,
    checkContentAccess('tool', 'precisao-amostral'),
    asyncHandler(async (req, res) => {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      const { id } = req.params;
      const [row] = await db.select().from(sampleSizePrecisionCalculations)
        .where(eq(sampleSizePrecisionCalculations.id, id)).limit(1);
      if (!row) return res.status(404).json({ error: 'Calculation not found' });
      if (row.userId !== userId) return res.status(403).json({ error: 'Not authorized' });
      await db.delete(sampleSizePrecisionCalculations).where(eq(sampleSizePrecisionCalculations.id, id));
      res.json({ message: 'Deleted' });
    })
  );


// ======== FIM dos trechos exatos ========

export { routes, register };
