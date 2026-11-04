export type PrecisionMode = 'absolute' | 'relative';

export type PrecisionProcedureType = 'prevalence-cochran' | 'mean-population' | 'diff-means' | 'diff-proportions';

export type SigmaMode = 'pooled' | 'separate';

export interface PrecisionInput {
  // Prevalência (Cochran)
  prevalenceP?: number;
  // Média populacional
  sigmaSD?: number;
  meanMu?: number;
  // Diferença de médias (dois grupos independentes)
  sigma1?: number;
  sigma2?: number;
  sigmaMode?: SigmaMode;
  // Diferença de proporções (dois grupos independentes)
  p1?: number;
  p2?: number;
  // Alocação desigual entre os dois grupos (procedimentos diff-means e
  // diff-proportions). Razão k = n₂/n₁: 1 = grupos iguais (default); 2 = o
  // grupo 2 tem o dobro do grupo 1; 0,5 = o grupo 1 tem o dobro do grupo 2.
  // Ignorado nos procedimentos de um único grupo.
  allocationRatio?: number | null;
  // Comuns
  marginD: number;
  confidenceLevel: number;
  precisionMode: PrecisionMode;
  populationN?: number | null;
  nonResponseRate?: number | null;
  // Refinamento iterativo com a distribuição t de Student (mean-population e
  // diff-means). Quando true, o n é recalculado iterando o quantil t até
  // convergir, em vez de usar o quantil normal z. Os g.l. dependem do desenho:
  // n−1 (média populacional) ou do desenho de duas amostras (diferença de
  // médias: pooled 2·(n−1); separado Welch–Satterthwaite). Melhora a acurácia
  // para amostras pequenas (n < ~30).
  useTDistribution?: boolean | null;
}

export interface TRefinementInfo {
  // Quantil t usado na convergência (1 − α/2, com dfUsed g.l.).
  tUsed: number;
  // Graus de liberdade na convergência (n − 1).
  dfUsed: number;
  // Número de iterações até convergir.
  iterations: number;
  // Se a iteração estabilizou dentro do limite de iterações.
  converged: boolean;
}

export interface PrecisionResult {
  procedureType: PrecisionProcedureType;
  input: PrecisionInput;
  zUsed: number;
  n0: number;
  nFinite: number | null;
  nAdjusted: number | null;
  // Tamanhos finais por grupo nos procedimentos de dois grupos (diff-means e
  // diff-proportions), honrando a razão de alocação k = n₂/n₁. Em alocação
  // igual (k = 1) valem n1 = n2 = (nAdjusted ?? nFinite ?? n0). Ausentes nos
  // procedimentos de um único grupo.
  n1?: number;
  n2?: number;
  formula: {
    n0: string;
    nFinite?: string;
    nAdjusted?: string;
  };
  warnings: string[];
  // Presente apenas quando useTDistribution=true (mean-population). Documenta o
  // quantil t e os g.l. usados no refinamento iterativo.
  tRefinement?: TRefinementInfo | null;
}
