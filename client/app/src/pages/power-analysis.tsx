import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToolUsageTracking, TOOL_TYPES, ACTION_TYPES } from "@/hooks/useToolUsageTracking";
import { ToolLimitReachedCard } from "@/components/tools/ToolLimitReachedCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Calculator, Save, Trash2, Info, LineChart, FileDown, History, Copy, BookOpen, ChevronDown, ChevronUp, Check, AlertCircle } from "lucide-react";
import { CalculadoraTipoSelector } from "@/components/CalculadoraAmostralTabs";
import { SampleSizeInfoModal } from "@/components/SampleSizeInfoModal";
import { getSampleSizeInfo } from "@/lib/sampleSizeInfo";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LineChart as RechartsLine, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from "recharts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EffectSizeRatingWidget, { logEffectSizeCalculation } from "@/components/tools/EffectSizeRatingWidget";

// Types
type Macrocategory = 'means' | 'correlations' | 'proportions' | 'reliability';
type CalculationMode = 'calculate-n' | 'have-n-power' | 'have-n-effect';
type Tails = 'one' | 'two';

interface PowerAnalysisResult {
  power?: number;
  requiredN?: number;
  requiredN1?: number;
  requiredN2?: number;
  minDetectableEffect?: number;
  effectSize: number;
  alpha: number;
  df: number;
  df2?: number;
  criticalValue: number;
  testType: string;
  k?: number;
  numLevelsA?: number;
  numLevelsB?: number;
  numeratorDf?: number;
  effectType?: 'main_a' | 'main_b' | 'interaction' | 'within' | 'between' | 'within_between';
  effectLabel?: string;
  numMeasurements?: number;
  numGroups?: number;
  correlationBetweenMeasures?: number;
  sphericityCorrection?: number;
  nPerGroup?: number;
  // MANOVA specific
  numResponseVars?: number;
  pillaiV?: number;
  // Regression specific
  numPredictors?: number;
  numTestedPredictors?: number;
  baseProportion?: number;
  r2OtherPredictors?: number;
  xDistribution?: string;
  xDistMu?: number;
  xDistSigma?: number;
  xDistPi?: number;
  xDistLambda?: number;
  baseRate?: number;
}

interface PowerAnalysisCalculation {
  id: string;
  testType: string;
  testFamily: string;
  inputParameters: any;
  calculatedPower: string | null;
  requiredSampleSize: number | null;
  effectSize: string | null;
  alpha: string | null;
  notes: string | null;
  createdAt: string;
  fullResult?: PowerAnalysisResult;
}

// Test definitions
interface TestDefinition {
  id: string;
  label: string;
  description: string;
  category: Macrocategory;
  implemented: boolean;
  hidden?: boolean;  // Hide from the selector list (e.g. redundant with a more general version)
  tooltip?: string;  // Detailed explanation with example for the test
}

// TEST_DEFINITIONS must be defined BEFORE helper functions that reference it
const TEST_DEFINITIONS: TestDefinition[] = [
  // MÉDIAS - Testes Paramétricos
  { 
    id: 'one-sample-t', 
    label: 'Média de 1 grupo (t de 1 amostra)', 
    description: 'Teste se uma média amostral difere de um valor conhecido', 
    category: 'means', 
    implemented: true,
    tooltip: 'Verifica se a média de um único grupo difere de um valor de referência conhecido (média populacional histórica, valor teórico, ponto de corte).\n\nExemplo: testar se o QI médio de estudantes de uma escola difere de 100. A hipótese nula afirma que a média do grupo é igual ao valor de referência.\n\nTamanho de efeito: d de Cohen, que mede a diferença entre a média esperada e o valor de referência em unidades de desvio-padrão.\n• Pequeno: d = 0,20\n• Médio: d = 0,50\n• Grande: d = 0,80\n\nReferência: para d = 0,50 com α = 0,05 bilateral e poder = 0,80, são necessários ~34 sujeitos.'
  },
  { 
    id: 'wilcoxon-one-sample', 
    label: 'Wilcoxon de 1 amostra', 
    description: 'Alternativa não-paramétrica ao t de 1 amostra', 
    category: 'means', 
    implemented: true,
    tooltip: 'Alternativa não-paramétrica ao t de uma amostra (Wilcoxon signed-rank). Compara a mediana de um grupo com um valor de referência quando os dados não são normais ou são ordinais.\n\nExemplo: testar se o tempo mediano de recuperação após uma cirurgia difere de 14 dias, quando os tempos têm distribuição assimétrica. A hipótese nula afirma que a mediana do grupo é igual ao valor de referência.\n\nTamanho de efeito: d de Cohen na escala paramétrica equivalente, que mede a diferença em unidades de desvio-padrão, com o ajuste de eficiência do G*Power (método A.R.E., distribuição de origem normal, A.R.E. = 3/π ≈ 0,955).\n• Pequeno: d = 0,20\n• Médio: d = 0,50\n• Grande: d = 0,80\n\nReferência: para d = 0,50 com α = 0,05 bilateral e poder = 0,80, são necessários 35 sujeitos (igual ao G*Power).'
  },
  { 
    id: 'independent-t', 
    label: 'Dois grupos independentes (t de Student / Welch)', 
    description: 'Teste se duas médias independentes diferem', 
    category: 'means', 
    implemented: true,
    tooltip: 'Compara as médias de dois grupos independentes, com sujeitos diferentes em cada grupo.\n\nExemplo: comparar a eficácia de dois tratamentos para ansiedade aplicados a grupos distintos de pacientes. A hipótese nula afirma que as duas médias populacionais são iguais.\n\nTamanho de efeito: d de Cohen, que mede a diferença entre as duas médias em unidades de desvio-padrão.\n• Pequeno: d = 0,20\n• Médio: d = 0,50\n• Grande: d = 0,80\n\nReferência: para d = 0,50 com α = 0,05 bilateral, poder = 0,80 e grupos iguais, são necessários ~64 sujeitos por grupo (128 no total).'
  },
  { 
    id: 'mann-whitney', 
    label: 'Dois grupos independentes: Mann-Whitney', 
    description: 'Alternativa não-paramétrica ao t independente', 
    category: 'means', 
    implemented: true,
    tooltip: 'Alternativa não-paramétrica ao t de amostras independentes (teste U de Mann-Whitney). Compara a distribuição de dois grupos independentes quando os dados são ordinais ou não-normais.\n\nExemplo: comparar a satisfação de clientes (escala Likert de 1 a 10) entre duas lojas. A hipótese nula afirma que os dois grupos têm distribuições com o mesmo formato, ou seja, distribuições iguais.\n\nTamanho de efeito: d de Cohen na escala paramétrica equivalente, que mede a diferença em unidades de desvio-padrão, com o ajuste de eficiência do G*Power (método A.R.E., distribuição de origem normal, A.R.E. = 3/π ≈ 0,955).\n• Pequeno: d = 0,20\n• Médio: d = 0,50\n• Grande: d = 0,80\n\nReferência: para d = 0,50 com α = 0,05 bilateral, poder = 0,80 e grupos iguais, são necessários 67 sujeitos por grupo (134 no total), igual ao G*Power.'
  },
  { 
    id: 'paired-t', 
    label: 'Dois grupos pareados (t pareado)', 
    description: 'Teste diferenças entre observações pareadas', 
    category: 'means', 
    implemented: true,
    tooltip: 'Compara duas medições do mesmo sujeito, como antes e depois, pré e pós-intervenção, dois momentos no tempo, olho esquerdo e direito, ou gêmeos pareados.\n\nExemplo: avaliar se a pressão arterial mudou após um programa de exercícios nos mesmos pacientes.\n\nTamanho de efeito: d_z de Cohen, que mede a diferença média entre as duas medições em relação à variação dessas diferenças (use a variação das diferenças, não a das medidas brutas).\n• Pequeno: d_z = 0,20\n• Médio: d_z = 0,50\n• Grande: d_z = 0,80\n\nQuando a correlação entre as duas medidas é alta, o n pareado fica bem menor que o de um teste independente equivalente.'
  },
  { 
    id: 'wilcoxon-paired', 
    label: 'Dois grupos pareados: Wilcoxon pareado', 
    description: 'Alternativa não-paramétrica ao t pareado', 
    category: 'means', 
    implemented: true,
    tooltip: 'Alternativa não-paramétrica ao t pareado (teste de Wilcoxon com sinal de postos). Compara duas medições pareadas quando as diferenças intra-sujeito não são normais ou os dados são ordinais.\n\nExemplo: comparar níveis de dor antes e após tratamento usando uma escala ordinal (de 0 a 10) nos mesmos pacientes. A hipótese nula afirma que não há diferença típica entre as duas medições.\n\nTamanho de efeito: d_z de Cohen na escala das diferenças, que mede a diferença média em relação à variação dessas diferenças, com o ajuste de eficiência do G*Power (método A.R.E., distribuição de origem normal, A.R.E. = 3/π ≈ 0,955).\n• Pequeno: d_z = 0,20\n• Médio: d_z = 0,50\n• Grande: d_z = 0,80\n\nReferência: para d_z = 0,50 com α = 0,05 bilateral e poder = 0,80, são necessários 35 pares (igual ao G*Power).'
  },
  { 
    id: 'anova-oneway', 
    label: 'ANOVA one-way', 
    description: 'Comparação de 3+ grupos independentes', 
    category: 'means', 
    implemented: true,
    tooltip: 'Compara as médias de três ou mais grupos independentes formados por um único fator de classificação. A hipótese nula afirma que todos os grupos têm a mesma média.\n\nExemplo: comparar a perda de peso entre três tipos de dieta (baixo carboidrato, vegetariana, mediterrânea).\n\nTamanho de efeito: f de Cohen, que mede o quanto as médias dos grupos se espalham em relação à variação dentro dos grupos.\n• Pequeno: f = 0,10\n• Médio: f = 0,25\n• Grande: f = 0,40\n\nReferência: para f = 0,25 com k = 3, α = 0,05 e poder = 0,80, são necessários ~53 sujeitos por grupo.'
  },
  { 
    id: 'kruskal-wallis', 
    label: 'Kruskal-Wallis', 
    description: 'Alternativa não-paramétrica à ANOVA one-way', 
    category: 'means', 
    implemented: true,
    tooltip: 'Alternativa não-paramétrica à ANOVA one-way (teste H de Kruskal-Wallis). Compara a distribuição de 3 ou mais grupos independentes quando os dados são ordinais ou não-normais.\n\nExemplo: comparar a satisfação de funcionários (escala Likert) entre três departamentos. A hipótese nula afirma que os grupos têm a mesma distribuição.\n\nTamanho de efeito: f de Cohen na escala paramétrica equivalente, que mede o quanto as médias dos grupos se espalham em relação à variação dentro dos grupos, com o ajuste de eficiência A.R.E. = 3/π ≈ 0,955 (distribuição de origem normal).\n• Pequeno: f = 0,10\n• Médio: f = 0,25\n• Grande: f = 0,40\n\nReferência: para f = 0,25 com k = 3, α = 0,05 e poder = 0,80, são necessários ~55 sujeitos por grupo (cerca de 165 no total). O Kruskal-Wallis é sempre unilateral por construção.'
  },
  { 
    id: 'anova-factorial', 
    label: 'ANOVA fatorial', 
    description: 'Efeitos principais + interação', 
    category: 'means', 
    implemented: true,
    tooltip: 'Planeja o n para detectar qualquer efeito (efeito principal de um fator ou interação) em um delineamento fatorial entre-sujeitos. Corresponde ao modelo "ANOVA: Fixed effects, special, main effects and interactions" do G*Power, que pede apenas dois valores: o número de grupos e os graus de liberdade do numerador (gl₁) do efeito testado. A hipótese nula afirma que o efeito de interesse é nulo.\n\nComo definir os gl do numerador:\n• Efeito principal de um fator com a níveis: gl₁ = a − 1\n• Interação A×B: gl₁ = (a − 1)(b − 1)\n\nO número de grupos é o total de células do delineamento (ex.: um 2×3 tem 6 grupos). Os gl do denominador são calculados como gl₂ = N − número de grupos.\n\nExemplo: em um delineamento 2×3 (6 grupos), a interação tem gl₁ = (2 − 1)(3 − 1) = 2.\n\nTamanho de efeito: f de Cohen, que mede a magnitude do efeito de interesse em relação à variação dentro dos grupos.\n• Pequeno: f = 0,10\n• Médio: f = 0,25\n• Grande: f = 0,40\n\nO n retornado é o tamanho amostral total. Referência: para a interação em um 2×3 (6 grupos, gl₁ = 2) com f = 0,25, α = 0,05 e poder = 0,80, são necessários ~158 participantes no total.'
  },
  { 
    id: 'anova-repeated', 
    label: 'ANOVA de medidas repetidas (within)', 
    description: 'Comparações intra-sujeitos', 
    category: 'means', 
    implemented: true,
    tooltip: 'Compara médias de 3 ou mais medições repetidas nos mesmos sujeitos (fator intra-sujeitos). A hipótese nula afirma que a média é a mesma em todos os momentos.\n\nExemplo: avaliar mudanças no desempenho cognitivo em 3 momentos (pré-teste, 1 mês, 3 meses) nos mesmos participantes.\n\nTamanho de efeito: f de Cohen, que mede o quanto as médias dos momentos se espalham em relação à variação dentro dos sujeitos.\n• Pequeno: f = 0,10\n• Médio: f = 0,25\n• Grande: f = 0,40\n\nQuanto maior a correlação entre as medidas repetidas, mais econômico fica o delineamento. Referência: para 3 medições, f = 0,25, correlação de 0,5 entre as medidas e esfericidade assumida (α = 0,05, poder = 0,80), são necessários ~28 sujeitos.'
  },
  { 
    id: 'anova-mixed', 
    label: 'ANOVA mista (between × within)', 
    description: 'Combinação de fatores entre e intra-sujeitos', 
    category: 'means', 
    implemented: true,
    tooltip: 'Analisa um delineamento com pelo menos um fator entre-sujeitos (grupos) e um fator intra-sujeitos (medidas repetidas). Planeja para o efeito entre grupos, o efeito ao longo do tempo ou a interação entre grupo e tempo. A hipótese nula afirma que o efeito de interesse é nulo.\n\nExemplo: comparar dois tratamentos (fator entre grupos) medidos em 3 momentos (fator intra), avaliando se a evolução ao longo do tempo difere entre os tratamentos (interação).\n\nTamanho de efeito: f de Cohen, que mede a magnitude do efeito de interesse em relação à variação dentro dos grupos.\n• Pequeno: f = 0,10\n• Médio: f = 0,25\n• Grande: f = 0,40\n\nO resultado é o número total de sujeitos (todos os grupos somados). Referência: para 2 grupos, 3 medições, f = 0,25 e correlação de 0,5 entre as medidas (α = 0,05, poder = 0,80), a interação exige ~28 no total (14 por grupo) e o efeito entre grupos ~44 no total.'
  },
  { 
    id: 'friedman', 
    label: 'Friedman', 
    description: 'Alternativa não-paramétrica à ANOVA de medidas repetidas', 
    category: 'means', 
    implemented: true,
    tooltip: 'Alternativa não-paramétrica à ANOVA de medidas repetidas (teste de Friedman). Compara 3 ou mais medições relacionadas nos mesmos sujeitos quando os dados são ordinais ou não-normais.\n\nExemplo: avaliar a preferência de consumidores por 4 sabores de um produto usando ranking, com cada pessoa provando todos os sabores. A hipótese nula afirma que a distribuição é a mesma em todas as condições.\n\nTamanho de efeito: f de Cohen na escala paramétrica equivalente, que mede o quanto as condições se diferenciam em relação à variação interna, com o ajuste de eficiência A.R.E. = 3/π ≈ 0,955 (distribuição de origem normal).\n• Pequeno: f = 0,10\n• Médio: f = 0,25\n• Grande: f = 0,40\n\nReferência: para f = 0,25 com k = 3, α = 0,05 e poder = 0,80, são necessários ~56 sujeitos. O Friedman é sempre unilateral por construção e não exige a correlação entre medidas como entrada.'
  },
  { 
    id: 'manova', 
    label: 'MANOVA (one-way)', 
    description: 'Compara grupos em várias variáveis-resposta ao mesmo tempo', 
    category: 'means', 
    implemented: true,
    tooltip: 'Planeja o n para a MANOVA one-way: compara as médias de k grupos independentes considerando várias variáveis-resposta (VDs) simultaneamente. A hipótese nula afirma que os vetores de médias são iguais em todos os grupos. O teste usado é o traço de Pillai (V), com aproximação pela distribuição F (como no G*Power).\n\nExemplo: comparar 3 métodos de ensino quanto a um conjunto de 2 desfechos (nota em matemática e nota em leitura) avaliados nos mesmos alunos de cada grupo.\n\nTamanho de efeito: f²(V) de Pillai, que mede a separação multivariada dos grupos. Você o informa diretamente (mesma convenção do G*Power).\n• Pequeno: f²(V) = 0,02\n• Médio: f²(V) = 0,15\n• Grande: f²(V) = 0,35\n\nO valor retornado é o tamanho amostral total. Quanto mais variáveis-resposta, maior o n necessário.'
  },
  { 
    id: 'manova-factorial', 
    label: 'MANOVA Fatorial', 
    description: 'Efeitos e interações multivariados em delineamentos fatoriais', 
    category: 'means', 
    implemented: true,
    tooltip: 'Planeja o n para um efeito específico (efeito principal ou interação) em uma MANOVA fatorial, considerando várias variáveis-resposta. Você informa o número de grupos (células), o número de variáveis-resposta e o número de preditores do efeito testado (graus de liberdade da hipótese). O teste usado é o traço de Pillai (V).\n\nExemplo: em um delineamento com tratamento × sexo, testar a interação sobre 3 desfechos clínicos medidos em cada participante.\n\nTamanho de efeito: f²(V) de Pillai, informado diretamente.\n• Pequeno: f²(V) = 0,02\n• Médio: f²(V) = 0,15\n• Grande: f²(V) = 0,35\n\nO valor retornado é o tamanho amostral total. Referência (G*Power): para f²(V) = 0,0625, α = 0,05, poder = 0,95, 6 grupos, 2 variáveis-resposta e 3 preditores, são necessários 171 sujeitos no total.'
  },
  { 
    id: 'manova-repeated', 
    label: 'MANOVA de Medidas Repetidas', 
    description: 'Medidas intra-sujeitos por abordagem multivariada (sem esfericidade)', 
    category: 'means', 
    implemented: true,
    tooltip: 'Planeja o n para o efeito intra-sujeitos (tempo) usando a abordagem multivariada (análise de perfil / T² de Hotelling). As m medições são transformadas em (m − 1) variáveis de diferença e testadas como uma única hipótese multivariada — por isso NÃO é preciso assumir esfericidade nem informar a correlação entre medidas.\n\nExemplo: avaliar a mudança de um desfecho em 4 momentos nos mesmos participantes, sem assumir esfericidade.\n\nTamanho de efeito: f²(V) de Pillai, informado diretamente (já incorpora a estrutura de covariância das medidas).\n• Pequeno: f²(V) = 0,02\n• Médio: f²(V) = 0,15\n• Grande: f²(V) = 0,35\n\nO valor retornado é o tamanho amostral total. Use o número de grupos = 1 para um único grupo.'
  },

  // CORRELAÇÕES E REGRESSÕES
  { 
    id: 'pearson-correlation', 
    label: 'Correlação de Pearson', 
    description: 'Correlação linear entre duas variáveis contínuas', 
    category: 'correlations', 
    implemented: true,
    tooltip: 'Testa se existe associação linear entre duas variáveis contínuas (coeficiente r de Pearson). A hipótese nula afirma que não existe correlação entre as duas variáveis.\n\nExemplo: investigar a relação entre horas de estudo e desempenho em provas.\n\nTamanho de efeito: a própria correlação esperada, em valor absoluto, que vai de 0 (sem relação) a 1 (relação perfeita).\n• Pequeno: 0,10\n• Médio: 0,30\n• Grande: 0,50\n\nReferência: para uma correlação de 0,30 com α = 0,05 e poder = 0,80, são necessários ~85 sujeitos. Para 0,10, cerca de 782 sujeitos.'
  },
  { 
    id: 'spearman-correlation', 
    label: 'Correlação de Spearman', 
    description: 'Correlação não-paramétrica baseada em ranks', 
    category: 'correlations', 
    implemented: true,
    tooltip: 'Correlação não-paramétrica baseada em postos. Avalia associação monotônica (não necessariamente linear) entre variáveis, útil para dados ordinais ou não-normais. A hipótese nula afirma que não há associação monotônica entre as variáveis.\n\nExemplo: relação entre posição no ranking de vendas e satisfação no trabalho.\n\nTamanho de efeito: a correlação de postos esperada, em valor absoluto, que vai de 0 a 1.\n• Pequeno: 0,10\n• Médio: 0,30\n• Grande: 0,50\n\nPara o planejamento amostral usa a mesma aproximação do Pearson. Referência: para uma correlação de 0,30 com α = 0,05 e poder = 0,80, são necessários ~85 sujeitos (igual ao Pearson).'
  },
  { 
    id: 'kendall-correlation', 
    label: 'Correlação de Kendall Tau-b', 
    description: 'Correlação não-paramétrica para dados ordinais', 
    category: 'correlations', 
    implemented: true,
    tooltip: 'Correlação não-paramétrica baseada na concordância e discordância entre pares de observações (Kendall tau-b). Robusta para amostras pequenas e muitos empates. A hipótese nula afirma que não há associação ordinal entre as variáveis.\n\nExemplo: concordância entre dois juízes que ordenam candidatos por preferência.\n\nTamanho de efeito: o tau de Kendall esperado, em valor absoluto, que vai de 0 a 1.\n• Pequeno: 0,10\n• Médio: 0,30\n• Grande: 0,50\n\nReferência: para um tau de 0,30 com α = 0,05 e poder = 0,80, são necessários ~43 sujeitos. Lembre que o tau costuma ser menor que a correlação de Pearson para a mesma relação.'
  },
  { 
    id: 'compare-correlations-independent', 
    label: 'Comparação de duas correlações independentes', 
    description: 'Teste se duas correlações de amostras diferentes diferem', 
    category: 'correlations', 
    implemented: true,
    tooltip: 'Compara a correlação entre as mesmas duas variáveis medida em duas amostras independentes. A hipótese nula afirma que a correlação é igual nas duas populações.\n\nExemplo: a correlação entre ansiedade e desempenho difere entre homens e mulheres (amostras separadas)?\n\nTamanho de efeito: a diferença entre as duas correlações. Como referência aproximada:\n• Pequeno: 0,10\n• Médio: 0,30\n• Grande: 0,50\n\nO n depende não só da diferença, mas também de quão próximas de 0 ou de 1 estão as correlações. Referência: para correlações de 0,50 e 0,20 (α = 0,05, poder = 0,80), são necessários ~134 por grupo (268 no total).'
  },
  { 
    id: 'compare-correlations-dependent', 
    label: 'Comparação de correlações dependentes', 
    description: 'Teste se correlações da mesma amostra diferem', 
    category: 'correlations', 
    implemented: true,
    tooltip: 'Compara, na mesma amostra, duas correlações que compartilham uma variável em comum. A hipótese nula afirma que as duas correlações são iguais.\n\nExemplo: na mesma amostra de alunos, a correlação entre inteligência e matemática é maior que entre inteligência e linguagem?\n\nTamanho de efeito: a diferença entre as duas correlações; também é preciso informar a correlação entre as duas variáveis não compartilhadas. Como referência aproximada:\n• Pequeno: 0,10\n• Médio: 0,30\n• Grande: 0,50\n\nReferência: para correlações de 0,60 e 0,30, com 0,40 entre as variáveis não compartilhadas (α = 0,05, poder = 0,80), são necessários ~75 sujeitos. Os modos de cálculo de tamanho e de poder usam a mesma fórmula de Steiger e concordam entre si.'
  },
  { 
    id: 'regression-simple', 
    label: 'Regressão linear simples', 
    description: 'Predição com um preditor', 
    category: 'correlations', 
    implemented: true,
    hidden: true,
    tooltip: 'Testa se um único preditor contínuo explica parte relevante da variação do desfecho. A hipótese nula afirma que o preditor não tem relação com o desfecho.\n\nExemplo: anos de experiência predizem o salário?\n\nTamanho de efeito: f² de Cohen, que mede a proporção da variação do desfecho explicada pelo preditor.\n• Pequeno: f² = 0,02\n• Médio: f² = 0,15\n• Grande: f² = 0,35\n\nReferência: para f² = 0,15 com α = 0,05 e poder = 0,80, são necessários ~55 sujeitos; para f² = 0,02, cerca de 395. Com um único preditor, o resultado coincide com o da correlação de Pearson.'
  },
  {
    id: 'regression-multiple-total',
    label: 'Regressão linear múltipla (R² total)',
    description: 'Poder do modelo completo',
    category: 'correlations',
    implemented: true,
    tooltip: 'Testa se o conjunto de preditores, em conjunto, explica parte relevante da variação do desfecho. A hipótese nula afirma que o R² do modelo completo é zero (nenhum preditor contribui).\n\nExemplo: idade, escolaridade e renda, juntas, predizem o bem-estar?\n\nTamanho de efeito: f² de Cohen, calculado como R² / (1 − R²).\n• Pequeno: f² = 0,02\n• Médio: f² = 0,15\n• Grande: f² = 0,35\n\nÉ preciso informar o número de preditores do modelo. Referência: para f² = 0,15, α = 0,05 e poder = 0,80 com 5 preditores, são necessários ~92 sujeitos.'
  },
  {
    id: 'regression-multiple-increment',
    label: 'Regressão linear múltipla (incremento de R²)',
    description: 'Contribuição única de preditores',
    category: 'correlations',
    implemented: true,
    tooltip: 'Testa se um bloco de preditores acrescenta variação explicada além da já captada pelos demais (modelo hierárquico). A hipótese nula afirma que o incremento de R² é zero.\n\nExemplo: depois de controlar idade e sexo, adicionar três medidas de personalidade melhora a predição?\n\nTamanho de efeito: f² de Cohen para o incremento, calculado como (R²_completo − R²_reduzido) / (1 − R²_completo).\n• Pequeno: f² = 0,02\n• Médio: f² = 0,15\n• Grande: f² = 0,35\n\nÉ preciso informar o total de preditores do modelo completo e quantos estão sendo testados. Referência: para f² = 0,15, α = 0,05 e poder = 0,80, com 5 preditores no total e 3 testados, são necessários ~79 sujeitos.'
  },
  {
    id: 'logistic-regression',
    label: 'Regressão logística (OR esperado)',
    description: 'Predição de variável dicotômica',
    category: 'correlations',
    implemented: true,
    hidden: true,
    tooltip: 'Testa se um preditor contínuo está associado à chance de ocorrência de um desfecho binário. A hipótese nula afirma que o coeficiente do preditor é zero (odds ratio igual a 1).\n\nExemplo: o escore em uma escala de estresse prevê a presença de transtorno (sim/não)?\n\nTamanho de efeito: odds ratio (OR) esperado para o aumento de um desvio-padrão no preditor.\n• OR próximo de 1,5: efeito pequeno\n• OR em torno de 2,5: efeito médio\n• OR de 4 ou mais: efeito grande\n\nÉ preciso informar a probabilidade do evento (P) na média do preditor. Método de Demidenko (2007) com correção de variância — o procedimento padrão do G*Power 3.1. Referência: para OR = 1,5, P = 0,5, α = 0,05 bilateral e poder = 0,80, são necessários ~208 sujeitos.'
  },
  {
    id: 'multiple-logistic-regression',
    label: 'Regressão logística múltipla (OR esperado)',
    description: 'Predição de variável dicotômica com covariáveis',
    category: 'correlations',
    implemented: true,
    tooltip: 'Testa se um preditor contínuo está associado à chance de ocorrência de um desfecho binário, ajustando para outras covariáveis do modelo. A hipótese nula afirma que o coeficiente do preditor de interesse é zero (odds ratio igual a 1).\n\nExemplo: o escore de estresse prevê a presença de transtorno (sim/não), controlando idade e sexo?\n\nTamanho de efeito: odds ratio (OR) esperado para o aumento de um desvio-padrão no preditor de interesse.\n• OR próximo de 1,5: efeito pequeno\n• OR em torno de 2,5: efeito médio\n• OR de 4 ou mais: efeito grande\n\nAlém da probabilidade do evento (P), informe o R² do preditor de interesse explicado pelas demais covariáveis (correção de Hsieh). O n cresce por um fator 1/(1−R²). Método de Demidenko (2007) com correção de variância e correção multivariada de Hsieh (1998) — equivale ao procedimento do G*Power 3.1. Referência: para OR = 1,5, P = 0,5, R² = 0,1, α = 0,05 bilateral e poder = 0,95, são necessários ~375 sujeitos.'
  },
  {
    id: 'poisson-regression',
    label: 'Regressão de Poisson',
    description: 'Predição de contagens',
    category: 'correlations',
    implemented: true,
    tooltip: 'Testa se um preditor contínuo está associado à taxa de ocorrência de um desfecho de contagem. A hipótese nula afirma que o coeficiente do preditor é zero (razão de taxas igual a 1).\n\nExemplo: o nível de suporte social prevê o número de recaídas em um ano?\n\nTamanho de efeito: razão de taxas (RR) esperada para o aumento de um desvio-padrão no preditor.\n• RR próximo de 1,5: efeito pequeno\n• RR em torno de 2,0: efeito médio\n• RR de 3 ou mais: efeito grande\n\nÉ preciso informar a taxa basal de eventos (contagem média sob a hipótese nula). Método de Signorini (1991). Referência: para RR = 1,5, taxa basal = 0,85, α = 0,05 bilateral e poder = 0,80, são necessários ~57 sujeitos.'
  },

  // PROPORÇÕES / FREQUÊNCIAS
  { 
    id: 'proportion-one-sample', 
    label: 'Proporção única', 
    description: 'Teste se uma proporção difere de um valor esperado', 
    category: 'proportions', 
    implemented: true,
    tooltip: 'Testa se uma proporção observada difere de um valor de referência conhecido. A hipótese nula afirma que a proporção é igual ao valor de referência.\n\nExemplo: a taxa de aprovação em um exame (esperada em 65%) difere da meta de 50%?\n\nTamanho de efeito: h de Cohen, que mede a distância entre as duas proporções numa escala que mantém o cálculo estável em qualquer faixa de valores.\n• Pequeno: h = 0,20\n• Médio: h = 0,50\n• Grande: h = 0,80\n\nReferência: para uma diferença equivalente a h em torno de 0,30 (por exemplo, 65% contra 50%) com α = 0,05 bilateral e poder = 0,80, são necessários ~85 sujeitos.'
  },
  { 
    id: 'sign-test', 
    label: 'Teste do sinal', 
    description: 'Teste não-paramétrico para dados pareados', 
    category: 'proportions', 
    implemented: true,
    tooltip: 'Teste não-paramétrico mais simples para dados pareados: conta apenas a direção das diferenças (melhorou ou piorou), sem assumir magnitude. A hipótese nula afirma que melhoras e pioras são igualmente prováveis.\n\nExemplo: pacientes melhoram após o tratamento? Conta-se quantos melhoraram e quantos pioraram.\n\nTamanho de efeito: g, o quanto a proporção esperada de melhoras se afasta de 50%.\n• Pequeno: g = 0,05\n• Médio: g = 0,15\n• Grande: g = 0,25\n\nReferência: para g = 0,15 (proporção de 65%) com α = 0,05 bilateral e poder = 0,80, são necessários ~85 pares com diferença não-nula (empates são descartados).'
  },
  { 
    id: 'chi-square-2x2', 
    label: 'Qui-quadrado 2×2', 
    description: 'Teste de independência em tabela 2×2', 
    category: 'proportions', 
    implemented: true,
    tooltip: 'Testa se duas variáveis categóricas dicotômicas estão associadas em uma tabela 2×2. A hipótese nula afirma que as duas variáveis são independentes.\n\nExemplo: verificar se há relação entre gênero (M/F) e preferência por um produto (sim/não). O teste avalia se as frequências observadas diferem das esperadas sob independência.\n\nTamanho de efeito: w de Cohen, que mede o quanto as frequências observadas se afastam das esperadas. Em tabelas 2×2 com grupos balanceados, fica próximo do h de Cohen.\n• Pequeno: w = 0,10\n• Médio: w = 0,30\n• Grande: w = 0,50\n\nReferência: para w = 0,30 com α = 0,05 e poder = 0,80, são necessários ~88 sujeitos no total. Se alguma frequência esperada for menor que 5, prefira o Fisher exato.'
  },
  { 
    id: 'two-proportions', 
    label: 'Duas proporções independentes (z-test)', 
    description: 'Comparação de duas proporções', 
    category: 'proportions', 
    implemented: true,
    tooltip: 'Compara as proporções de dois grupos independentes (taxas de sucesso, conversão, mortalidade etc.). A hipótese nula afirma que as duas proporções são iguais.\n\nExemplo: comparar a taxa de conversão de duas campanhas de marketing aplicadas a públicos distintos.\n\nTamanho de efeito: h de Cohen, que mede a distância entre as duas proporções numa escala que torna o cálculo estável em qualquer faixa de valores, dependendo só dessa distância e não dos valores absolutos.\n• Pequeno: h = 0,20\n• Médio: h = 0,50\n• Grande: h = 0,80\n\nReferência: passar de 15% para 25% equivale a um h em torno de 0,25 e exige ~124 sujeitos por grupo (α = 0,05, poder = 0,80).'
  },
  { 
    id: 'fisher-exact', 
    label: 'Fisher exato (aproximação normal)', 
    description: 'Tabelas 2×2 — poder por aproximação normal', 
    category: 'proportions', 
    implemented: true,
    tooltip: 'Teste exato para tabelas 2×2, preferível quando as frequências esperadas são pequenas (menores que 5). A hipótese nula afirma que as duas variáveis são independentes.\n\nExemplo: associação entre um tratamento experimental e a cura em um estudo-piloto com poucos participantes.\n\nTamanho de efeito: w de Cohen, que mede o quanto as frequências observadas se afastam das esperadas.\n• Pequeno: w = 0,10\n• Médio: w = 0,30\n• Grande: w = 0,50\n\nMétodo: aproximação normal (teste z para 2×2, equivalente ao χ² com 1 gl) com o N inflado em 15% para refletir o conservadorismo do teste exato. Não é o cálculo exato por enumeração do G*Power. Referência: para w = 0,50 com α = 0,05 e poder = 0,80, são necessários ~37 no total; para w = 0,30, cerca de 101.'
  },
  { 
    id: 'mcnemar', 
    label: 'McNemar', 
    description: 'Proporções pareadas em 2 condições', 
    category: 'proportions', 
    implemented: true,
    tooltip: 'Compara proporções pareadas medidas em duas condições ou momentos nos mesmos sujeitos, analisando apenas os casos que mudaram (pares discordantes). A hipótese nula afirma que a proporção não muda entre as duas condições.\n\nExemplo: a opinião dos eleitores (a favor ou contra) mudou após um debate (mesmos respondentes antes e depois)?\n\nTamanho de efeito: g, o quanto a proporção de mudanças em uma direção, entre os casos que mudaram, se afasta de 50%.\n• Pequeno: g = 0,05\n• Médio: g = 0,15\n• Grande: g = 0,25\n\nO cálculo assume que metade dos pares muda de condição; o resultado é o total de pares. Referência: para g = 0,15 com α = 0,05 bilateral e poder = 0,80, são necessários ~170 pares; para g = 0,25, cerca de 58.'
  },
  {
    id: 'cochran-q',
    label: 'Q de Cochran',
    description: 'Proporções pareadas em 3+ condições',
    category: 'proportions',
    implemented: true,
    tooltip: 'Compara a proporção de "sucessos" (sim/não, presença/ausência) dos mesmos sujeitos em três ou mais condições relacionadas. É a extensão do McNemar para 3 ou mais momentos. A hipótese nula afirma que a proporção de sucessos é a mesma em todas as condições.\n\nExemplo: verificar se a taxa de acerto dos mesmos alunos muda entre três versões do mesmo item de prova.\n\nTamanho de efeito: w de Cohen, calculado a partir das proporções esperadas nas várias condições, que mede o quanto elas se diferenciam.\n• Pequeno: w = 0,10\n• Médio: w = 0,30\n• Grande: w = 0,50\n\nReferência: para 3 condições, w = 0,30 (médio), α = 0,05 e poder = 0,80, são necessários ~108 sujeitos.'
  },
  {
    id: 'chi-square-independence',
    label: 'Qui-quadrado de independência',
    description: 'Teste para tabelas maiores que 2×2',
    category: 'proportions',
    implemented: true,
    tooltip: 'Testa se duas variáveis categóricas estão associadas em uma tabela de contingência com mais de duas linhas ou colunas. A hipótese nula afirma que as duas variáveis são independentes.\n\nExemplo: verificar se a faixa etária (3 categorias) se associa à preferência de produto (4 categorias), formando uma tabela 3×4.\n\nTamanho de efeito: w de Cohen, que mede o quanto as frequências observadas se afastam das esperadas; em tabelas maiores, leva em conta também o número de linhas e colunas.\n• Pequeno: w = 0,10\n• Médio: w = 0,30\n• Grande: w = 0,50\n\nReferência: em uma tabela 3×3, w = 0,30, α = 0,05 e poder = 0,80, são necessários ~133 sujeitos.\n\nPara tabelas 2×2 use o teste dedicado.'
  },
  {
    id: 'goodness-of-fit',
    label: 'Goodness-of-fit',
    description: 'Teste de aderência a distribuição esperada',
    category: 'proportions',
    implemented: true,
    tooltip: 'Testa se as proporções observadas em várias categorias mutuamente exclusivas diferem de uma distribuição teórica esperada. A hipótese nula afirma que as proporções observadas seguem a distribuição esperada.\n\nExemplo: verificar se a distribuição de tipo sanguíneo em uma amostra (A, B, AB, O) bate com as frequências populacionais esperadas.\n\nTamanho de efeito: w de Cohen, que mede o quanto as proporções observadas se afastam das esperadas.\n• Pequeno: w = 0,10\n• Médio: w = 0,30\n• Grande: w = 0,50\n\nReferência: para 4 categorias, w = 0,30, α = 0,05 e poder = 0,80, são necessários ~122 sujeitos.'
  },

  // CONFIABILIDADE E CONCORDÂNCIA
  { id: 'icc', label: 'ICC', description: 'Coeficiente de correlação intraclasse', category: 'reliability', implemented: false },
  { id: 'kappa', label: 'Kappa', description: 'Concordância entre avaliadores categóricos', category: 'reliability', implemented: false },
  { id: 'percent-agreement', label: 'Concordância percentual', description: 'Percentual de concordância simples', category: 'reliability', implemented: false },
];

// Helper function to get tooltip for a test ID (must be after TEST_DEFINITIONS)
const getTestTooltip = (testId: string): string | undefined => {
  const testDef = TEST_DEFINITIONS.find(t => t.id === testId);
  return testDef?.tooltip;
};

// Component to render info button with tooltip popover for test definitions
const TestInfoButton = ({ testId }: { testId: string }) => {
  const tooltip = getTestTooltip(testId);
  if (!tooltip) return null;
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          type="button"
          className="p-1 hover:bg-accent rounded flex-shrink-0 ml-auto"
          onClick={(e) => e.stopPropagation()}
          data-testid={`button-info-${testId}`}
        >
          <Info className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="left" 
        align="center" 
        sideOffset={12}
        collisionPadding={16}
        className="max-w-sm text-xs whitespace-pre-line p-3 w-80 z-[100]"
      >
        <p className="text-foreground">{tooltip}</p>
      </PopoverContent>
    </Popover>
  );
};

const CATEGORY_INFO: Record<Macrocategory, { label: string; icon: string }> = {
  means: { label: 'Diferenças de Médias', icon: '' },
  correlations: { label: 'Correlações e Regressões', icon: '' },
  proportions: { label: 'Proporções / Frequências', icon: '' },
  reliability: { label: 'Confiabilidade e Concordância', icon: '' },
};

// Effect size families - defines the notation and conventions for each test
// Based on GPower conventions: d (Cohen's d), f (Cohen's f), w (Cohen's w), ρ (correlation)
interface EffectSizeFamily {
  symbol: string;           // The symbol used (d, f, w, ρ, η², etc.)
  label: string;            // Full label for the input field
  small: number;            // Convention for small effect
  medium: number;           // Convention for medium effect
  large: number;            // Convention for large effect
  tooltipName: string;      // Name to show in tooltip (e.g., "Cohen's d")
}

// Effect size family definitions
const EFFECT_SIZE_FAMILIES: Record<string, EffectSizeFamily> = {
  // Cohen's d - for t-tests and their nonparametric equivalents
  cohens_d: {
    symbol: 'd',
    label: 'Tamanho de efeito d',
    small: 0.2,
    medium: 0.5,
    large: 0.8,
    tooltipName: "Cohen's d"
  },
  // Cohen's f - for ANOVAs and F tests
  cohens_f: {
    symbol: 'f',
    label: 'Tamanho de efeito f',
    small: 0.10,
    medium: 0.25,
    large: 0.40,
    tooltipName: "Cohen's f"
  },
  // Cohen's w - for chi-square tests
  cohens_w: {
    symbol: 'w',
    label: 'Tamanho de efeito w',
    small: 0.10,
    medium: 0.30,
    large: 0.50,
    tooltipName: "Cohen's w"
  },
  // Correlation coefficient (r or ρ)
  correlation: {
    symbol: '|ρ|',
    label: 'Tamanho de efeito |ρ|',
    small: 0.10,
    medium: 0.30,
    large: 0.50,
    tooltipName: "Correlação |ρ|"
  },
  // Eta-squared for MANOVA
  eta_squared: {
    symbol: 'η²',
    label: 'Tamanho de efeito η²',
    small: 0.01,
    medium: 0.06,
    large: 0.14,
    tooltipName: "Eta-squared (η²)"
  },
  // Cohen's h for proportions
  cohens_h: {
    symbol: 'h',
    label: 'Tamanho de efeito h',
    small: 0.20,
    medium: 0.50,
    large: 0.80,
    tooltipName: "Cohen's h"
  },
  // Sign test effect size g (deviation from 0.5)
  sign_g: {
    symbol: 'g',
    label: 'Tamanho de efeito g',
    small: 0.05,
    medium: 0.15,
    large: 0.25,
    tooltipName: "g (desvio de 0.5)"
  },
  // Odds Ratio for logistic regression
  odds_ratio: {
    symbol: 'OR',
    label: 'Odds Ratio',
    small: 1.5,
    medium: 2.5,
    large: 4.0,
    tooltipName: "Odds Ratio"
  },
  // f² for regression
  f_squared: {
    symbol: 'f²',
    label: 'Tamanho de efeito f²',
    small: 0.02,
    medium: 0.15,
    large: 0.35,
    tooltipName: "Cohen's f²"
  },
  // f²(V) for MANOVA (Pillai-Bartlett trace), entered directly (G*Power convention)
  pillai_f2: {
    symbol: 'f²(V)',
    label: 'Tamanho de efeito f²(V)',
    small: 0.02,
    medium: 0.15,
    large: 0.35,
    tooltipName: "f²(V) de Pillai"
  },
  // ICC
  icc: {
    symbol: 'ICC',
    label: 'ICC esperado',
    small: 0.40,
    medium: 0.60,
    large: 0.75,
    tooltipName: "ICC"
  },
  // Kappa
  kappa: {
    symbol: 'κ',
    label: 'Kappa esperado',
    small: 0.40,
    medium: 0.60,
    large: 0.80,
    tooltipName: "Kappa (κ)"
  },
  // Variance ratio for F-test
  variance_ratio: {
    symbol: 'σ²₁/σ²₂',
    label: 'Razão de variâncias',
    small: 1.5,
    medium: 2.0,
    large: 3.0,
    tooltipName: "Razão de variâncias"
  },
  // Rate ratio for Poisson regression
  rate_ratio: {
    symbol: 'RR',
    label: 'Razão de taxas (RR)',
    small: 1.5,
    medium: 2.0,
    large: 3.0,
    tooltipName: "Razão de taxas"
  }
};

// Map each test to its effect size family
const TEST_EFFECT_SIZE_FAMILY: Record<string, string> = {
  // t-tests and nonparametric equivalents use Cohen's d
  'one-sample-t': 'cohens_d',
  'wilcoxon-one-sample': 'cohens_d',
  'independent-t': 'cohens_d',
  'mann-whitney': 'cohens_d',
  'paired-t': 'cohens_d',
  'wilcoxon-paired': 'cohens_d',
  
  // ANOVAs and multi-group tests use Cohen's f
  'anova-oneway': 'cohens_f',
  'kruskal-wallis': 'cohens_f',
  'anova-factorial': 'cohens_f',
  'anova-repeated': 'cohens_f',
  'anova-mixed': 'cohens_f',
  'friedman': 'cohens_f',
  
  // MANOVAs use the multivariate Pillai effect size f²(V)
  'manova': 'pillai_f2',
  'manova-factorial': 'pillai_f2',
  'manova-repeated': 'pillai_f2',
  
  // Correlations use correlation coefficient
  'pearson-correlation': 'correlation',
  'spearman-correlation': 'correlation',
  'kendall-correlation': 'correlation',
  'compare-correlations-independent': 'correlation',
  'compare-correlations-dependent': 'correlation',
  
  // Regression uses f²
  'regression-simple': 'f_squared',
  'regression-multiple-total': 'f_squared',
  'regression-multiple-increment': 'f_squared',
  
  // Logistic regression uses Odds Ratio, Poisson uses Rate Ratio
  'logistic-regression': 'odds_ratio',
  'multiple-logistic-regression': 'odds_ratio',
  'poisson-regression': 'rate_ratio',
  
  // Proportions and chi-square use Cohen's w or h
  'proportion-one-sample': 'cohens_h',
  'sign-test': 'sign_g',
  'chi-square-2x2': 'cohens_w',
  'two-proportions': 'cohens_h',
  'fisher-exact': 'cohens_w',
  'mcnemar': 'sign_g',
  'cochran-q': 'cohens_w',
  'chi-square-independence': 'cohens_w',
  'goodness-of-fit': 'cohens_w',
  
  // Variance tests
  'variance-one-sample': 'variance_ratio',
  'f-test-variance': 'variance_ratio',
  'levene-test': 'variance_ratio',
  
  // Reliability
  'icc': 'icc',
  'kappa': 'kappa',
  'percent-agreement': 'kappa'
};

// Citation metadata for each test - used to generate APA references
interface TestCitationMetadata {
  analysisName: string;           // Name of the analysis in Portuguese
  guidelinesAuthors: string;      // Authors of the power calculation guidelines
  formulaAuthors: string;         // Authors of the formula/method implemented in backend
}

const TEST_CITATION_METADATA: Record<string, TestCitationMetadata> = {
  // T-tests and equivalents
  'one-sample-t': {
    analysisName: 'teste t de uma amostra',
    guidelinesAuthors: 'Cohen (1988)',
    formulaAuthors: 'Cohen (1988)'
  },
  'wilcoxon-one-sample': {
    analysisName: 'teste de Wilcoxon de uma amostra',
    guidelinesAuthors: 'Cohen (1988) e Lehmann (1975)',
    formulaAuthors: 'método A.R.E. do G*Power (Faul et al., 2007), com distribuição de origem normal (A.R.E. = 3/π ≈ 0,955)'
  },
  'independent-t': {
    analysisName: 'teste t para amostras independentes',
    guidelinesAuthors: 'Cohen (1988)',
    formulaAuthors: 'Cohen (1988)'
  },
  'mann-whitney': {
    analysisName: 'teste U de Mann-Whitney',
    guidelinesAuthors: 'Cohen (1988) e Lehmann (1975)',
    formulaAuthors: 'método A.R.E. do G*Power (Faul et al., 2007), com distribuição de origem normal (A.R.E. = 3/π ≈ 0,955)'
  },
  'paired-t': {
    analysisName: 'teste t pareado',
    guidelinesAuthors: 'Cohen (1988)',
    formulaAuthors: 'Cohen (1988)'
  },
  'wilcoxon-paired': {
    analysisName: 'teste de Wilcoxon pareado',
    guidelinesAuthors: 'Cohen (1988) e Lehmann (1975)',
    formulaAuthors: 'método A.R.E. do G*Power (Faul et al., 2007), com distribuição de origem normal (A.R.E. = 3/π ≈ 0,955)'
  },
  // Multi-group tests
  'anova-oneway': {
    analysisName: 'ANOVA one-way',
    guidelinesAuthors: 'Cohen (1988)',
    formulaAuthors: 'Cohen (1988)'
  },
  'kruskal-wallis': {
    analysisName: 'teste de Kruskal-Wallis',
    guidelinesAuthors: 'Cohen (1988) e Lehmann (1975)',
    formulaAuthors: 'aproximação via distribuição F não central com o método A.R.E. (Lehmann, 1975), distribuição de origem normal (A.R.E. = 3/π ≈ 0,955)'
  },
  'friedman': {
    analysisName: 'teste de Friedman',
    guidelinesAuthors: 'Cohen (1988) e Lehmann (1975)',
    formulaAuthors: 'aproximação via distribuição F não central com o método A.R.E. (Lehmann, 1975), distribuição de origem normal (A.R.E. = 3/π ≈ 0,955)'
  },
  // MANOVA (Pillai trace)
  'manova': {
    analysisName: 'MANOVA one-way',
    guidelinesAuthors: 'Cohen (1988)',
    formulaAuthors: 'aproximação F da estatística traço de Pillai (Muller & Peterson, 1984)'
  },
  'manova-factorial': {
    analysisName: 'MANOVA fatorial',
    guidelinesAuthors: 'Cohen (1988)',
    formulaAuthors: 'aproximação F da estatística traço de Pillai (Muller & Peterson, 1984)'
  },
  'manova-repeated': {
    analysisName: 'MANOVA de medidas repetidas',
    guidelinesAuthors: 'Cohen (1988)',
    formulaAuthors: 'aproximação F da estatística traço de Pillai (Muller & Peterson, 1984)'
  },
  // Correlations
  'pearson-correlation': {
    analysisName: 'correlação de Pearson',
    guidelinesAuthors: 'Cohen (1988)',
    formulaAuthors: 'transformação z de Fisher (Fisher, 1921)'
  },
  'spearman-correlation': {
    analysisName: 'correlação de Spearman',
    guidelinesAuthors: 'Cohen (1988) e Fieller et al. (1957)',
    formulaAuthors: 'transformação z de Fisher adaptada (Fieller et al., 1957), com ajuste ARE'
  },
  'kendall-correlation': {
    analysisName: 'correlação de Kendall (τ)',
    guidelinesAuthors: 'Cohen (1988) e Kendall (1938)',
    formulaAuthors: 'aproximação assintótica normal para Tau de Kendall (Kendall, 1938)'
  },
  'compare-correlations-independent': {
    analysisName: 'comparação de duas correlações independentes',
    guidelinesAuthors: 'Cohen (1988)',
    formulaAuthors: 'teste z de Fisher para diferença entre correlações (Fisher, 1921)'
  },
  'fisher-exact': {
    analysisName: 'teste exato de Fisher (tabela 2×2)',
    guidelinesAuthors: 'Cohen (1988)',
    formulaAuthors: 'aproximação normal (teste z para tabela 2×2, equivalente ao qui-quadrado com 1 gl), com N inflado em 15% para aproximar o conservadorismo do teste exato'
  },
  // Default fallback
  'default': {
    analysisName: 'análise estatística',
    guidelinesAuthors: 'Cohen (1988)',
    formulaAuthors: 'Cohen (1988)'
  }
};

// Get citation metadata for a test
function getTestCitationMetadata(testId: string): TestCitationMetadata {
  return TEST_CITATION_METADATA[testId] || TEST_CITATION_METADATA['default'];
}

// APA formatted references for citations
const APA_REFERENCES: Record<string, string> = {
  'cohen': 'Cohen, J. (1988). <em>Statistical power analysis for the behavioral sciences</em> (2nd ed.). Lawrence Erlbaum Associates.',
  'lehmann': 'Lehmann, E. L. (1975). <em>Nonparametrics: Statistical methods based on ranks</em>. Holden-Day.',
  'fisher': 'Fisher, R. A. (1921). On the "probable error" of a coefficient of correlation deduced from a small sample. <em>Metron, 1</em>, 3–32.',
  'fieller': 'Fieller, E. C., Hartley, H. O., & Pearson, E. S. (1957). Tests for rank correlation coefficients. I. <em>Biometrika, 44</em>(3/4), 470–481.',
  'kendall': 'Kendall, M. G. (1938). A new measure of rank correlation. <em>Biometrika, 30</em>(1/2), 81–93.',
  'gpower': 'Faul, F., Erdfelder, E., Lang, A.-G., & Buchner, A. (2007). G*Power 3: A flexible statistical power analysis program for the social, behavioral, and biomedical sciences. <em>Behavior Research Methods, 39</em>(2), 175–191.'
};

// Get references needed for a specific test
function getTestReferences(testId: string): string[] {
  const refs: string[] = ['cohen']; // Cohen is always cited
  
  // Add Lehmann for nonparametric tests
  if (['wilcoxon-one-sample', 'mann-whitney', 'wilcoxon-paired', 'kruskal-wallis', 'friedman'].includes(testId)) {
    refs.push('lehmann');
  }
  if (['wilcoxon-one-sample', 'mann-whitney', 'wilcoxon-paired'].includes(testId)) {
    refs.push('gpower');
  }
  
  // Add Fisher for correlation tests
  if (['pearson-correlation', 'compare-correlations-independent'].includes(testId)) {
    refs.push('fisher');
  }
  
  // Add Fieller for Spearman
  if (testId === 'spearman-correlation') {
    refs.push('fisher');
    refs.push('fieller');
  }
  
  // Add Kendall for Kendall correlation
  if (testId === 'kendall-correlation') {
    refs.push('kendall');
  }
  
  return refs;
}

export default function PowerAnalysis() {
  // State - Category and test selection
  const [macrocategory, setMacrocategory] = useState<Macrocategory>('means');
  const [selectedTest, setSelectedTest] = useState<string>('one-sample-t');
  const [calculationMode, setCalculationMode] = useState<CalculationMode>('calculate-n');
  
  // State - Parameters
  const [alpha, setAlpha] = useState('0.05');
  const [effectSize, setEffectSize] = useState('');
  const [power, setPower] = useState('0.80');
  const [n, setN] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [tails, setTails] = useState<Tails>('two');
  const [r1, setR1] = useState(''); // For correlation comparison tests
  const [r2, setR2] = useState(''); // For correlation comparison tests
  const [r3, setR3] = useState(''); // For dependent correlation comparison (r_yz)
  const [k, setK] = useState('3'); // Number of groups for multi-group tests (Kruskal-Wallis, Friedman, ANOVA)
  const [numLevelsA, setNumLevelsA] = useState('2'); // Number of levels for factor A (factorial ANOVA)
  const [numLevelsB, setNumLevelsB] = useState('2'); // Number of levels for factor B (factorial ANOVA)
  const [effectType, setEffectType] = useState<'main_a' | 'main_b' | 'interaction' | 'within' | 'between' | 'within_between'>('interaction'); // Effect type for factorial/mixed ANOVA
  const [numMeasurements, setNumMeasurements] = useState('3'); // Number of repeated measurements (within-subjects levels)
  const [numGroups, setNumGroups] = useState('2'); // Number of between-subjects groups (for mixed designs / factorial ANOVA)
  const [numeratorDf, setNumeratorDf] = useState('1'); // Numerator df of the tested effect (factorial ANOVA, G*Power "special")
  const [numRows, setNumRows] = useState('3'); // Rows for chi-square independence (r × c)
  const [numCols, setNumCols] = useState('3'); // Columns for chi-square independence (r × c)
  const [correlationBetweenMeasures, setCorrelationBetweenMeasures] = useState('0.5'); // Correlation between repeated measures
  const [sphericityCorrection, setSphericityCorrection] = useState('1'); // Epsilon for sphericity correction (1 = sphericity assumed)
  const [numPredictors, setNumPredictors] = useState('3'); // Number of predictors (multiple regression; total predictors for increment)
  const [numResponseVars, setNumResponseVars] = useState('2'); // Number of response (dependent) variables (MANOVA, p)
  const [numTestedPredictors, setNumTestedPredictors] = useState('1'); // Predictors tested (increment model)
  const [baseProportion, setBaseProportion] = useState('0.5'); // Baseline event probability P (logistic regression)
  const [r2OtherPredictors, setR2OtherPredictors] = useState('0'); // R² of other predictors (multiple logistic regression)
  // Predictor (X) distribution for logistic regression (Demidenko 2007 / G*Power). Defaults match G*Power.
  const [xDistribution, setXDistribution] = useState('normal');
  const [xDistMu, setXDistMu] = useState('0'); // Normal & Lognormal: mean
  const [xDistSigma, setXDistSigma] = useState('1'); // Normal & Lognormal: SD
  const [xDistPi, setXDistPi] = useState('0.5'); // Binomial (Bernoulli): success probability
  const [xDistLambda, setXDistLambda] = useState('1'); // Exponential & Poisson: mean
  const [xDistOpen, setXDistOpen] = useState(false); // Collapsible distribution section (closed by default)
  const [baseRate, setBaseRate] = useState('1'); // Baseline mean event rate (Poisson regression)
  
  // State - Results
  const [result, setResult] = useState<PowerAnalysisResult | null>(null);
  const [showCurve, setShowCurve] = useState(false);
  const [curveData, setCurveData] = useState<Array<{ n?: number; effectSize?: number; power: number }>>([]);
  // Which quantity varies along the X axis of the current curve:
  // 'n' for a priori / post-hoc (power vs sample size),
  // 'effectSize' for sensitivity (power vs effect size at fixed N).
  const [curveXKey, setCurveXKey] = useState<'n' | 'effectSize'>('n');
  // Exact request (payload + mode) that produced the current result; the curve
  // is generated from it so the plot always matches the reported numbers.
  const [calcRequest, setCalcRequest] = useState<{ payload: any; mode: 'calculate-n' | 'have-n-power' | 'have-n-effect' } | null>(null);
  const [curveMeta, setCurveMeta] = useState<{ refX: number; refPower: number; targetPower?: number; groupRule?: string; mode: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  // State - Citation
  const [effectSizeReference, setEffectSizeReference] = useState('');
  const [showCitation, setShowCitation] = useState(true);
  
  // State - Test selector popover
  const [testSelectorOpen, setTestSelectorOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get tests for current category
  const availableTests = TEST_DEFINITIONS.filter(t => t.category === macrocategory && !t.hidden);
  const currentTestDef = TEST_DEFINITIONS.find(t => t.id === selectedTest);

  // Get the effect size family for the current test
  // Label of the reported critical value, by the statistic each engine returns.
  const criticalValueLabelFor = (tt?: string): string => {
    const z = ['logistic-regression', 'multiple-logistic-regression', 'poisson-regression', 'proportion-one-sample', 'two-proportions', 'sign-test', 'compare-correlations-independent', 'fisher-exact'];
    const chi = ['chi-square-2x2', 'mcnemar', 'cochran-q', 'chi-square-independence', 'goodness-of-fit'];
    const F = ['kruskal-wallis', 'friedman', 'regression-multiple-total', 'regression-multiple-increment'];
    if (!tt) return 'Valor crítico';
    if (z.includes(tt)) return 'Valor crítico z';
    if (chi.includes(tt)) return 'Valor crítico χ²';
    if (tt === 'kendall-correlation') return 'Valor crítico τ';
    if (tt === 'pearson-correlation' || tt === 'spearman-correlation') return 'Valor crítico r';
    if (F.includes(tt) || tt.includes('anova')) return 'Valor crítico F';
    return 'Valor crítico t';
  };
  // Degrees of freedom: integers as-is, fractional (A.R.E. method) with 4 decimals as in G*Power.
  const formatDf = (v: number | undefined): string =>
    v === undefined || v === null ? '' : Number.isInteger(v) ? String(v) : v.toFixed(4);
  const ncpLabelFor = (tt?: string): string =>
    ['kruskal-wallis', 'friedman'].includes(tt ?? '') ? 'Parâmetro de não centralidade (λ)' : 'Parâmetro de não centralidade (δ)';
  const NONPARAM_TESTS = ['wilcoxon-one-sample', 'mann-whitney', 'wilcoxon-paired', 'kruskal-wallis', 'friedman'];

  const getEffectSizeFamily = (): EffectSizeFamily => {
    const familyKey = TEST_EFFECT_SIZE_FAMILY[selectedTest] || 'cohens_d';
    return EFFECT_SIZE_FAMILIES[familyKey] || EFFECT_SIZE_FAMILIES.cohens_d;
  };

  // Helper function to get contextually correct effect size tooltip
  const getEffectSizeTooltip = (): string => {
    const family = getEffectSizeFamily();
    return `Magnitude do efeito: pequeno=${family.small}, médio=${family.medium}, grande=${family.large} (${family.tooltipName})`;
  };

  // Helper function to get the effect size label for the input field
  const getEffectSizeLabel = (): string => {
    const family = getEffectSizeFamily();
    return family.label;
  };

  // Helper function to generate citation text based on calculation mode
  const generateCitationText = (): string => {
    if (!result) return '';
    
    const metadata = getTestCitationMetadata(selectedTest);
    const family = getEffectSizeFamily();
    const effectSizeValue = result.effectSize;
    const alphaValue = parseFloat(normalizeDecimalInput(alpha));
    const isChiSquareFamily = ['chi-square-2x2', 'chi-square-independence', 'goodness-of-fit', 'mcnemar', 'cochran-q', 'fisher-exact'].includes(selectedTest);
    const tailsClause = isChiSquareFamily ? '' : (tails === 'two' ? ' bilateral' : ' unilateral');
    
    // Add reference if provided
    const referenceText = effectSizeReference.trim() 
      ? effectSizeReference.trim() 
      : '[inserir referência]';
    
    // A PRIORI: Calculate required N (check for requiredN OR requiredN1/N2 for two-group tests)
    const hasAPrioriResult = result.requiredN !== undefined || (result.requiredN1 !== undefined && result.requiredN2 !== undefined);
    if (calculationMode === 'calculate-n' && hasAPrioriResult) {
      const powerValue = parseFloat(normalizeDecimalInput(power));
      let effectSizeDescription = `${family.tooltipName} = ${effectSizeValue}`;
      
      // Determine sample size text based on test type
      let sampleSizeText = '';
      if (result.requiredN1 !== undefined && result.requiredN2 !== undefined) {
        sampleSizeText = `${result.requiredN1} participantes no grupo 1 e ${result.requiredN2} no grupo 2 (total = ${result.requiredN1 + result.requiredN2})`;
      } else if (selectedTest === 'anova-oneway' && result.k) {
        const totalN = result.requiredN! * result.k;
        sampleSizeText = `${totalN} participantes (${result.requiredN} por grupo, ${result.k} grupos)`;
      } else if (selectedTest === 'anova-factorial' && result.numGroups) {
        sampleSizeText = `${result.requiredN} participantes no total (${result.numGroups} grupos)`;
      } else if (selectedTest === 'anova-mixed' && result.nPerGroup && result.numGroups) {
        sampleSizeText = `${result.requiredN} participantes (${result.nPerGroup} por grupo, ${result.numGroups} grupos)`;
      } else if (selectedTest === 'kruskal-wallis' && k) {
        const kValue = result.k ?? parseInt(k);
        const totalN = result.totalN ?? result.requiredN! * kValue;
        sampleSizeText = `${totalN} participantes (${result.requiredN} por grupo, ${kValue} grupos)`;
      } else if (selectedTest === 'friedman' && k) {
        const kValue = result.k ?? parseInt(k);
        sampleSizeText = `${result.requiredN} participantes, cada um avaliado nas ${kValue} condições`;
      } else {
        sampleSizeText = `${result.requiredN} participantes`;
      }
      
      return `Um cálculo de poder a priori foi realizado para determinar o tamanho amostral requerido para a análise de ${metadata.analysisName}. A estimativa assumiu um tamanho de efeito ${effectSizeDescription}, conforme reportado por ${referenceText}, poder estatístico de 1 – β = ${powerValue.toFixed(2)}, e nível de significância${tailsClause} de α = ${alphaValue}. O cálculo indicou que seriam necessários pelo menos ${sampleSizeText} para detectar o efeito especificado com o poder desejado. O procedimento foi conduzido utilizando as diretrizes de cálculo descritas por ${metadata.guidelinesAuthors} e operacionalizado segundo o método implementado por ${metadata.formulaAuthors}.`;
    }
    
    // POST-HOC: Calculate power given N
    if (calculationMode === 'have-n-power' && result.power !== undefined) {
      const nValue = parseInt(n) || 0;
      let effectSizeDescription = `${family.tooltipName} = ${effectSizeValue}`;
      const powerPercent = (result.power * 100).toFixed(1);
      
      // Determine sample size text based on test type
      let sampleSizeText = '';
      if (n1 && n2) {
        sampleSizeText = `${n1} participantes no grupo 1 e ${n2} no grupo 2`;
      } else if (selectedTest === 'anova-oneway' && result.k) {
        const totalN = nValue * result.k;
        sampleSizeText = `${totalN} participantes (${nValue} por grupo, ${result.k} grupos)`;
      } else if (selectedTest === 'anova-factorial' && result.numGroups) {
        sampleSizeText = `${nValue} participantes no total (${result.numGroups} grupos)`;
      } else if ((selectedTest === 'kruskal-wallis' || selectedTest === 'friedman') && k) {
        const kValue = parseInt(k);
        const totalN = nValue * kValue;
        sampleSizeText = `${totalN} participantes (${nValue} por grupo, ${kValue} grupos)`;
      } else {
        sampleSizeText = `${nValue} participantes`;
      }
      
      return `Um cálculo de poder post-hoc foi realizado para determinar a probabilidade de detectar um efeito na análise de ${metadata.analysisName}. A análise utilizou uma amostra de ${sampleSizeText}, um tamanho de efeito de ${effectSizeDescription}, conforme reportado por ${referenceText}, e nível de significância${tailsClause} de α = ${alphaValue}. O cálculo indicou um poder estatístico de 1 – β = ${(result.power).toFixed(4)} (${powerPercent}%), representando a probabilidade de detectar o efeito especificado caso ele exista na população. O procedimento foi conduzido utilizando as diretrizes de cálculo descritas por ${metadata.guidelinesAuthors} e operacionalizado segundo o método implementado por ${metadata.formulaAuthors}.`;
    }
    
    // SENSITIVITY: Calculate minimum detectable effect size
    if (calculationMode === 'have-n-effect' && result.minDetectableEffect !== undefined) {
      const nValue = parseInt(n) || 0;
      const powerValue = parseFloat(normalizeDecimalInput(power));
      const minEffect = result.minDetectableEffect.toFixed(4);
      
      // Determine sample size text based on test type
      let sampleSizeText = '';
      if (n1 && n2) {
        sampleSizeText = `${n1} participantes no grupo 1 e ${n2} no grupo 2`;
      } else if (selectedTest === 'anova-oneway' && result.k) {
        const totalN = nValue * result.k;
        sampleSizeText = `${totalN} participantes (${nValue} por grupo, ${result.k} grupos)`;
      } else if (selectedTest === 'anova-factorial' && result.numGroups) {
        sampleSizeText = `${nValue} participantes no total (${result.numGroups} grupos)`;
      } else if ((selectedTest === 'kruskal-wallis' || selectedTest === 'friedman') && k) {
        const kValue = parseInt(k);
        const totalN = nValue * kValue;
        sampleSizeText = `${totalN} participantes (${nValue} por grupo, ${kValue} grupos)`;
      } else {
        sampleSizeText = `${nValue} participantes`;
      }
      
      return `Uma análise de sensibilidade foi realizada para determinar o menor tamanho de efeito detectável na análise de ${metadata.analysisName}. A análise considerou uma amostra de ${sampleSizeText}, poder estatístico de 1 – β = ${powerValue.toFixed(2)}, e nível de significância${tailsClause} de α = ${alphaValue}. O cálculo indicou que o menor tamanho de efeito detectável seria ${family.tooltipName} = ${minEffect}. Isso significa que efeitos menores que este valor teriam baixa probabilidade de serem detectados com os parâmetros especificados. O procedimento foi conduzido utilizando as diretrizes de cálculo descritas por ${metadata.guidelinesAuthors} e operacionalizado segundo o método implementado por ${metadata.formulaAuthors}.`;
    }
    
    return '';
  };

  // Get current year for app citation
  const getCurrentYear = (): number => new Date().getFullYear();

  // Reset form when changing test
  const resetForm = () => {
    setEffectSize('');
    setN('');
    setN1('');
    setN2('');
    setR1('');
    setR2('');
    setR3('');
    setPower('0.80');
    setResult(null);
    setShowCurve(false);
    setCalcRequest(null);
    setCurveMeta(null);
    setCurveData([]);
  };

  // Normalize decimal input: accept comma or period, handle ".8" as "0.8"
  const normalizeDecimalInput = (value: string): string => {
    if (!value) return value;
    
    // Replace comma with period
    let normalized = value.replace(',', '.');
    
    // Add leading zero if starts with period (.8 → 0.8)
    if (normalized.startsWith('.')) {
      normalized = '0' + normalized;
    }
    
    return normalized;
  };

  // Change category handler
  const handleCategoryChange = (category: Macrocategory) => {
    setMacrocategory(category);
    const firstTest = TEST_DEFINITIONS.find(t => t.category === category);
    if (firstTest) {
      setSelectedTest(firstTest.id);
      resetForm();
    }
  };

  // Change test handler
  const handleTestChange = (testId: string) => {
    setSelectedTest(testId);
    resetForm();
    // Set appropriate default effectType for the selected test
    if (testId === 'anova-factorial') {
      setEffectType('interaction');
      setNumGroups('4');
      setNumeratorDf('1');
    } else if (testId === 'anova-mixed') {
      setEffectType('within_between');
    }
    // Site de leads: o padrão compartilhado (k=3, preditores=3) é inválido na
    // MANOVA fatorial (q ≤ k − 1); ajusta q para o maior valor válido.
    if (testId === 'manova-factorial') {
      const kNum = parseInt(k);
      const qNum = parseInt(numPredictors);
      if (Number.isFinite(kNum) && Number.isFinite(qNum) && qNum > kNum - 1) {
        setNumPredictors(String(Math.max(1, kNum - 1)));
      }
    }
    // Cochran Q requires k ≥ 3 (at least 3 paired measures/conditions)
    if (testId === 'cochran-q') {
      const current = parseInt(numLevelsA);
      if (!Number.isFinite(current) || current < 3) {
        setNumLevelsA('3');
      }
    }
  };

  // Clamp k input for Cochran Q on blur (minimum 3)
  const handleChiKBlur = () => {
    if (selectedTest !== 'cochran-q') return;
    const parsed = parseInt(numLevelsA);
    if (!Number.isFinite(parsed) || parsed < 3) {
      setNumLevelsA('3');
    }
  };

  // Generate the power curve from the SAME request that produced the result.
  // The curve is regenerated only when a new result arrives (or a saved one is
  // restored), so it always matches the numbers shown in the panel — editing a
  // field afterwards does not change the plot until the user recalculates.
  useEffect(() => {
    if (!result || !calcRequest || !currentTestDef?.implemented) {
      return;
    }
    generateCurve(calcRequest, result);
  }, [result, calcRequest]);

  const generateCurve = async (
    request: { payload: any; mode: 'calculate-n' | 'have-n-power' | 'have-n-effect' },
    res: PowerAnalysisResult,
  ) => {
    try {
      const { testType, ...input } = request.payload;
      const response = await apiRequest('POST', '/api/power-analysis/curve-consistent', {
        testType,
        mode: request.mode,
        input,
        result: res,
      });
      const data = await response.json();
      setCurveXKey(data.xKey);
      setCurveData(data.points);
      setCurveMeta({
        refX: data.refX,
        refPower: data.refPower,
        targetPower: data.targetPower,
        groupRule: data.groupRule,
        mode: request.mode,
      });
      setShowCurve(true);
    } catch (error) {
      console.error('Failed to generate curve:', error);
      setCurveData([]);
      setCurveMeta(null);
    }
  };

  // Fetch calculation history
  const { data: history } = useQuery<PowerAnalysisCalculation[]>({
    queryKey: ['/api/power-analysis/history'],
  });

  // Calculate mutation
  const { trackUsage, isToolLimitReached, isExpiredFreeTier, getToolLimitInfo } = useToolUsageTracking();
  const isPowerLimitReached = isExpiredFreeTier && isToolLimitReached(TOOL_TYPES.POWER_ANALYSIS);
  const powerLimitInfo = getToolLimitInfo(TOOL_TYPES.POWER_ANALYSIS);
  const [showLimitCard, setShowLimitCard] = useState(false);
  useEffect(() => {
    if (powerLimitInfo?.allowed) setShowLimitCard(false);
  }, [powerLimitInfo?.allowed]);

  const calculateMutation = useMutation({
    mutationFn: async ({ __mode, ...data }: any) => {
      const res = await apiRequest('POST', '/api/power-analysis/calculate', data);
      return await res.json();
    },
    onSuccess: (data, variables) => {
      const { __mode, ...sentPayload } = variables;
      setCalcRequest({ payload: sentPayload, mode: __mode });
      setResult(data);
      logEffectSizeCalculation('poder_amostral');
      trackUsage(TOOL_TYPES.POWER_ANALYSIS, ACTION_TYPES.CALCULATION, {
        subType: variables.testType,
        metadata: {
          calculationMode: variables.mode,
          alpha: variables.alpha,
          power: data.power,
          requiredN: data.requiredN,
        },
      });
      toast({
        title: "✓ Cálculo concluído",
        description: "Resultados exibidos à direita",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro no cálculo",
        description: error.message,
      });
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/power-analysis/save', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/power-analysis/history'] });
      toast({
        title: "✓ Salvo",
        description: "Cálculo salvo no histórico",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/power-analysis/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/power-analysis/history'] });
      toast({
        title: "✓ Removido",
        description: "Cálculo removido do histórico",
      });
    },
  });

  const handleCalculate = async () => {
    if (isPowerLimitReached) {
      setShowLimitCard(true);
      return;
    }

    if (!currentTestDef?.implemented) {
      toast({
        variant: "destructive",
        title: "Teste não implementado",
        description: "Este teste estatístico ainda não está disponível",
      });
      return;
    }

    // Normalize inputs
    const normalizedAlpha = normalizeDecimalInput(alpha);
    const normalizedPower = normalizeDecimalInput(power);
    const normalizedEffectSize = normalizeDecimalInput(effectSize);

    const isCorrelationComparison = selectedTest === 'compare-correlations-independent' || selectedTest === 'compare-correlations-dependent';

    if (!normalizedAlpha || isNaN(parseFloat(normalizedAlpha))) {
      toast({
        variant: "destructive",
        title: "Campo obrigatório",
        description: "Preencha o campo 'α err prob'",
      });
      return;
    }

    if (calculationMode === 'calculate-n') {
      if (!normalizedPower || isNaN(parseFloat(normalizedPower))) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Poder'",
        });
        return;
      }

      if (!isCorrelationComparison) {
        if (!normalizedEffectSize || isNaN(parseFloat(normalizedEffectSize))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: `Preencha o campo '${getEffectSizeLabel()}'`,
          });
          return;
        }
      } else {
        if (!r1 || isNaN(parseFloat(normalizeDecimalInput(r1)))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'r₁'",
          });
          return;
        }
        if (!r2 || isNaN(parseFloat(normalizeDecimalInput(r2)))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'r₂'",
          });
          return;
        }
      }
    } else if (calculationMode === 'have-n-power') {
      if (!isCorrelationComparison) {
        if (!normalizedEffectSize || isNaN(parseFloat(normalizedEffectSize))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: `Preencha o campo '${getEffectSizeLabel()}'`,
          });
          return;
        }
      } else {
        if (!r1 || isNaN(parseFloat(normalizeDecimalInput(r1)))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'r₁'",
          });
          return;
        }
        if (!r2 || isNaN(parseFloat(normalizeDecimalInput(r2)))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'r₂'",
          });
          return;
        }
      }

      if (selectedTest === 'independent-t' || selectedTest === 'mann-whitney') {
        if (!n1 || isNaN(parseInt(n1))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'n₁'",
          });
          return;
        }
        if (!n2 || isNaN(parseInt(n2))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'n₂'",
          });
          return;
        }
      } else if (isCorrelationComparison && selectedTest === 'compare-correlations-independent') {
        if (!n1 || isNaN(parseInt(n1))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'n₁'",
          });
          return;
        }
        if (!n2 || isNaN(parseInt(n2))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'n₂'",
          });
          return;
        }
      } else if (!isCorrelationComparison) {
        if (!n || isNaN(parseInt(n))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'n (tamanho amostral)'",
          });
          return;
        }
      } else {
        if (!n || isNaN(parseInt(n))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'n (tamanho amostral)'",
          });
          return;
        }
      }
    } else if (calculationMode === 'have-n-effect') {
      // Sensitivity: requires power + sample size (and r2/r3 for comparisons),
      // but NOT the effect size / r1 (those are what we solve for).
      if (!normalizedPower || isNaN(parseFloat(normalizedPower))) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Poder'",
        });
        return;
      }

      if (isCorrelationComparison) {
        if (!r2 || isNaN(parseFloat(normalizeDecimalInput(r2)))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'r₂'",
          });
          return;
        }
      }

      if (selectedTest === 'independent-t' || selectedTest === 'mann-whitney' || selectedTest === 'compare-correlations-independent') {
        if (!n1 || isNaN(parseInt(n1))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'n₁'",
          });
          return;
        }
        if (!n2 || isNaN(parseInt(n2))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'n₂'",
          });
          return;
        }
      } else {
        if (!n || isNaN(parseInt(n))) {
          toast({
            variant: "destructive",
            title: "Campo obrigatório",
            description: "Preencha o campo 'n (tamanho amostral)'",
          });
          return;
        }
      }
    }

    if (selectedTest === 'kruskal-wallis' || selectedTest === 'friedman' || selectedTest === 'anova-oneway') {
      if (!k || isNaN(parseInt(k)) || parseInt(k) < 2) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Número de grupos (k)' com valor >= 2",
        });
        return;
      }
    }

    if (selectedTest === 'anova-factorial') {
      if (!numGroups || isNaN(parseInt(numGroups)) || parseInt(numGroups) < 2) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Número de grupos' com valor >= 2",
        });
        return;
      }
      if (!numeratorDf || isNaN(parseInt(numeratorDf)) || parseInt(numeratorDf) < 1) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'gl do numerador' com valor >= 1",
        });
        return;
      }
    }

    if (selectedTest === 'cochran-q') {
      if (!numLevelsA || isNaN(parseInt(numLevelsA)) || parseInt(numLevelsA) < 3) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o número de condições (k) com valor >= 3",
        });
        return;
      }
    }
    if (selectedTest === 'goodness-of-fit') {
      if (!numLevelsA || isNaN(parseInt(numLevelsA)) || parseInt(numLevelsA) < 2) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o número de categorias (k) com valor >= 2",
        });
        return;
      }
    }
    if (selectedTest === 'chi-square-independence') {
      const r = parseInt(numRows);
      const c = parseInt(numCols);
      if (!numRows || !numCols || isNaN(r) || isNaN(c) || r < 2 || c < 2) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o número de linhas e colunas (mínimo 2 cada)",
        });
        return;
      }
      if (r === 2 && c === 2) {
        toast({
          variant: "destructive",
          title: "Use o teste 2×2",
          description: "Para tabelas 2×2 utilize o teste qui-quadrado 2×2 dedicado",
        });
        return;
      }
    }

    if (selectedTest === 'anova-repeated') {
      if (!numMeasurements || isNaN(parseInt(numMeasurements)) || parseInt(numMeasurements) < 2) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Número de medidas' com valor >= 2",
        });
        return;
      }
      if (!correlationBetweenMeasures || isNaN(parseFloat(normalizeDecimalInput(correlationBetweenMeasures)))) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Correlação entre medidas'",
        });
        return;
      }
      if (!sphericityCorrection || isNaN(parseFloat(normalizeDecimalInput(sphericityCorrection)))) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Correção de esfericidade'",
        });
        return;
      }
    }

    if (selectedTest === 'anova-mixed') {
      if (!numGroups || isNaN(parseInt(numGroups)) || parseInt(numGroups) < 2) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Número de grupos' com valor >= 2",
        });
        return;
      }
      if (!numMeasurements || isNaN(parseInt(numMeasurements)) || parseInt(numMeasurements) < 2) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Número de medidas' com valor >= 2",
        });
        return;
      }
      if (!correlationBetweenMeasures || isNaN(parseFloat(normalizeDecimalInput(correlationBetweenMeasures)))) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Correlação entre medidas'",
        });
        return;
      }
      if (!sphericityCorrection || isNaN(parseFloat(normalizeDecimalInput(sphericityCorrection)))) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Correção de esfericidade'",
        });
        return;
      }
    }

    if (selectedTest === 'manova' || selectedTest === 'manova-factorial') {
      if (!numResponseVars || isNaN(parseInt(numResponseVars)) || parseInt(numResponseVars) < 2) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Número de variáveis-resposta' com valor >= 2",
        });
        return;
      }
      if (!k || isNaN(parseInt(k)) || parseInt(k) < 2) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Número de grupos' com valor >= 2",
        });
        return;
      }
    }

    if (selectedTest === 'manova-factorial') {
      if (!numPredictors || isNaN(parseInt(numPredictors)) || parseInt(numPredictors) < 1) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Número de preditores' com valor >= 1",
        });
        return;
      }
      if (parseInt(numPredictors) > parseInt(k) - 1) {
        toast({
          variant: "destructive",
          title: "Valor inválido",
          description: "O número de preditores não pode exceder (número de grupos − 1)",
        });
        return;
      }
    }

    if (selectedTest === 'manova-repeated') {
      if (!numMeasurements || isNaN(parseInt(numMeasurements)) || parseInt(numMeasurements) < 2) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Número de medidas' com valor >= 2",
        });
        return;
      }
      if (!numGroups || isNaN(parseInt(numGroups)) || parseInt(numGroups) < 1) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Número de grupos' com valor >= 1",
        });
        return;
      }
    }

    if (selectedTest === 'regression-multiple-total' || selectedTest === 'regression-multiple-increment') {
      if (!numPredictors || isNaN(parseInt(numPredictors)) || parseInt(numPredictors) < 1) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Número de preditores' com valor >= 1",
        });
        return;
      }
    }
    if (selectedTest === 'regression-multiple-increment') {
      if (!numTestedPredictors || isNaN(parseInt(numTestedPredictors)) || parseInt(numTestedPredictors) < 1) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Preditores testados' com valor >= 1",
        });
        return;
      }
      if (parseInt(numTestedPredictors) > parseInt(numPredictors)) {
        toast({
          variant: "destructive",
          title: "Valor inválido",
          description: "O número de preditores testados não pode exceder o total de preditores",
        });
        return;
      }
    }
    if (selectedTest === 'logistic-regression' || selectedTest === 'multiple-logistic-regression') {
      const p = parseFloat(normalizeDecimalInput(baseProportion));
      if (!baseProportion || isNaN(p) || p <= 0 || p >= 1) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Probabilidade do evento (P)' com valor entre 0 e 1",
        });
        return;
      }
    }
    if (selectedTest === 'logistic-regression' || selectedTest === 'multiple-logistic-regression' || selectedTest === 'poisson-regression') {
      if (xDistribution === 'normal' || xDistribution === 'lognormal') {
        const mu = parseFloat(normalizeDecimalInput(xDistMu));
        if (xDistMu === '' || isNaN(mu)) {
          toast({ variant: "destructive", title: "Campo obrigatório", description: "Preencha o parâmetro μ da distribuição do preditor" });
          return;
        }
        const sigma = parseFloat(normalizeDecimalInput(xDistSigma));
        if (xDistSigma === '' || isNaN(sigma) || sigma <= 0) {
          toast({ variant: "destructive", title: "Campo obrigatório", description: "Preencha o parâmetro σ da distribuição do preditor com valor positivo" });
          return;
        }
      } else if (xDistribution === 'binomial') {
        const pi = parseFloat(normalizeDecimalInput(xDistPi));
        if (xDistPi === '' || isNaN(pi) || pi <= 0 || pi >= 1) {
          toast({ variant: "destructive", title: "Campo obrigatório", description: "Preencha o parâmetro π da distribuição do preditor com valor entre 0 e 1 (exclusivo)" });
          return;
        }
      } else if (xDistribution === 'exponential' || xDistribution === 'poisson') {
        const lambda = parseFloat(normalizeDecimalInput(xDistLambda));
        if (xDistLambda === '' || isNaN(lambda) || lambda <= 0) {
          toast({ variant: "destructive", title: "Campo obrigatório", description: "Preencha o parâmetro λ da distribuição do preditor com valor positivo" });
          return;
        }
      }
    }
    if (selectedTest === 'multiple-logistic-regression' || selectedTest === 'poisson-regression') {
      const r2 = parseFloat(normalizeDecimalInput(r2OtherPredictors));
      if (r2OtherPredictors === '' || isNaN(r2) || r2 < 0 || r2 >= 1) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'R² dos demais preditores' com valor entre 0 e 1 (1 exclusivo)",
        });
        return;
      }
    }
    if (selectedTest === 'poisson-regression') {
      const br = parseFloat(normalizeDecimalInput(baseRate));
      if (!baseRate || isNaN(br) || br <= 0) {
        toast({
          variant: "destructive",
          title: "Campo obrigatório",
          description: "Preencha o campo 'Taxa basal de eventos' com valor positivo",
        });
        return;
      }
    }

    // Map frontend test ID to backend testType
    let testType: string;
    if (selectedTest === 'one-sample-t') testType = 'one-sample';
    else if (selectedTest === 'paired-t') testType = 'paired';
    else if (selectedTest === 'independent-t') testType = 'independent';
    else if (selectedTest === 'wilcoxon-one-sample') testType = 'wilcoxon-one-sample';
    else if (selectedTest === 'mann-whitney') testType = 'mann-whitney';
    else if (selectedTest === 'wilcoxon-paired') testType = 'wilcoxon-paired';
    else if (selectedTest === 'kruskal-wallis') testType = 'kruskal-wallis';
    else if (selectedTest === 'friedman') testType = 'friedman';
    else if (selectedTest === 'anova-oneway') testType = 'anova-oneway';
    else if (selectedTest === 'anova-factorial') testType = 'anova-factorial';
    else if (selectedTest === 'anova-repeated') testType = 'anova-repeated';
    else if (selectedTest === 'anova-mixed') testType = 'anova-mixed';
    else if (selectedTest === 'manova') testType = 'manova-oneway';
    else if (selectedTest === 'manova-factorial') testType = 'manova-factorial';
    else if (selectedTest === 'manova-repeated') testType = 'manova-repeated';
    else if (selectedTest === 'pearson-correlation') testType = 'pearson-correlation';
    else if (selectedTest === 'spearman-correlation') testType = 'spearman-correlation';
    else if (selectedTest === 'kendall-correlation') testType = 'kendall-correlation';
    else if (selectedTest === 'compare-correlations-independent') testType = 'compare-correlations-independent';
    else if (selectedTest === 'compare-correlations-dependent') testType = 'compare-correlations-dependent';
    else if (selectedTest === 'regression-simple') testType = 'regression-simple';
    else if (selectedTest === 'proportion-one-sample') testType = 'proportion-one-sample';
    else if (selectedTest === 'two-proportions') testType = 'two-proportions';
    else if (selectedTest === 'sign-test') testType = 'sign-test';
    else if (selectedTest === 'chi-square-2x2') testType = 'chi-square-2x2';
    else if (selectedTest === 'fisher-exact') testType = 'fisher-exact';
    else if (selectedTest === 'mcnemar') testType = 'mcnemar';
    else if (selectedTest === 'cochran-q') testType = 'cochran-q';
    else if (selectedTest === 'chi-square-independence') testType = 'chi-square-independence';
    else if (selectedTest === 'goodness-of-fit') testType = 'goodness-of-fit';
    else if (selectedTest === 'regression-multiple-total') testType = 'regression-multiple-total';
    else if (selectedTest === 'regression-multiple-increment') testType = 'regression-multiple-increment';
    else if (selectedTest === 'logistic-regression') testType = 'logistic-regression';
    else if (selectedTest === 'multiple-logistic-regression') testType = 'multiple-logistic-regression';
    else if (selectedTest === 'poisson-regression') testType = 'poisson-regression';
    else {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Tipo de teste não suportado",
      });
      return;
    }

    const payload: any = {
      testType,
      alpha: parseFloat(normalizedAlpha),
      tails,
    };

    // Add k parameter for multi-group tests
    if (selectedTest === 'kruskal-wallis' || selectedTest === 'friedman' || selectedTest === 'anova-oneway') {
      payload.k = parseInt(k);
    }
    
    // Add factorial ANOVA parameters (G*Power "special" model: groups + numerator df)
    if (selectedTest === 'anova-factorial') {
      payload.numGroups = parseInt(numGroups);
      payload.numeratorDf = parseInt(numeratorDf);
    }
    
    // Add repeated measures ANOVA parameters
    if (selectedTest === 'anova-repeated') {
      payload.numMeasurements = parseInt(numMeasurements);
      payload.correlationBetweenMeasures = parseFloat(normalizeDecimalInput(correlationBetweenMeasures));
      payload.sphericityCorrection = parseFloat(normalizeDecimalInput(sphericityCorrection));
    }
    
    // Add params for chi-square family (Cochran Q / goodness-of-fit / independence)
    if (selectedTest === 'cochran-q' || selectedTest === 'goodness-of-fit') {
      payload.k = parseInt(numLevelsA);
    }
    if (selectedTest === 'chi-square-independence') {
      payload.numRows = parseInt(numRows);
      payload.numCols = parseInt(numCols);
    }

    // Add regression parameters
    if (selectedTest === 'regression-multiple-total' || selectedTest === 'regression-multiple-increment') {
      payload.numPredictors = parseInt(numPredictors);
    }
    if (selectedTest === 'regression-multiple-increment') {
      payload.numTestedPredictors = parseInt(numTestedPredictors);
    }
    if (selectedTest === 'logistic-regression') {
      payload.baseProportion = parseFloat(normalizeDecimalInput(baseProportion));
    }
    if (selectedTest === 'multiple-logistic-regression') {
      payload.baseProportion = parseFloat(normalizeDecimalInput(baseProportion));
      payload.r2OtherPredictors = parseFloat(normalizeDecimalInput(r2OtherPredictors));
    }
    if (selectedTest === 'logistic-regression' || selectedTest === 'multiple-logistic-regression' || selectedTest === 'poisson-regression') {
      payload.xDistribution = xDistribution;
      if (xDistribution === 'normal' || xDistribution === 'lognormal') {
        payload.xDistMu = parseFloat(normalizeDecimalInput(xDistMu));
        payload.xDistSigma = parseFloat(normalizeDecimalInput(xDistSigma));
      } else if (xDistribution === 'binomial') {
        payload.xDistPi = parseFloat(normalizeDecimalInput(xDistPi));
      } else if (xDistribution === 'exponential' || xDistribution === 'poisson') {
        payload.xDistLambda = parseFloat(normalizeDecimalInput(xDistLambda));
      }
    }
    if (selectedTest === 'poisson-regression') {
      payload.baseRate = parseFloat(normalizeDecimalInput(baseRate));
      payload.r2OtherPredictors = parseFloat(normalizeDecimalInput(r2OtherPredictors));
    }

    // Add MANOVA parameters (Pillai trace)
    if (selectedTest === 'manova') {
      payload.numResponseVars = parseInt(numResponseVars);
      payload.k = parseInt(k);
    }
    if (selectedTest === 'manova-factorial') {
      payload.numResponseVars = parseInt(numResponseVars);
      payload.k = parseInt(k);
      payload.numPredictors = parseInt(numPredictors);
    }
    if (selectedTest === 'manova-repeated') {
      payload.numMeasurements = parseInt(numMeasurements);
      payload.numGroups = parseInt(numGroups);
    }

    // Add mixed ANOVA parameters (between × within)
    if (selectedTest === 'anova-mixed') {
      payload.numGroups = parseInt(numGroups);
      payload.numMeasurements = parseInt(numMeasurements);
      payload.correlationBetweenMeasures = parseFloat(normalizeDecimalInput(correlationBetweenMeasures));
      payload.sphericityCorrection = parseFloat(normalizeDecimalInput(sphericityCorrection));
      payload.effectType = effectType;
    }

    if (calculationMode === 'calculate-n') {
      payload.power = parseFloat(normalizedPower);
      
      // For correlation comparison, send r1 and r2
      if (selectedTest === 'compare-correlations-independent') {
        payload.r1 = parseFloat(normalizeDecimalInput(r1));
        payload.r2 = parseFloat(normalizeDecimalInput(r2));
      } else if (selectedTest === 'compare-correlations-dependent') {
        payload.r1 = parseFloat(normalizeDecimalInput(r1));
        payload.r2 = parseFloat(normalizeDecimalInput(r2));
        if (r3) {
          payload.r3 = parseFloat(normalizeDecimalInput(r3));
        }
      } else {
        payload.effectSize = parseFloat(normalizedEffectSize);
      }
      
      if ((selectedTest === 'independent-t' || selectedTest === 'mann-whitney') && n1) {
        // Allocation ratio n1/n2 (accepts decimals such as 0,5 or 1.5)
        const ratio = parseFloat(normalizeDecimalInput(n1));
        if (Number.isFinite(ratio) && ratio > 0) payload.n1 = ratio;
      }
    } else if (calculationMode === 'have-n-power') {
      // For correlation comparison, send r1 and r2
      if (selectedTest === 'compare-correlations-independent') {
        payload.r1 = parseFloat(normalizeDecimalInput(r1));
        payload.r2 = parseFloat(normalizeDecimalInput(r2));
        payload.n1 = parseInt(n1);
        payload.n2 = parseInt(n2);
      } else if (selectedTest === 'compare-correlations-dependent') {
        payload.r1 = parseFloat(normalizeDecimalInput(r1));
        payload.r2 = parseFloat(normalizeDecimalInput(r2));
        if (r3) {
          payload.r3 = parseFloat(normalizeDecimalInput(r3));
        }
        payload.n = parseInt(n);
      } else if (selectedTest === 'independent-t' || selectedTest === 'mann-whitney') {
        payload.effectSize = parseFloat(normalizedEffectSize);
        payload.n1 = parseInt(n1);
        payload.n2 = parseInt(n2);
      } else {
        payload.effectSize = parseFloat(normalizedEffectSize);
        payload.n = parseInt(n);
      }
    } else if (calculationMode === 'have-n-effect') {
      // Sensitivity: send power + sample size, but NOT the effect / r1
      // (the backend solves for the minimum detectable effect). Comparison
      // tests send the fixed r2 (and r3) only.
      payload.power = parseFloat(normalizedPower);

      if (selectedTest === 'compare-correlations-independent') {
        payload.r2 = parseFloat(normalizeDecimalInput(r2));
        payload.n1 = parseInt(n1);
        payload.n2 = parseInt(n2);
      } else if (selectedTest === 'compare-correlations-dependent') {
        payload.r2 = parseFloat(normalizeDecimalInput(r2));
        if (r3) {
          payload.r3 = parseFloat(normalizeDecimalInput(r3));
        }
        payload.n = parseInt(n);
      } else if (selectedTest === 'independent-t' || selectedTest === 'mann-whitney') {
        payload.n1 = parseInt(n1);
        payload.n2 = parseInt(n2);
      } else {
        payload.n = parseInt(n);
      }
    }

    calculateMutation.mutate({ ...payload, __mode: calculationMode });
  };

  const handleSave = () => {
    if (!result) return;

    const payload = {
      testType: selectedTest,
      testFamily: macrocategory,
      inputParameters: {
        alpha,
        effectSize,
        power,
        n,
        n1,
        n2,
        tails,
        calculationMode,
        k,
        numLevelsA,
        numLevelsB,
        numeratorDf,
        effectType,
        numMeasurements,
        numGroups,
        correlationBetweenMeasures,
        sphericityCorrection,
        r1,
        r2,
        r3,
        numPredictors,
        numTestedPredictors,
        baseProportion,
        r2OtherPredictors,
        xDistribution,
        xDistMu,
        xDistSigma,
        xDistPi,
        xDistLambda,
        baseRate,
        fullResult: result,
        calcRequest,
      },
      calculatedPower: result.power?.toString() || null,
      requiredSampleSize: result.requiredN || result.requiredN1 || null,
      effectSize: result.effectSize.toString(),
      alpha: result.alpha.toString(),
    };

    saveMutation.mutate(payload);
  };

  const handleRestoreCalculation = (calc: PowerAnalysisCalculation) => {
    const params = calc.inputParameters;
    
    // Restore macrocategory (testFamily)
    if (calc.testFamily) {
      setMacrocategory(calc.testFamily as Macrocategory);
    }
    
    // Restore test type
    if (calc.testType) {
      setSelectedTest(calc.testType);
    }
    
    // Restore calculation mode
    if (params.calculationMode) {
      setCalculationMode(params.calculationMode as CalculationMode);
    }
    
    // Restore basic parameters
    if (params.alpha !== undefined && params.alpha !== null) {
      setAlpha(String(params.alpha));
    }
    if (params.effectSize !== undefined && params.effectSize !== null) {
      setEffectSize(String(params.effectSize));
    }
    if (params.power !== undefined && params.power !== null) {
      setPower(String(params.power));
    }
    if (params.n !== undefined && params.n !== null) {
      setN(String(params.n));
    }
    if (params.n1 !== undefined && params.n1 !== null) {
      setN1(String(params.n1));
    }
    if (params.n2 !== undefined && params.n2 !== null) {
      setN2(String(params.n2));
    }
    if (params.tails) {
      setTails(params.tails as Tails);
    }
    
    // Restore correlation comparison parameters
    if (params.r1 !== undefined && params.r1 !== null) {
      setR1(String(params.r1));
    }
    if (params.r2 !== undefined && params.r2 !== null) {
      setR2(String(params.r2));
    }
    if (params.r3 !== undefined && params.r3 !== null) {
      setR3(String(params.r3));
    }
    
    // Restore multi-group parameters
    if (params.k !== undefined && params.k !== null) {
      setK(String(params.k));
    }
    
    // Restore MANOVA parameters
    if (params.numResponseVars !== undefined && params.numResponseVars !== null) {
      setNumResponseVars(String(params.numResponseVars));
    }

    // Restore factorial ANOVA parameters
    if (params.numLevelsA !== undefined && params.numLevelsA !== null) {
      setNumLevelsA(String(params.numLevelsA));
    }
    if (params.numLevelsB !== undefined && params.numLevelsB !== null) {
      setNumLevelsB(String(params.numLevelsB));
    }
    if (params.numeratorDf !== undefined && params.numeratorDf !== null) {
      setNumeratorDf(String(params.numeratorDf));
    }
    if (params.effectType) {
      setEffectType(params.effectType as 'main_a' | 'main_b' | 'interaction' | 'within' | 'between' | 'within_between');
    }
    
    // Restore repeated measures parameters
    if (params.numMeasurements !== undefined && params.numMeasurements !== null) {
      setNumMeasurements(String(params.numMeasurements));
    }
    if (params.numGroups !== undefined && params.numGroups !== null) {
      setNumGroups(String(params.numGroups));
    }
    if (params.correlationBetweenMeasures !== undefined && params.correlationBetweenMeasures !== null) {
      setCorrelationBetweenMeasures(String(params.correlationBetweenMeasures));
    }
    if (params.sphericityCorrection !== undefined && params.sphericityCorrection !== null) {
      setSphericityCorrection(String(params.sphericityCorrection));
    }

    // Restore regression parameters
    if (params.numPredictors !== undefined && params.numPredictors !== null) {
      setNumPredictors(String(params.numPredictors));
    }
    if (params.numTestedPredictors !== undefined && params.numTestedPredictors !== null) {
      setNumTestedPredictors(String(params.numTestedPredictors));
    }
    if (params.baseProportion !== undefined && params.baseProportion !== null) {
      setBaseProportion(String(params.baseProportion));
    }
    if (params.r2OtherPredictors !== undefined && params.r2OtherPredictors !== null) {
      setR2OtherPredictors(String(params.r2OtherPredictors));
    }
    if (params.xDistribution !== undefined && params.xDistribution !== null) {
      setXDistribution(String(params.xDistribution));
    }
    if (params.xDistMu !== undefined && params.xDistMu !== null) {
      setXDistMu(String(params.xDistMu));
    }
    if (params.xDistSigma !== undefined && params.xDistSigma !== null) {
      setXDistSigma(String(params.xDistSigma));
    }
    if (params.xDistPi !== undefined && params.xDistPi !== null) {
      setXDistPi(String(params.xDistPi));
    }
    if (params.xDistLambda !== undefined && params.xDistLambda !== null) {
      setXDistLambda(String(params.xDistLambda));
    }
    if (params.baseRate !== undefined && params.baseRate !== null) {
      setBaseRate(String(params.baseRate));
    }
    
    // Restore full result if available, otherwise reconstruct from saved data
    if (params.fullResult) {
      setCalcRequest(params.calcRequest ?? null);
      setResult(params.fullResult as PowerAnalysisResult);
    } else {
      // Fallback for older saved calculations without fullResult
      const restoredResult: PowerAnalysisResult = {
        power: calc.calculatedPower ? parseFloat(calc.calculatedPower) : undefined,
        requiredN: calc.requiredSampleSize || undefined,
        effectSize: calc.effectSize ? parseFloat(calc.effectSize) : 0,
        alpha: calc.alpha ? parseFloat(calc.alpha) : 0.05,
        df: 0,
        criticalValue: 0,
        testType: calc.testType,
      };
      setCalcRequest(null);
      setResult(restoredResult);
    }
    
    setHistoryOpen(false);
    
    toast({
      title: "Cálculo restaurado",
      description: "Os parâmetros e resultados foram recuperados do histórico",
    });
  };

  const handleDownloadTXT = () => {
    if (!result) return;

    const family = getEffectSizeFamily();
    const testName = currentTestDef?.label || selectedTest;
    const isChiSquareFamily = ['chi-square-2x2', 'chi-square-independence', 'goodness-of-fit', 'mcnemar', 'cochran-q', 'fisher-exact'].includes(selectedTest);

    const modeLabel =
      calculationMode === 'calculate-n' ? 'A priori (cálculo do tamanho amostral)' :
      calculationMode === 'have-n-power' ? 'Post-hoc (cálculo do poder)' :
      'Sensibilidade (menor tamanho de efeito detectável)';

    const criticalValueLabel = criticalValueLabelFor(result.testType);

    const formatXDistribution = (): string => {
      const name =
        result.xDistribution === 'normal' ? 'Normal'
        : result.xDistribution === 'binomial' ? 'Binomial (Bernoulli)'
        : result.xDistribution === 'poisson' ? 'Poisson'
        : result.xDistribution === 'exponential' ? 'Exponencial'
        : result.xDistribution === 'lognormal' ? 'Lognormal'
        : result.xDistribution || '';
      const params =
        (result.xDistribution === 'normal' || result.xDistribution === 'lognormal')
          && result.xDistMu !== undefined && result.xDistSigma !== undefined
          ? ` (μ = ${result.xDistMu}, σ = ${result.xDistSigma})`
          : result.xDistribution === 'binomial' && result.xDistPi !== undefined
          ? ` (π = ${result.xDistPi})`
          : (result.xDistribution === 'exponential' || result.xDistribution === 'poisson')
            && result.xDistLambda !== undefined
          ? ` (λ = ${result.xDistLambda})`
          : '';
      return `${name}${params}`;
    };

    const lines: string[] = [];
    lines.push('# Análise de Poder Estatístico');
    lines.push('');
    lines.push(`Teste: ${testName}`);
    lines.push(`Modo de cálculo: ${modeLabel}`);
    lines.push('');

    // Input parameters
    lines.push('## Parâmetros de entrada');
    lines.push(`Nível de significância (α): ${normalizeDecimalInput(alpha)}`);
    if (!isChiSquareFamily) {
      lines.push(`Cauda(s): ${tails === 'two' ? 'Bilateral (duas caudas)' : 'Unilateral (uma cauda)'}`);
    }
    if (calculationMode !== 'have-n-effect' && effectSize) {
      lines.push(`${family.label}: ${effectSize}`);
    }
    if (calculationMode !== 'have-n-power' && power) {
      lines.push(`Poder desejado (1 – β): ${normalizeDecimalInput(power)}`);
    }
    if (calculationMode !== 'calculate-n') {
      if (n) lines.push(`Tamanho amostral (n): ${n}`);
      if (n1) lines.push(`Tamanho grupo 1 (n₁): ${n1}`);
      if (n2) lines.push(`Tamanho grupo 2 (n₂): ${n2}`);
    }
    if (['kruskal-wallis', 'friedman', 'anova-oneway'].includes(selectedTest) && k) {
      lines.push(`Número de grupos (k): ${k}`);
    }
    if (selectedTest === 'anova-factorial') {
      lines.push(`Níveis do fator A: ${numLevelsA}`);
      lines.push(`Níveis do fator B: ${numLevelsB}`);
      lines.push(`Graus de liberdade do numerador: ${numeratorDf}`);
    }
    if (['anova-repeated', 'anova-mixed'].includes(selectedTest)) {
      lines.push(`Número de medições repetidas: ${numMeasurements}`);
      if (selectedTest === 'anova-mixed') lines.push(`Número de grupos: ${numGroups}`);
      lines.push(`Correlação entre medidas: ${correlationBetweenMeasures}`);
      lines.push(`Correção de esfericidade (ε): ${sphericityCorrection}`);
    }
    if (['manova', 'manova-factorial', 'manova-repeated'].includes(selectedTest)) {
      lines.push(`Número de variáveis resposta (p): ${numResponseVars}`);
      lines.push(`Número de grupos: ${numGroups}`);
    }
    if (selectedTest === 'regression-multiple-total' || selectedTest === 'regression-multiple-increment') {
      lines.push(`Número de preditores: ${numPredictors}`);
      if (selectedTest === 'regression-multiple-increment') {
        lines.push(`Preditores testados: ${numTestedPredictors}`);
      }
    }
    if (['logistic-regression', 'multiple-logistic-regression', 'poisson-regression'].includes(selectedTest)) {
      if (selectedTest !== 'poisson-regression') lines.push(`Probabilidade base (P): ${baseProportion}`);
      if (selectedTest === 'poisson-regression') lines.push(`Taxa base de eventos: ${baseRate}`);
      if (selectedTest === 'multiple-logistic-regression' || selectedTest === 'poisson-regression') {
        lines.push(`R² dos outros preditores: ${r2OtherPredictors}`);
      }
      lines.push(`Distribuição do preditor: ${formatXDistribution()}`);
    }
    if (selectedTest === 'compare-correlations-independent' || selectedTest === 'compare-correlations-dependent') {
      if (r1) lines.push(`Correlação 1 (r₁): ${r1}`);
      if (r2) lines.push(`Correlação 2 (r₂): ${r2}`);
      if (r3) lines.push(`Correlação r_yz: ${r3}`);
    }
    if (selectedTest === 'chi-square-independence') {
      lines.push(`Linhas: ${numRows}`);
      lines.push(`Colunas: ${numCols}`);
    }
    lines.push('');

    // Results (mirrors the on-screen panel)
    lines.push('## Resultados');
    if (result.minDetectableEffect !== undefined) {
      lines.push(`Efeito mínimo detectável (${family.symbol}): ${result.minDetectableEffect.toFixed(4)}`);
    }
    if (result.power !== undefined) {
      lines.push(`Poder: ${result.power.toFixed(6)}`);
    }
    if (result.requiredN !== undefined) {
      if ((result.testType === 'anova-oneway' || result.testType === 'kruskal-wallis') && result.k) {
        lines.push(`Tamanho amostral total: ${result.totalN ?? result.requiredN * result.k}`);
        lines.push(`Tamanho por grupo: ${result.requiredN}`);
      } else if (result.testType === 'anova-factorial' && result.numGroups) {
        lines.push(`Tamanho amostral total: ${result.requiredN}`);
      } else if (result.testType === 'anova-mixed' && result.nPerGroup && result.numGroups) {
        lines.push(`Tamanho amostral total: ${result.requiredN}`);
        lines.push(`Tamanho por grupo: ${result.nPerGroup}`);
      } else {
        lines.push(`Tamanho amostral necessário: ${result.requiredN}`);
      }
    }
    if (result.requiredN1 !== undefined) {
      lines.push(`Tamanho grupo 1: ${result.requiredN1}`);
    }
    if (result.requiredN2 !== undefined) {
      lines.push(`Tamanho grupo 2: ${result.requiredN2}`);
      if (result.requiredN1 !== undefined) lines.push(`Tamanho amostral total: ${result.requiredN1 + result.requiredN2}`);
    }
    if (result.df !== 0) {
      lines.push(`${result.df2 !== undefined ? 'Graus de liberdade (num.)' : 'Graus de liberdade'}: ${formatDf(result.df)}`);
    }
    if (result.df2 !== undefined) {
      lines.push(`Graus de liberdade (denom.): ${formatDf(result.df2)}`);
    }
    if (result.ncp !== undefined) {
      lines.push(`${ncpLabelFor(result.testType)}: ${result.ncp.toFixed(7)}`);
    }
    if (result.actualPower !== undefined) {
      lines.push(`Poder real (com o N inteiro): ${result.actualPower.toFixed(7)}`);
    }
    if (result.parentDistribution) {
      lines.push(`Distribuição de origem: Normal (A.R.E. = 3/π ≈ ${(result.are ?? 3 / Math.PI).toFixed(4)})`);
    }
    if (result.pillaiV !== undefined) {
      lines.push(`Traço de Pillai (V): ${result.pillaiV.toFixed(4)}`);
    }
    if ((result.testType === 'logistic-regression' || result.testType === 'multiple-logistic-regression' || result.testType === 'poisson-regression') && result.xDistribution) {
      lines.push(`Distribuição do preditor: ${formatXDistribution()}`);
    }
    lines.push(`${criticalValueLabel}: ${result.criticalValue.toFixed(7)}`);
    if (selectedTest === 'fisher-exact') {
      lines.push('');
      lines.push('Método: aproximação normal (teste z para tabela 2×2, equivalente ao χ² com 1 gl), com N inflado em 15% para aproximar o conservadorismo do teste exato. Não é o poder exato por enumeração do G*Power.');
    }
    if (NONPARAM_TESTS.includes(selectedTest)) {
      lines.push('');
      lines.push(selectedTest === 'kruskal-wallis' || selectedTest === 'friedman'
        ? 'Método: A.R.E. (eficiência relativa assintótica) aplicado ao F não central do teste paramétrico correspondente, com N efetivo = N × A.R.E. no λ e nos graus de liberdade. Distribuição de origem: Normal. O G*Power não possui módulo para este teste.'
        : 'Método: A.R.E. do G*Power (t não central com N efetivo = N × A.R.E. no δ e nos graus de liberdade). Distribuição de origem: Normal.');
    }
    lines.push('');

    // Citation & references
    const procedureText = generateCitationText();
    if (procedureText) {
      lines.push('## Citação e Referência');
      lines.push('Como citar este aplicativo:');
      lines.push(`Psicometria Online Academy. (${getCurrentYear()}). Calculadora de Análise de Poder Estatístico [Software]. Recuperado de https://psicometriaonline.com.br/`);
      lines.push('');
      lines.push('Como referenciar o procedimento:');
      lines.push(procedureText.replace(/\[inserir referência\]/g, '[inserir referência]'));
      lines.push('');
      lines.push('Referências:');
      getTestReferences(selectedTest).forEach((refKey) => {
        lines.push(APA_REFERENCES[refKey].replace(/<[^>]+>/g, ''));
      });
      lines.push('');
    }

    lines.push('---------------------------------------');
    lines.push(`Calculado em: ${new Date().toLocaleString()}`);
    lines.push('Ferramenta: Calculadora de Análise de Poder - Psicometria Online Academy');

    const fileContent = lines.join('\n');
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analise_poder_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Reset distribution parameters to G*Power defaults whenever the predictor
  // distribution changes (μ=0, σ=1, π=0.5, λ=1).
  const handleXDistributionChange = (value: string) => {
    setXDistribution(value);
    setXDistMu('0');
    setXDistSigma('1');
    setXDistPi('0.5');
    setXDistLambda('1');
  };

  // Predictor-distribution selector + progressive parameter fields, shared by
  // both logistic calculators (single and multiple).
  const renderXDistributionFields = () => (
    <>
      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
        <div className="flex items-center gap-1">
          <Label htmlFor="xDistribution" className="text-sm">Distribuição do preditor (X)</Label>
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                Distribuição assumida para a variável preditora (X). O padrão é Normal, que mantém exatamente os resultados anteriores. Escolha outra distribuição apenas se o seu preditor seguir esse formato; os parâmetros já vêm preenchidos com os valores padrão do G*Power.
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
        <Select value={xDistribution} onValueChange={handleXDistributionChange}>
          <SelectTrigger id="xDistribution" data-testid="select-x-distribution" className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal (padrão)</SelectItem>
            <SelectItem value="binomial">Binomial (Bernoulli)</SelectItem>
            <SelectItem value="poisson">Poisson</SelectItem>
            <SelectItem value="exponential">Exponencial</SelectItem>
            <SelectItem value="lognormal">Lognormal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(xDistribution === 'normal' || xDistribution === 'lognormal') && (
        <>
          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
            <div className="flex items-center gap-1">
              <Label htmlFor="xDistMu" className="text-sm">{xDistribution === 'lognormal' ? 'μ (de ln X)' : 'μ (média de X)'}</Label>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-xs">
                    {xDistribution === 'lognormal'
                      ? 'Média do logaritmo natural de X (ln X). Padrão do G*Power: 0.'
                      : 'Média da distribuição normal do preditor. Padrão do G*Power: 0.'}
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <Input
              id="xDistMu"
              type="text"
              placeholder="0"
              value={xDistMu}
              onChange={(e) => setXDistMu(e.target.value)}
              data-testid="input-x-dist-mu"
              className="h-8"
            />
          </div>
          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
            <div className="flex items-center gap-1">
              <Label htmlFor="xDistSigma" className="text-sm">{xDistribution === 'lognormal' ? 'σ (de ln X)' : 'σ (desvio-padrão)'}</Label>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-xs">
                    {xDistribution === 'lognormal'
                      ? 'Desvio-padrão do logaritmo natural de X (ln X). Deve ser positivo. Padrão do G*Power: 1.'
                      : 'Desvio-padrão da distribuição normal do preditor. Deve ser positivo. Padrão do G*Power: 1.'}
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <Input
              id="xDistSigma"
              type="text"
              placeholder="1"
              value={xDistSigma}
              onChange={(e) => setXDistSigma(e.target.value)}
              data-testid="input-x-dist-sigma"
              className="h-8"
            />
          </div>
        </>
      )}

      {xDistribution === 'binomial' && (
        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
          <div className="flex items-center gap-1">
            <Label htmlFor="xDistPi" className="text-sm">π (prob. de sucesso)</Label>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs">
                  Probabilidade de o preditor binário (0/1) assumir o valor 1, entre 0 e 1 (exclusivo). Padrão do G*Power: 0,5.
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
          <Input
            id="xDistPi"
            type="text"
            placeholder="0,5"
            value={xDistPi}
            onChange={(e) => setXDistPi(e.target.value)}
            data-testid="input-x-dist-pi"
            className="h-8"
          />
        </div>
      )}

      {(xDistribution === 'exponential' || xDistribution === 'poisson') && (
        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
          <div className="flex items-center gap-1">
            <Label htmlFor="xDistLambda" className="text-sm">λ (média)</Label>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs">
                  {xDistribution === 'exponential'
                    ? 'Média da distribuição exponencial do preditor (parâmetro de escala). Deve ser positiva. Padrão do G*Power: 1.'
                    : 'Média da distribuição de Poisson do preditor. Deve ser positiva. Padrão do G*Power: 1.'}
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
          <Input
            id="xDistLambda"
            type="text"
            placeholder="1"
            value={xDistLambda}
            onChange={(e) => setXDistLambda(e.target.value)}
            data-testid="input-x-dist-lambda"
            className="h-8"
          />
        </div>
      )}
    </>
  );

  // Distribution params wrapped in a discreet collapsible section (closed by
  // default), rendered below all other parameters and above the calculate button.
  const renderXDistributionSection = () => (
    <Collapsible open={xDistOpen} onOpenChange={setXDistOpen} className="space-y-1.5">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-between px-2"
          data-testid="button-toggle-x-distribution"
        >
          <span className="text-sm">Distribuição do preditor (X)</span>
          {xDistOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1.5 pt-1">
        {renderXDistributionFields()}
      </CollapsibleContent>
    </Collapsible>
  );

  const info = getSampleSizeInfo(selectedTest);

  return (
    <div className="min-h-screen flex flex-col md:h-screen md:overflow-hidden">
      <SampleSizeInfoModal
        isOpen={infoModalOpen}
        onOpenChange={setInfoModalOpen}
        title={info.title}
        summary={info.summary}
        parameters={info.parameters}
        guidelines={info.guidelines}
        example={info.example}
        references={info.references}
      />
      {/* Header */}
      <div className="border-b bg-background px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-start sm:items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <Calculator className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
            <h1 className="sm:text-xl font-bold text-[24px]">Calculadora de Tamanho Amostral e Poder Estatístico</h1>
          </div>
          
          {/* History Collapsible in Header */}
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-toggle-history">
                <History className="w-4 h-4 mr-2" />
                Histórico {history && history.length > 0 && `(${history.length})`}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        {/* History Dropdown */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleContent>
            <Card className="mt-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Cálculos Salvos</CardTitle>
              </CardHeader>
              <CardContent className="max-h-48 overflow-y-auto">
                {history && history.length > 0 ? (
                  <div className="space-y-2">
                    {history.map((calc) => (
                      <Card 
                        key={calc.id} 
                        className="p-2 hover-elevate cursor-pointer"
                        onClick={() => handleRestoreCalculation(calc)}
                        data-testid={`card-calculation-${calc.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 space-y-0.5">
                            <p className="text-xs font-medium">
                              {TEST_DEFINITIONS.find(t => t.id === calc.testType)?.label || calc.testType}
                            </p>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {calc.effectSize && <span>d: {parseFloat(calc.effectSize).toFixed(2)}</span>}
                              {calc.requiredSampleSize && <span>N: {calc.requiredSampleSize}</span>}
                              {calc.calculatedPower && <span>Poder: {(parseFloat(calc.calculatedPower) * 100).toFixed(0)}%</span>}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(calc.id);
                            }}
                            data-testid={`button-delete-${calc.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Nenhum cálculo salvo
                  </p>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <CalculadoraTipoSelector />

      {isExpiredFreeTier && powerLimitInfo && !powerLimitInfo.allowed && (
        <div className="px-4 pt-3">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Você já usou seu limite de cálculos de hoje. Renova amanhã às 00:00.{" "}
              <a href="/user/subscription" className="underline text-blue-600 dark:text-blue-400 hover:opacity-80">Ver planos</a>
            </AlertDescription>
          </Alert>
        </div>
      )}
      {isExpiredFreeTier && powerLimitInfo && powerLimitInfo.allowed && (powerLimitInfo.limit ?? 0) > 0 && (
        <div className="px-4 pt-3">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Uso diário: {powerLimitInfo.used}/{powerLimitInfo.limit} cálculos
            </AlertDescription>
          </Alert>
        </div>
      )}
      {/* Main Content - Two Columns (Desktop) / Stacked (Mobile) */}
      <div className="flex-1 md:overflow-hidden overflow-auto no-mobile-padding">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:h-full p-4">
          {/* LEFT COLUMN: INPUTS - GPower Style Compact */}
          <div className="md:overflow-y-auto">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">Configuração</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setInfoModalOpen(true)}
                  className="text-blue-600 hover:text-blue-800 h-7"
                  data-testid="button-saiba-mais"
                >
                  <BookOpen className="w-4 h-4 mr-1" />
                  Saiba mais
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Test Selection - Compact */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                    <div className="flex items-center gap-1">
                      <Label className="text-sm">Macrocategoria</Label>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs text-xs">
                            Categoria geral do teste estatístico que será realizado (ex.: médias, correlações).
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    </div>
                    <Select value={macrocategory} onValueChange={(v) => handleCategoryChange(v as Macrocategory)}>
                      <SelectTrigger data-testid="select-macrocategory" className="h-8 w-full overflow-hidden">
                        <span className="truncate"><SelectValue /></span>
                      </SelectTrigger>
                      <SelectContent className="max-h-[60vh]">
                        {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                          <SelectItem key={key} value={key}>
                            {info.icon} {info.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                    <div className="flex items-center gap-1">
                      <Label className="text-sm">Teste</Label>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs text-xs">
                            Teste estatístico específico para o qual será calculado o poder ou tamanho amostral.
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    </div>
                    <Popover open={testSelectorOpen} onOpenChange={setTestSelectorOpen}>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          role="combobox" 
                          data-testid="select-test"
                          className="h-8 justify-between font-normal text-left w-full overflow-hidden"
                        >
                          <span className="truncate flex-1 min-w-0">
                            {currentTestDef?.label || 'Selecione um teste'}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[380px] p-0" align="start">
                        <ScrollArea className="h-[400px] pr-3" thumbClassName="bg-zinc-500 dark:bg-zinc-600">
                          <div className="p-2">
                            {macrocategory === 'means' ? (
                              <>
                                {/* Delineamentos Transversais */}
                                <div className="mb-3">
                                  <div className="px-2 py-1.5 text-sm font-semibold text-foreground bg-muted/50 rounded-md mb-1">
                                    Delineamentos Transversais
                                  </div>
                                  
                                  <div className="pl-2 mb-1">
                                    <div className="text-xs text-muted-foreground py-1 px-2">Um único grupo</div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'one-sample-t' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('one-sample-t'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'one-sample-t' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'one-sample-t' ? '' : 'ml-6'}>Teste t de amostra única</span>
                                      </Button>
                                      <TestInfoButton testId="one-sample-t" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'wilcoxon-one-sample' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('wilcoxon-one-sample'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'wilcoxon-one-sample' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'wilcoxon-one-sample' ? '' : 'ml-6'}>Wilcoxon de 1 amostra</span>
                                      </Button>
                                      <TestInfoButton testId="wilcoxon-one-sample" />
                                    </div>
                                  </div>
                                  
                                  <div className="pl-2 mb-1">
                                    <div className="text-xs text-muted-foreground py-1 px-2">Dois grupos</div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'independent-t' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('independent-t'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'independent-t' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'independent-t' ? '' : 'ml-6'}>Teste t para amostras independentes</span>
                                      </Button>
                                      <TestInfoButton testId="independent-t" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'mann-whitney' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('mann-whitney'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'mann-whitney' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'mann-whitney' ? '' : 'ml-6'}>Mann-Whitney (não-paramétrico)</span>
                                      </Button>
                                      <TestInfoButton testId="mann-whitney" />
                                    </div>
                                  </div>
                                  
                                  <div className="pl-2">
                                    <div className="text-xs text-muted-foreground py-1 px-2">Três ou mais grupos</div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'anova-oneway' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('anova-oneway'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'anova-oneway' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'anova-oneway' ? '' : 'ml-6'}>ANOVA simples (One-Way)</span>
                                      </Button>
                                      <TestInfoButton testId="anova-oneway" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'anova-factorial' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('anova-factorial'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'anova-factorial' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'anova-factorial' ? '' : 'ml-6'}>ANOVA fatorial</span>
                                      </Button>
                                      <TestInfoButton testId="anova-factorial" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'kruskal-wallis' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('kruskal-wallis'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'kruskal-wallis' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'kruskal-wallis' ? '' : 'ml-6'}>Kruskal-Wallis (não-paramétrico)</span>
                                      </Button>
                                      <TestInfoButton testId="kruskal-wallis" />
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Delineamentos Longitudinais */}
                                <div className="mb-3">
                                  <div className="px-2 py-1.5 text-sm font-semibold text-foreground bg-muted/50 rounded-md mb-1">
                                    Delineamentos Longitudinais
                                  </div>
                                  
                                  <div className="pl-2 mb-1">
                                    <div className="text-xs text-muted-foreground py-1 px-2">Dois tempos</div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'paired-t' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('paired-t'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'paired-t' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'paired-t' ? '' : 'ml-6'}>Teste t para amostras dependentes</span>
                                      </Button>
                                      <TestInfoButton testId="paired-t" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'wilcoxon-paired' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('wilcoxon-paired'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'wilcoxon-paired' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'wilcoxon-paired' ? '' : 'ml-6'}>Wilcoxon signed-rank (não-paramétrico)</span>
                                      </Button>
                                      <TestInfoButton testId="wilcoxon-paired" />
                                    </div>
                                  </div>
                                  
                                  <div className="pl-2">
                                    <div className="text-xs text-muted-foreground py-1 px-2">Três ou mais tempos</div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'anova-repeated' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('anova-repeated'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'anova-repeated' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'anova-repeated' ? '' : 'ml-6'}>ANOVA de Medidas Repetidas</span>
                                      </Button>
                                      <TestInfoButton testId="anova-repeated" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'anova-mixed' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('anova-mixed'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'anova-mixed' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'anova-mixed' ? '' : 'ml-6'}>ANOVA Mista (between × within)</span>
                                      </Button>
                                      <TestInfoButton testId="anova-mixed" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'friedman' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('friedman'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'friedman' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'friedman' ? '' : 'ml-6'}>ANOVA de Friedman (não-paramétrico)</span>
                                      </Button>
                                      <TestInfoButton testId="friedman" />
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Análises Multivariadas */}
                                <div>
                                  <div className="px-2 py-1.5 text-sm font-semibold text-foreground bg-muted/50 rounded-md mb-1">
                                    Análises Multivariadas
                                  </div>
                                  <div className="pl-2 space-y-1">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'manova' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('manova'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'manova' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'manova' ? '' : 'ml-6'}>MANOVA (one-way)</span>
                                      </Button>
                                      <TestInfoButton testId="manova" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'manova-factorial' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('manova-factorial'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'manova-factorial' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'manova-factorial' ? '' : 'ml-6'}>MANOVA Fatorial</span>
                                      </Button>
                                      <TestInfoButton testId="manova-factorial" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${selectedTest === 'manova-repeated' ? 'bg-accent' : ''}`}
                                        onClick={() => { handleTestChange('manova-repeated'); setTestSelectorOpen(false); }}
                                      >
                                        {selectedTest === 'manova-repeated' && <Check className="mr-2 h-4 w-4" />}
                                        <span className={selectedTest === 'manova-repeated' ? '' : 'ml-6'}>MANOVA de Medidas Repetidas</span>
                                      </Button>
                                      <TestInfoButton testId="manova-repeated" />
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="space-y-1">
                                {availableTests.map((test) => (
                                  <div key={test.id} className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      className={`flex-1 justify-start h-8 px-2 text-sm font-normal ${
                                        selectedTest === test.id ? 'bg-accent' : ''
                                      } ${!test.implemented ? 'text-muted-foreground cursor-not-allowed' : ''}`}
                                      onClick={() => { if (test.implemented) { handleTestChange(test.id); setTestSelectorOpen(false); } }}
                                      disabled={!test.implemented}
                                    >
                                      {selectedTest === test.id && <Check className="mr-2 h-4 w-4" />}
                                      <span className={selectedTest === test.id ? '' : 'ml-6'}>
                                        {test.label} {!test.implemented && '(em breve)'}
                                      </span>
                                    </Button>
                                    <TestInfoButton testId={test.id} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <Separator />

                {/* Calculation Mode - Compact Radio */}
                <div className="space-y-1">
                  <Label className="text-sm">Modo de Cálculo</Label>
                  <RadioGroup value={calculationMode} onValueChange={(v) => setCalculationMode(v as CalculationMode)} className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="calculate-n" id="mode-n" data-testid="radio-calculate-n" />
                      <Label htmlFor="mode-n" className="text-sm font-normal cursor-pointer">
                        Calcular n
                      </Label>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs text-xs">
                            Análise a priori: determina o tamanho amostral necessário para detectar um efeito esperado com poder e significância especificados.
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="have-n-power" id="mode-power" data-testid="radio-have-n" />
                      <Label htmlFor="mode-power" className="text-sm font-normal cursor-pointer">
                        Calcular poder
                      </Label>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs text-xs">
                            Análise post-hoc: calcula a probabilidade de detectar um efeito dado o tamanho amostral disponível.
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="have-n-effect" id="mode-effect" data-testid="radio-have-n-effect" />
                      <Label htmlFor="mode-effect" className="text-sm font-normal cursor-pointer">
                        Calcular efeito
                      </Label>
                      <TooltipProvider>
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs text-xs">
                            Análise de sensibilidade: determina o menor tamanho de efeito detectável dado o tamanho amostral e o poder desejado.
                          </TooltipContent>
                        </UITooltip>
                      </TooltipProvider>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                {/* Parameters - GPower Style: Label | Input side by side */}
                <div className="space-y-1.5">
                  {!['chi-square-2x2', 'chi-square-independence', 'goodness-of-fit', 'mcnemar', 'cochran-q', 'fisher-exact'].includes(selectedTest) && (
                    <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                      <div className="flex items-center gap-1">
                        <Label htmlFor="tails" className="text-sm">Cauda(s)</Label>
                        <TooltipProvider>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Uma cauda: teste direcional (hipótese especifica direção do efeito). Duas caudas: teste bidirecional (hipótese não especifica direção).
                            </TooltipContent>
                          </UITooltip>
                        </TooltipProvider>
                      </div>
                      <Select value={tails} onValueChange={(v) => setTails(v as Tails)}>
                        <SelectTrigger id="tails" data-testid="select-tails" className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="two">Duas</SelectItem>
                          <SelectItem value="one">Uma</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {calculationMode === 'calculate-n' && (
                    <>
                      {selectedTest === 'compare-correlations-independent' || selectedTest === 'compare-correlations-dependent' ? (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="r1" className="text-sm">r₁ (r_xy)</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    {selectedTest === 'compare-correlations-dependent' 
                                      ? 'Correlação entre X e Y (entre -1 e 1).'
                                      : 'Primeira correlação esperada (entre -1 e 1).'}
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="r1"
                              type="text"
                              placeholder="0.5"
                              value={r1}
                              onChange={(e) => setR1(e.target.value)}
                              data-testid="input-r1"
                              className="h-8"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="r2" className="text-sm">r₂ (r_xz)</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    {selectedTest === 'compare-correlations-dependent' 
                                      ? 'Correlação entre X e Z (entre -1 e 1).'
                                      : 'Segunda correlação esperada (entre -1 e 1).'}
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="r2"
                              type="text"
                              placeholder="0.2"
                              value={r2}
                              onChange={(e) => setR2(e.target.value)}
                              data-testid="input-r2"
                              className="h-8"
                            />
                          </div>
                          {selectedTest === 'compare-correlations-dependent' && (
                            <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                              <div className="flex items-center gap-1">
                                <Label htmlFor="r3" className="text-sm">r₃ (r_yz)</Label>
                                <TooltipProvider>
                                  <UITooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs text-xs">
                                      Correlação entre Y e Z (entre -1 e 1). Esta é a correlação entre as duas variáveis que não são compartilhadas. Padrão: 0 (não correlacionadas).
                                    </TooltipContent>
                                  </UITooltip>
                                </TooltipProvider>
                              </div>
                              <Input
                                id="r3"
                                type="text"
                                placeholder="0"
                                value={r3}
                                onChange={(e) => setR3(e.target.value)}
                                data-testid="input-r3"
                                className="h-8"
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        calculationMode !== 'have-n-effect' && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="effect-size" className="text-sm">{getEffectSizeLabel()}</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  {getEffectSizeTooltip()}
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="effect-size"
                            type="text"
                            value={effectSize}
                            onChange={(e) => setEffectSize(e.target.value)}
                            data-testid="input-effect-size"
                            className="h-8"
                          />
                        </div>
                        )
                      )}

                      {(selectedTest === 'kruskal-wallis' || selectedTest === 'friedman' || selectedTest === 'anova-oneway') && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="k" className="text-sm">Número de grupos (k)</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Número de grupos ou condições a serem comparados (mínimo 3 para Kruskal-Wallis/Friedman, mínimo 2 para ANOVA).
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="k"
                            type="number"
                            placeholder="3"
                            value={k}
                            onChange={(e) => setK(e.target.value)}
                            data-testid="input-k"
                            className="h-8"
                            min={selectedTest === 'anova-oneway' ? "2" : "3"}
                          />
                        </div>
                      )}

                      {(selectedTest === 'regression-multiple-total' || selectedTest === 'regression-multiple-increment') && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="numPredictors" className="text-sm">Número de preditores</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  {selectedTest === 'regression-multiple-increment'
                                    ? 'Número total de preditores no modelo completo (incluindo os testados). Os graus de liberdade do denominador serão n − preditores − 1.'
                                    : 'Número de preditores do modelo. Os graus de liberdade do numerador serão iguais a este valor; os do denominador, n − preditores − 1.'}
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="numPredictors"
                            type="number"
                            placeholder="3"
                            value={numPredictors}
                            onChange={(e) => setNumPredictors(e.target.value)}
                            data-testid="input-num-predictors"
                            className="h-8"
                            min="1"
                          />
                        </div>
                      )}

                      {selectedTest === 'regression-multiple-increment' && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="numTestedPredictors" className="text-sm">Preditores testados</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Número de preditores do bloco que está sendo testado (o incremento). Define os graus de liberdade do numerador.
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="numTestedPredictors"
                            type="number"
                            placeholder="1"
                            value={numTestedPredictors}
                            onChange={(e) => setNumTestedPredictors(e.target.value)}
                            data-testid="input-num-tested-predictors"
                            className="h-8"
                            min="1"
                          />
                        </div>
                      )}

                      {(selectedTest === 'logistic-regression' || selectedTest === 'multiple-logistic-regression') && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="baseProportion" className="text-sm">Prob. do evento (P)</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Probabilidade de ocorrência do evento na média do preditor (entre 0 e 1). Por exemplo, 0,5 quando metade dos casos apresenta o desfecho.
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="baseProportion"
                            type="text"
                            placeholder="0,5"
                            value={baseProportion}
                            onChange={(e) => setBaseProportion(e.target.value)}
                            data-testid="input-base-proportion"
                            className="h-8"
                          />
                        </div>
                      )}
                      {(selectedTest === 'multiple-logistic-regression' || selectedTest === 'poisson-regression') && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="r2OtherPredictors" className="text-sm">R² dos demais preditores</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Proporção da variância do preditor de interesse explicada pelas demais covariáveis (R² da regressão desse preditor sobre as outras). Entre 0 e 1. Quanto maior, maior o n necessário (fator 1/(1−R²)). Use 0 quando o preditor é independente das demais variáveis.
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="r2OtherPredictors"
                            type="text"
                            placeholder="0,1"
                            value={r2OtherPredictors}
                            onChange={(e) => setR2OtherPredictors(e.target.value)}
                            data-testid="input-r2-other-predictors"
                            className="h-8"
                          />
                        </div>
                      )}

                      {selectedTest === 'poisson-regression' && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="baseRate" className="text-sm">Taxa basal de eventos</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Contagem média de eventos sob a hipótese nula, na média do preditor, considerando o tempo de exposição/seguimento. Deve ser positiva.
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="baseRate"
                            type="text"
                            placeholder="1"
                            value={baseRate}
                            onChange={(e) => setBaseRate(e.target.value)}
                            data-testid="input-base-rate"
                            className="h-8"
                          />
                        </div>
                      )}

                      {(selectedTest === 'cochran-q' || selectedTest === 'goodness-of-fit') && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="chiK" className="text-sm">
                              {selectedTest === 'cochran-q' ? 'Número de condições (k)' : 'Número de categorias (k)'}
                            </Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  {selectedTest === 'cochran-q'
                                    ? 'Número de condições/medidas pareadas avaliadas nos mesmos sujeitos (mínimo 3). Os graus de liberdade serão k − 1.'
                                    : 'Número de categorias mutuamente exclusivas comparadas com a distribuição esperada (mínimo 2). Os graus de liberdade serão k − 1.'}
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="chiK"
                            type="number"
                            placeholder={selectedTest === 'cochran-q' ? '3' : '4'}
                            value={numLevelsA}
                            onChange={(e) => setNumLevelsA(e.target.value)}
                            onBlur={handleChiKBlur}
                            data-testid="input-chi-k"
                            className="h-8"
                            min={selectedTest === 'cochran-q' ? '3' : '2'}
                          />
                        </div>
                      )}

                      {selectedTest === 'chi-square-independence' && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numRows" className="text-sm">Número de linhas (r)</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de categorias da variável-linha na tabela de contingência (mínimo 2).
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numRows"
                              type="number"
                              placeholder="3"
                              value={numRows}
                              onChange={(e) => setNumRows(e.target.value)}
                              data-testid="input-num-rows"
                              className="h-8"
                              min="2"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numCols" className="text-sm">Número de colunas (c)</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de categorias da variável-coluna (mínimo 2). Os graus de liberdade serão (r − 1)(c − 1).
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numCols"
                              type="number"
                              placeholder="3"
                              value={numCols}
                              onChange={(e) => setNumCols(e.target.value)}
                              data-testid="input-num-cols"
                              className="h-8"
                              min="2"
                            />
                          </div>
                        </>
                      )}

                      {selectedTest === 'anova-factorial' && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numGroups" className="text-sm">Número de grupos</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número total de grupos (células) do delineamento fatorial. Usado para calcular os graus de liberdade do denominador (gl₂ = N − número de grupos). Equivale ao campo "Number of groups" do G*Power.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numGroups"
                              type="number"
                              placeholder="4"
                              value={numGroups}
                              onChange={(e) => setNumGroups(e.target.value)}
                              data-testid="input-num-groups"
                              className="h-8"
                              min="2"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numeratorDf" className="text-sm">gl do numerador</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Graus de liberdade do numerador (gl₁) do efeito a ser testado. Para um efeito principal com a níveis, gl₁ = a − 1; para a interação A×B, gl₁ = (a − 1)(b − 1). Equivale ao campo "Numerator df" do G*Power.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numeratorDf"
                              type="number"
                              placeholder="1"
                              value={numeratorDf}
                              onChange={(e) => setNumeratorDf(e.target.value)}
                              data-testid="input-numerator-df"
                              className="h-8"
                              min="1"
                            />
                          </div>
                        </>
                      )}

                      {/* MANOVA inputs - calculate-n mode */}
                      {(selectedTest === 'manova' || selectedTest === 'manova-factorial') && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numResponseVars" className="text-sm">Variáveis-resposta (p)</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de variáveis dependentes (desfechos) analisadas em conjunto. Mínimo 2.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input id="numResponseVars" type="number" placeholder="2" value={numResponseVars} onChange={(e) => setNumResponseVars(e.target.value)} data-testid="input-num-response-vars" className="h-8" min="2" />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="manovaK" className="text-sm">Número de grupos</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de grupos (ou células do delineamento). Define os graus de liberdade do erro (N − grupos). Mínimo 2.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input id="manovaK" type="number" placeholder="3" value={k} onChange={(e) => setK(e.target.value)} data-testid="input-manova-k" className="h-8" min="2" />
                          </div>
                        </>
                      )}
                      {selectedTest === 'manova-factorial' && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="manovaNumPredictors" className="text-sm">Número de preditores</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Graus de liberdade da hipótese do efeito testado (nº de preditores do efeito). Não pode exceder (grupos − 1).
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input id="manovaNumPredictors" type="number" placeholder="2" value={numPredictors} onChange={(e) => setNumPredictors(e.target.value)} data-testid="input-manova-num-predictors" className="h-8" min="1" />
                        </div>
                      )}
                      {selectedTest === 'manova-repeated' && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="manovaNumMeasurements" className="text-sm">Nº de Medições</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de medições repetidas (pontos no tempo) por sujeito. Mínimo 2.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input id="manovaNumMeasurements" type="number" placeholder="3" value={numMeasurements} onChange={(e) => setNumMeasurements(e.target.value)} data-testid="input-manova-num-measurements" className="h-8" min="2" />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="manovaNumGroups" className="text-sm">Nº de Grupos</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de grupos entre-sujeitos. Use 1 para um único grupo.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input id="manovaNumGroups" type="number" placeholder="1" value={numGroups} onChange={(e) => setNumGroups(e.target.value)} data-testid="input-manova-num-groups" className="h-8" min="1" />
                          </div>
                        </>
                      )}

                      {/* ANOVA Repeated Measures inputs - calculate-n mode */}
                      {selectedTest === 'anova-repeated' && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numMeasurements" className="text-sm">Nº de Medições</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de medições repetidas (pontos no tempo). Mínimo 2.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numMeasurements"
                              type="number"
                              placeholder="3"
                              value={numMeasurements}
                              onChange={(e) => setNumMeasurements(e.target.value)}
                              data-testid="input-num-measurements"
                              className="h-8"
                              min="2"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="correlationBetweenMeasures" className="text-sm">Corr. entre Medidas</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Correlação esperada entre as medições repetidas (0 a 1). Valores típicos: 0.3-0.7.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="correlationBetweenMeasures"
                              type="text"
                              placeholder="0.5"
                              value={correlationBetweenMeasures}
                              onChange={(e) => setCorrelationBetweenMeasures(e.target.value)}
                              data-testid="input-correlation-between-measures"
                              className="h-8"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="sphericityCorrection" className="text-sm">Correção Esfericidade</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Epsilon (ε) para correção de esfericidade (Greenhouse-Geisser ou Huynh-Feldt). Use 1 se assumir esfericidade.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="sphericityCorrection"
                              type="text"
                              placeholder="1"
                              value={sphericityCorrection}
                              onChange={(e) => setSphericityCorrection(e.target.value)}
                              data-testid="input-sphericity-correction"
                              className="h-8"
                            />
                          </div>
                        </>
                      )}

                      {/* ANOVA Mixed (Between × Within) inputs - calculate-n mode */}
                      {selectedTest === 'anova-mixed' && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numGroups" className="text-sm">Nº de Grupos</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de grupos entre-sujeitos (ex: tratamento vs controle). Mínimo 2.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numGroups"
                              type="number"
                              placeholder="2"
                              value={numGroups}
                              onChange={(e) => setNumGroups(e.target.value)}
                              data-testid="input-num-groups"
                              className="h-8"
                              min="2"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numMeasurementsMixed" className="text-sm">Nº de Medições</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de medições repetidas (pontos no tempo). Mínimo 2.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numMeasurementsMixed"
                              type="number"
                              placeholder="3"
                              value={numMeasurements}
                              onChange={(e) => setNumMeasurements(e.target.value)}
                              data-testid="input-num-measurements-mixed"
                              className="h-8"
                              min="2"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="correlationBetweenMeasuresMixed" className="text-sm">Corr. entre Medidas</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Correlação esperada entre as medições repetidas (0 a 1). Valores típicos: 0.3-0.7.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="correlationBetweenMeasuresMixed"
                              type="text"
                              placeholder="0.5"
                              value={correlationBetweenMeasures}
                              onChange={(e) => setCorrelationBetweenMeasures(e.target.value)}
                              data-testid="input-correlation-between-measures-mixed"
                              className="h-8"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="sphericityCorrectionMixed" className="text-sm">Correção Esfericidade</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Epsilon (ε) para correção de esfericidade. Use 1 se assumir esfericidade.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="sphericityCorrectionMixed"
                              type="text"
                              placeholder="1"
                              value={sphericityCorrection}
                              onChange={(e) => setSphericityCorrection(e.target.value)}
                              data-testid="input-sphericity-correction-mixed"
                              className="h-8"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="effectTypeMixed" className="text-sm">Tipo de Efeito</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Efeito between (entre grupos), within (intra-sujeitos), ou a interação Grupo × Tempo.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Select value={effectType} onValueChange={(val) => setEffectType(val as 'between' | 'within' | 'within_between')}>
                              <SelectTrigger id="effectTypeMixed" className="h-8" data-testid="select-effect-type-mixed">
                                <SelectValue placeholder="Selecione o efeito" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="between">Efeito Between (Grupo)</SelectItem>
                                <SelectItem value="within">Efeito Within (Tempo)</SelectItem>
                                <SelectItem value="within_between">Interação Grupo × Tempo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label htmlFor="alpha" className="text-sm">α err prob</Label>
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs text-xs">
                                Probabilidade de erro Tipo I (rejeitar a hipótese nula quando ela é verdadeira). Padrão: 0.05.
                              </TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        </div>
                        <Input
                          id="alpha"
                          type="text"
                          placeholder="0.05"
                          value={alpha}
                          onChange={(e) => setAlpha(e.target.value)}
                          data-testid="input-alpha"
                          className="h-8"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label htmlFor="power" className="text-sm">Poder</Label>
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs text-xs">
                                Probabilidade de detectar efeito quando ele existe. Padrão: 0.80.
                              </TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        </div>
                        <Input
                          id="power"
                          type="text"
                          placeholder="0.95"
                          value={power}
                          onChange={(e) => setPower(e.target.value)}
                          data-testid="input-power"
                          className="h-8"
                        />
                      </div>

                      {(selectedTest === 'independent-t' || selectedTest === 'mann-whitney') && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="allocation-ratio" className="text-sm">Razão n₁/n₂</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Razão entre o tamanho amostral dos grupos. Deixe 1 para tamanhos equivalentes.
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="allocation-ratio"
                            type="text"
                            placeholder="1"
                            value={n1}
                            onChange={(e) => setN1(e.target.value)}
                            data-testid="input-allocation-ratio"
                            className="h-8"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {(calculationMode === 'have-n-power' || calculationMode === 'have-n-effect') && (
                    <>
                      {selectedTest === 'compare-correlations-independent' || selectedTest === 'compare-correlations-dependent' ? (
                        <>
                          {calculationMode !== 'have-n-effect' && (
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="r1" className="text-sm">r₁ (r_xy)</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    {selectedTest === 'compare-correlations-dependent' 
                                      ? 'Correlação entre X e Y (entre -1 e 1).'
                                      : 'Primeira correlação esperada (entre -1 e 1).'}
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="r1"
                              type="text"
                              placeholder="0.5"
                              value={r1}
                              onChange={(e) => setR1(e.target.value)}
                              data-testid="input-r1"
                              className="h-8"
                            />
                          </div>
                          )}
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="r2" className="text-sm">r₂ (r_xz)</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    {selectedTest === 'compare-correlations-dependent' 
                                      ? 'Correlação entre X e Z (entre -1 e 1).'
                                      : 'Segunda correlação esperada (entre -1 e 1).'}
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="r2"
                              type="text"
                              placeholder="0.2"
                              value={r2}
                              onChange={(e) => setR2(e.target.value)}
                              data-testid="input-r2"
                              className="h-8"
                            />
                          </div>
                          {selectedTest === 'compare-correlations-dependent' && (
                            <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                              <div className="flex items-center gap-1">
                                <Label htmlFor="r3" className="text-sm">r₃ (r_yz)</Label>
                                <TooltipProvider>
                                  <UITooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs text-xs">
                                      Correlação entre Y e Z (entre -1 e 1). Esta é a correlação entre as duas variáveis que não são compartilhadas. Padrão: 0 (não correlacionadas).
                                    </TooltipContent>
                                  </UITooltip>
                                </TooltipProvider>
                              </div>
                              <Input
                                id="r3"
                                type="text"
                                placeholder="0"
                                value={r3}
                                onChange={(e) => setR3(e.target.value)}
                                data-testid="input-r3"
                                className="h-8"
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        calculationMode !== 'have-n-effect' && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="effect-size" className="text-sm">{getEffectSizeLabel()}</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  {getEffectSizeTooltip()}
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="effect-size"
                            type="text"
                            value={effectSize}
                            onChange={(e) => setEffectSize(e.target.value)}
                            data-testid="input-effect-size"
                            className="h-8"
                          />
                        </div>
                        )
                      )}

                      {(selectedTest === 'kruskal-wallis' || selectedTest === 'friedman' || selectedTest === 'anova-oneway') && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="k" className="text-sm">Número de grupos (k)</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Número de grupos ou condições a serem comparados (mínimo 3 para Kruskal-Wallis/Friedman, mínimo 2 para ANOVA).
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="k"
                            type="number"
                            placeholder="3"
                            value={k}
                            onChange={(e) => setK(e.target.value)}
                            data-testid="input-k"
                            className="h-8"
                            min={selectedTest === 'anova-oneway' ? "2" : "3"}
                          />
                        </div>
                      )}

                      {(selectedTest === 'regression-multiple-total' || selectedTest === 'regression-multiple-increment') && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="numPredictors" className="text-sm">Número de preditores</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  {selectedTest === 'regression-multiple-increment'
                                    ? 'Número total de preditores no modelo completo (incluindo os testados). Os graus de liberdade do denominador serão n − preditores − 1.'
                                    : 'Número de preditores do modelo. Os graus de liberdade do numerador serão iguais a este valor; os do denominador, n − preditores − 1.'}
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="numPredictors"
                            type="number"
                            placeholder="3"
                            value={numPredictors}
                            onChange={(e) => setNumPredictors(e.target.value)}
                            data-testid="input-num-predictors"
                            className="h-8"
                            min="1"
                          />
                        </div>
                      )}

                      {selectedTest === 'regression-multiple-increment' && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="numTestedPredictors" className="text-sm">Preditores testados</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Número de preditores do bloco que está sendo testado (o incremento). Define os graus de liberdade do numerador.
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="numTestedPredictors"
                            type="number"
                            placeholder="1"
                            value={numTestedPredictors}
                            onChange={(e) => setNumTestedPredictors(e.target.value)}
                            data-testid="input-num-tested-predictors"
                            className="h-8"
                            min="1"
                          />
                        </div>
                      )}

                      {(selectedTest === 'logistic-regression' || selectedTest === 'multiple-logistic-regression') && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="baseProportion" className="text-sm">Prob. do evento (P)</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Probabilidade de ocorrência do evento na média do preditor (entre 0 e 1). Por exemplo, 0,5 quando metade dos casos apresenta o desfecho.
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="baseProportion"
                            type="text"
                            placeholder="0,5"
                            value={baseProportion}
                            onChange={(e) => setBaseProportion(e.target.value)}
                            data-testid="input-base-proportion"
                            className="h-8"
                          />
                        </div>
                      )}
                      {(selectedTest === 'multiple-logistic-regression' || selectedTest === 'poisson-regression') && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="r2OtherPredictors" className="text-sm">R² dos demais preditores</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Proporção da variância do preditor de interesse explicada pelas demais covariáveis (R² da regressão desse preditor sobre as outras). Entre 0 e 1. Quanto maior, maior o n necessário (fator 1/(1−R²)). Use 0 quando o preditor é independente das demais variáveis.
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="r2OtherPredictors"
                            type="text"
                            placeholder="0,1"
                            value={r2OtherPredictors}
                            onChange={(e) => setR2OtherPredictors(e.target.value)}
                            data-testid="input-r2-other-predictors"
                            className="h-8"
                          />
                        </div>
                      )}

                      {selectedTest === 'poisson-regression' && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="baseRate" className="text-sm">Taxa basal de eventos</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Contagem média de eventos sob a hipótese nula, na média do preditor, considerando o tempo de exposição/seguimento. Deve ser positiva.
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="baseRate"
                            type="text"
                            placeholder="1"
                            value={baseRate}
                            onChange={(e) => setBaseRate(e.target.value)}
                            data-testid="input-base-rate"
                            className="h-8"
                          />
                        </div>
                      )}

                      {(selectedTest === 'cochran-q' || selectedTest === 'goodness-of-fit') && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="chiK" className="text-sm">
                              {selectedTest === 'cochran-q' ? 'Número de condições (k)' : 'Número de categorias (k)'}
                            </Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  {selectedTest === 'cochran-q'
                                    ? 'Número de condições/medidas pareadas avaliadas nos mesmos sujeitos (mínimo 3). Os graus de liberdade serão k − 1.'
                                    : 'Número de categorias mutuamente exclusivas comparadas com a distribuição esperada (mínimo 2). Os graus de liberdade serão k − 1.'}
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="chiK"
                            type="number"
                            placeholder={selectedTest === 'cochran-q' ? '3' : '4'}
                            value={numLevelsA}
                            onChange={(e) => setNumLevelsA(e.target.value)}
                            onBlur={handleChiKBlur}
                            data-testid="input-chi-k"
                            className="h-8"
                            min={selectedTest === 'cochran-q' ? '3' : '2'}
                          />
                        </div>
                      )}

                      {selectedTest === 'chi-square-independence' && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numRows" className="text-sm">Número de linhas (r)</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de categorias da variável-linha na tabela de contingência (mínimo 2).
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numRows"
                              type="number"
                              placeholder="3"
                              value={numRows}
                              onChange={(e) => setNumRows(e.target.value)}
                              data-testid="input-num-rows"
                              className="h-8"
                              min="2"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numCols" className="text-sm">Número de colunas (c)</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de categorias da variável-coluna (mínimo 2). Os graus de liberdade serão (r − 1)(c − 1).
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numCols"
                              type="number"
                              placeholder="3"
                              value={numCols}
                              onChange={(e) => setNumCols(e.target.value)}
                              data-testid="input-num-cols"
                              className="h-8"
                              min="2"
                            />
                          </div>
                        </>
                      )}

                      {selectedTest === 'anova-factorial' && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numGroups" className="text-sm">Número de grupos</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número total de grupos (células) do delineamento fatorial. Usado para calcular os graus de liberdade do denominador (gl₂ = N − número de grupos). Equivale ao campo "Number of groups" do G*Power.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numGroups"
                              type="number"
                              placeholder="4"
                              value={numGroups}
                              onChange={(e) => setNumGroups(e.target.value)}
                              data-testid="input-num-groups"
                              className="h-8"
                              min="2"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numeratorDf" className="text-sm">gl do numerador</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Graus de liberdade do numerador (gl₁) do efeito a ser testado. Para um efeito principal com a níveis, gl₁ = a − 1; para a interação A×B, gl₁ = (a − 1)(b − 1). Equivale ao campo "Numerator df" do G*Power.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numeratorDf"
                              type="number"
                              placeholder="1"
                              value={numeratorDf}
                              onChange={(e) => setNumeratorDf(e.target.value)}
                              data-testid="input-numerator-df"
                              className="h-8"
                              min="1"
                            />
                          </div>
                        </>
                      )}

                      {/* MANOVA inputs - have-n-power mode */}
                      {(selectedTest === 'manova' || selectedTest === 'manova-factorial') && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numResponseVars" className="text-sm">Variáveis-resposta (p)</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de variáveis dependentes (desfechos) analisadas em conjunto. Mínimo 2.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input id="numResponseVars" type="number" placeholder="2" value={numResponseVars} onChange={(e) => setNumResponseVars(e.target.value)} data-testid="input-num-response-vars" className="h-8" min="2" />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="manovaK" className="text-sm">Número de grupos</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de grupos (ou células do delineamento). Define os graus de liberdade do erro (N − grupos). Mínimo 2.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input id="manovaK" type="number" placeholder="3" value={k} onChange={(e) => setK(e.target.value)} data-testid="input-manova-k" className="h-8" min="2" />
                          </div>
                        </>
                      )}
                      {selectedTest === 'manova-factorial' && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="manovaNumPredictors" className="text-sm">Número de preditores</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Graus de liberdade da hipótese do efeito testado (nº de preditores do efeito). Não pode exceder (grupos − 1).
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input id="manovaNumPredictors" type="number" placeholder="2" value={numPredictors} onChange={(e) => setNumPredictors(e.target.value)} data-testid="input-manova-num-predictors" className="h-8" min="1" />
                        </div>
                      )}
                      {selectedTest === 'manova-repeated' && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="manovaNumMeasurements" className="text-sm">Nº de Medições</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de medições repetidas (pontos no tempo) por sujeito. Mínimo 2.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input id="manovaNumMeasurements" type="number" placeholder="3" value={numMeasurements} onChange={(e) => setNumMeasurements(e.target.value)} data-testid="input-manova-num-measurements" className="h-8" min="2" />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="manovaNumGroups" className="text-sm">Nº de Grupos</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de grupos entre-sujeitos. Use 1 para um único grupo.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input id="manovaNumGroups" type="number" placeholder="1" value={numGroups} onChange={(e) => setNumGroups(e.target.value)} data-testid="input-manova-num-groups" className="h-8" min="1" />
                          </div>
                        </>
                      )}

                      {/* ANOVA Repeated Measures inputs */}
                      {selectedTest === 'anova-repeated' && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numMeasurements" className="text-sm">Nº de Medições</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de medições repetidas (pontos no tempo). Mínimo 2.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numMeasurements"
                              type="number"
                              placeholder="3"
                              value={numMeasurements}
                              onChange={(e) => setNumMeasurements(e.target.value)}
                              data-testid="input-num-measurements"
                              className="h-8"
                              min="2"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="correlationBetweenMeasures" className="text-sm">Corr. entre Medidas</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Correlação esperada entre as medições repetidas (0 a 1). Valores típicos: 0.3-0.7.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="correlationBetweenMeasures"
                              type="text"
                              placeholder="0.5"
                              value={correlationBetweenMeasures}
                              onChange={(e) => setCorrelationBetweenMeasures(e.target.value)}
                              data-testid="input-correlation-between-measures"
                              className="h-8"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="sphericityCorrection" className="text-sm">Correção Esfericidade</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Epsilon (ε) para correção de esfericidade (Greenhouse-Geisser ou Huynh-Feldt). Use 1 se assumir esfericidade.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="sphericityCorrection"
                              type="text"
                              placeholder="1"
                              value={sphericityCorrection}
                              onChange={(e) => setSphericityCorrection(e.target.value)}
                              data-testid="input-sphericity-correction"
                              className="h-8"
                            />
                          </div>
                        </>
                      )}

                      {/* ANOVA Mixed (Between × Within) inputs */}
                      {selectedTest === 'anova-mixed' && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numGroups" className="text-sm">Nº de Grupos</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de grupos entre-sujeitos (ex: tratamento vs controle). Mínimo 2.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numGroups"
                              type="number"
                              placeholder="2"
                              value={numGroups}
                              onChange={(e) => setNumGroups(e.target.value)}
                              data-testid="input-num-groups"
                              className="h-8"
                              min="2"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="numMeasurementsMixed" className="text-sm">Nº de Medições</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de medições repetidas (pontos no tempo). Mínimo 2.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="numMeasurementsMixed"
                              type="number"
                              placeholder="3"
                              value={numMeasurements}
                              onChange={(e) => setNumMeasurements(e.target.value)}
                              data-testid="input-num-measurements-mixed"
                              className="h-8"
                              min="2"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="correlationBetweenMeasuresMixed" className="text-sm">Corr. entre Medidas</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Correlação esperada entre as medições repetidas (0 a 1). Valores típicos: 0.3-0.7.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="correlationBetweenMeasuresMixed"
                              type="text"
                              placeholder="0.5"
                              value={correlationBetweenMeasures}
                              onChange={(e) => setCorrelationBetweenMeasures(e.target.value)}
                              data-testid="input-correlation-between-measures-mixed"
                              className="h-8"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="sphericityCorrectionMixed" className="text-sm">Correção Esfericidade</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Epsilon (ε) para correção de esfericidade. Use 1 se assumir esfericidade.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="sphericityCorrectionMixed"
                              type="text"
                              placeholder="1"
                              value={sphericityCorrection}
                              onChange={(e) => setSphericityCorrection(e.target.value)}
                              data-testid="input-sphericity-correction-mixed"
                              className="h-8"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="effectTypeMixed" className="text-sm">Tipo de Efeito</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Efeito between (entre grupos), within (intra-sujeitos), ou a interação Grupo × Tempo.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Select value={effectType} onValueChange={(val) => setEffectType(val as 'between' | 'within' | 'within_between')}>
                              <SelectTrigger id="effectTypeMixed" className="h-8" data-testid="select-effect-type-mixed">
                                <SelectValue placeholder="Selecione o efeito" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="between">Efeito Between (Grupo)</SelectItem>
                                <SelectItem value="within">Efeito Within (Tempo)</SelectItem>
                                <SelectItem value="within_between">Interação Grupo × Tempo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label htmlFor="alpha" className="text-sm">α err prob</Label>
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs text-xs">
                                Probabilidade de erro Tipo I (rejeitar a hipótese nula quando ela é verdadeira). Padrão: 0.05.
                              </TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        </div>
                        <Input
                          id="alpha"
                          type="text"
                          placeholder="0.05"
                          value={alpha}
                          onChange={(e) => setAlpha(e.target.value)}
                          data-testid="input-alpha"
                          className="h-8"
                        />
                      </div>

                      {calculationMode === 'have-n-effect' && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="power" className="text-sm">Poder</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Probabilidade de detectar efeito quando ele existe. Padrão: 0.80.
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="power"
                            type="text"
                            placeholder="0.80"
                            value={power}
                            onChange={(e) => setPower(e.target.value)}
                            data-testid="input-power"
                            className="h-8"
                          />
                        </div>
                      )}

                      {selectedTest !== 'independent-t' && selectedTest !== 'compare-correlations-independent' && selectedTest !== 'mann-whitney' && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="n" className="text-sm">Tamanho amostral</Label>
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Número de participantes na amostra.
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="n"
                            type="number"
                            placeholder="30"
                            value={n}
                            onChange={(e) => setN(e.target.value)}
                            data-testid="input-n"
                            className="h-8"
                          />
                        </div>
                      )}

                      {(selectedTest === 'independent-t' || selectedTest === 'mann-whitney') && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="n1" className="text-sm">Tamanho grupo 1</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de participantes no primeiro grupo.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="n1"
                              type="number"
                              placeholder="25"
                              value={n1}
                              onChange={(e) => setN1(e.target.value)}
                              data-testid="input-n1"
                              className="h-8"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="n2" className="text-sm">Tamanho grupo 2</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Número de participantes no segundo grupo.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="n2"
                              type="number"
                              placeholder="30"
                              value={n2}
                              onChange={(e) => setN2(e.target.value)}
                              data-testid="input-n2"
                              className="h-8"
                            />
                          </div>
                        </>
                      )}

                      {selectedTest === 'compare-correlations-independent' && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="n1" className="text-sm">Tamanho amostra 1</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Tamanho da primeira amostra.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="n1"
                              type="number"
                              placeholder="30"
                              value={n1}
                              onChange={(e) => setN1(e.target.value)}
                              data-testid="input-n1"
                              className="h-8"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label htmlFor="n2" className="text-sm">Tamanho amostra 2</Label>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                    Tamanho da segunda amostra.
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </div>
                            <Input
                              id="n2"
                              type="number"
                              placeholder="30"
                              value={n2}
                              onChange={(e) => setN2(e.target.value)}
                              data-testid="input-n2"
                              className="h-8"
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                {(selectedTest === 'logistic-regression' || selectedTest === 'multiple-logistic-regression' || selectedTest === 'poisson-regression') && (
                  <div className="pt-1">
                    {renderXDistributionSection()}
                  </div>
                )}

                {/* Hints - Dynamic based on selected test */}
                <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                  <p>• {getEffectSizeFamily().tooltipName}: pequeno={getEffectSizeFamily().small}, médio={getEffectSizeFamily().medium}, grande={getEffectSizeFamily().large}</p>
                  <p>• Aceita vírgula ou ponto: 0,05 ou 0.05</p>
                  <p>• Notação curta: .8 = 0.80</p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleCalculate}
                    disabled={calculateMutation.isPending || !currentTestDef?.implemented}
                    className="flex-1"
                    size="sm"
                    data-testid="button-calculate"
                  >
                    <Calculator className="w-4 h-4 mr-2" />
                    {calculateMutation.isPending ? 'Calculando...' : 'Calcular'}
                  </Button>
                  <Button
                    onClick={resetForm}
                    variant="outline"
                    size="sm"
                    data-testid="button-reset"
                  >
                    Limpar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: RESULTS - GPower Style Compact */}
          <div className="md:overflow-y-auto pb-4 md:pb-0">
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resultados</CardTitle>
              </CardHeader>
              <CardContent className="md:max-h-[calc(100vh-200px)] md:overflow-y-auto">
                {showLimitCard && powerLimitInfo ? (
                  <ToolLimitReachedCard
                    used={powerLimitInfo.used}
                    limit={powerLimitInfo.limit ?? 0}
                    toolLabel="cálculos de poder"
                  />
                ) : result ? (
                  <div className="space-y-3">
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {curveData.length > 0 && (
                        <Button
                          onClick={() => setShowCurve(!showCurve)}
                          variant="outline"
                          size="sm"
                          data-testid="button-toggle-curve"
                        >
                          <LineChart className="w-3 h-3 mr-1" />
                          {showCurve ? 'Ocultar' : 'Curva'}
                        </Button>
                      )}
                      <Button
                        onClick={handleDownloadTXT}
                        variant="outline"
                        size="sm"
                        data-testid="button-download-txt"
                      >
                        <FileDown className="w-3 h-3 mr-1" />
                        TXT
                      </Button>
                      <Button
                        onClick={handleSave}
                        variant="outline"
                        size="sm"
                        disabled={saveMutation.isPending}
                        data-testid="button-save-result"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Salvar
                      </Button>
                    </div>

                    <Separator />

                    {/* Results - GPower Style: Label | Value side by side */}
                    <div className="space-y-1.5">
                      {result.minDetectableEffect !== undefined && (
                        <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                          <span className="text-sm text-muted-foreground">Efeito mínimo detectável ({getEffectSizeFamily().symbol})</span>
                          <span className="text-lg font-bold" data-testid="result-min-detectable-effect">
                            {result.minDetectableEffect.toFixed(4)}
                          </span>
                        </div>
                      )}
                      {result.power !== undefined && (
                        <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                          <span className="text-sm text-muted-foreground">Poder</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={result.minDetectableEffect !== undefined ? "text-sm font-semibold" : "text-lg font-bold"}
                              data-testid="result-power"
                            >
                              {result.power.toFixed(6)}
                            </span>
                          </div>
                        </div>
                      )}
                      {result.requiredN !== undefined && (
                        <>
                          {/* For ANOVA tests, show total sample size */}
                          {(result.testType === 'anova-oneway' || result.testType === 'kruskal-wallis') && result.k ? (
                            <>
                              <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                                <span className="text-sm text-muted-foreground">Tamanho amostral total</span>
                                <span className="text-lg font-bold" data-testid="result-total-n">
                                  {result.totalN ?? result.requiredN * result.k}
                                </span>
                              </div>
                              <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                                <span className="text-sm text-muted-foreground">Tamanho por grupo</span>
                                <span className="text-sm font-semibold" data-testid="result-required-n">
                                  {result.requiredN}
                                </span>
                              </div>
                            </>
                          ) : result.testType === 'anova-factorial' && result.numGroups ? (
                            <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                              <span className="text-sm text-muted-foreground">Tamanho amostral total</span>
                              <span className="text-lg font-bold" data-testid="result-total-n">
                                {result.requiredN}
                              </span>
                            </div>
                          ) : result.testType === 'anova-mixed' && result.nPerGroup && result.numGroups ? (
                            <>
                              <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                                <span className="text-sm text-muted-foreground">Tamanho amostral total</span>
                                <span className="text-lg font-bold" data-testid="result-total-n">
                                  {result.requiredN}
                                </span>
                              </div>
                              <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                                <span className="text-sm text-muted-foreground">Tamanho por grupo</span>
                                <span className="text-sm font-semibold" data-testid="result-n-per-group">
                                  {result.nPerGroup}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                              <span className="text-sm text-muted-foreground">{result.testType === 'wilcoxon-paired' || result.testType === 'paired-t-test' ? 'Número de pares necessário' : result.testType === 'friedman' ? 'Participantes necessários' : 'Tamanho amostral necessário'}</span>
                              <span className="text-lg font-bold" data-testid="result-required-n">
                                {result.requiredN}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      {result.requiredN1 !== undefined && (
                        <>
                          <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                            <span className="text-sm text-muted-foreground">Tamanho grupo 1</span>
                            <span className="text-lg font-bold" data-testid="result-required-n1">
                              {result.requiredN1}
                            </span>
                          </div>
                          <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                            <span className="text-sm text-muted-foreground">Tamanho grupo 2</span>
                            <span className="text-lg font-bold" data-testid="result-required-n2">
                              {result.requiredN2}
                            </span>
                          </div>
                          {result.requiredN2 !== undefined && (
                            <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                              <span className="text-sm text-muted-foreground">Tamanho amostral total</span>
                              <span className="text-sm font-semibold" data-testid="result-total-n-groups">
                                {result.requiredN1 + result.requiredN2}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      {result.df !== 0 && (
                        <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                          <span className="text-sm text-muted-foreground">
                            {result.df2 !== undefined ? 'Graus de liberdade (num.)' : 'Graus de liberdade'}
                          </span>
                          <span className="text-sm font-semibold" data-testid="result-df">{formatDf(result.df)}</span>
                        </div>
                      )}
                      {result.df2 !== undefined && (
                        <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                          <span className="text-sm text-muted-foreground">Graus de liberdade (denom.)</span>
                          <span className="text-sm font-semibold" data-testid="result-df2">{formatDf(result.df2)}</span>
                        </div>
                      )}
                      {result.ncp !== undefined && (
                        <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                          <span className="text-sm text-muted-foreground">{ncpLabelFor(result.testType)}</span>
                          <span className="text-sm font-semibold" data-testid="result-ncp">{result.ncp.toFixed(7)}</span>
                        </div>
                      )}
                      {result.actualPower !== undefined && (
                        <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                          <span className="text-sm text-muted-foreground">Poder real (com o N inteiro)</span>
                          <span className="text-sm font-semibold" data-testid="result-actual-power">{result.actualPower.toFixed(7)}</span>
                        </div>
                      )}
                      {result.parentDistribution && (
                        <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                          <span className="text-sm text-muted-foreground">Distribuição de origem</span>
                          <span className="text-sm font-semibold" data-testid="result-parent">Normal (A.R.E. = 3/π ≈ {(result.are ?? 3 / Math.PI).toFixed(4)})</span>
                        </div>
                      )}
                      {result.pillaiV !== undefined && (
                        <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                          <span className="text-sm text-muted-foreground">Traço de Pillai (V)</span>
                          <span className="text-sm font-semibold">{result.pillaiV.toFixed(4)}</span>
                        </div>
                      )}
                      {(result.testType === 'logistic-regression' || result.testType === 'multiple-logistic-regression' || result.testType === 'poisson-regression') && result.xDistribution && (
                        <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                          <span className="text-sm text-muted-foreground">Distribuição do preditor</span>
                          <span className="text-sm font-semibold">
                            {result.xDistribution === 'normal' ? 'Normal'
                              : result.xDistribution === 'binomial' ? 'Binomial (Bernoulli)'
                              : result.xDistribution === 'poisson' ? 'Poisson'
                              : result.xDistribution === 'exponential' ? 'Exponencial'
                              : result.xDistribution === 'lognormal' ? 'Lognormal'
                              : result.xDistribution}
                            {(result.xDistribution === 'normal' || result.xDistribution === 'lognormal')
                              && result.xDistMu !== undefined && result.xDistSigma !== undefined
                              ? ` (μ = ${result.xDistMu}, σ = ${result.xDistSigma})`
                              : result.xDistribution === 'binomial' && result.xDistPi !== undefined
                              ? ` (π = ${result.xDistPi})`
                              : (result.xDistribution === 'exponential' || result.xDistribution === 'poisson')
                                && result.xDistLambda !== undefined
                              ? ` (λ = ${result.xDistLambda})`
                              : ''}
                          </span>
                        </div>
                      )}
                      <div className="grid grid-cols-[minmax(100px,130px)_1fr] md:grid-cols-[160px_1fr] gap-2 items-center">
                        <span className="text-sm text-muted-foreground">
                          {criticalValueLabelFor(result.testType)}
                        </span>
                        <span className="text-sm font-semibold" data-testid="result-critical">{result.criticalValue.toFixed(7)}</span>
                      </div>
                    </div>

                    {result.testType === 'fisher-exact' && (
                      <Alert data-testid="note-fisher-approx">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>Aproximação normal.</strong> O poder do Fisher é aproximado pelo teste z para tabela 2×2
                          (equivalente ao χ² com 1 gl), com o N inflado em 15% para refletir o conservadorismo do teste exato.
                          Não é o cálculo exato por enumeração do G*Power, então os valores podem diferir dele.
                        </AlertDescription>
                      </Alert>
                    )}
                    {NONPARAM_TESTS.includes(result.testType) && (
                      <p className="text-xs text-muted-foreground" data-testid="note-are">
                        {result.testType === 'kruskal-wallis' || result.testType === 'friedman'
                          ? 'Método A.R.E.: F não central do teste paramétrico com N efetivo = N × A.R.E. (no λ e nos graus de liberdade). O G*Power não tem módulo para este teste.'
                          : 'Método A.R.E. do G*Power: t não central com N efetivo = N × A.R.E. no δ e nos graus de liberdade (por isso os graus de liberdade não são inteiros).'}
                      </p>
                    )}

                    {/* Power Curve */}
                    {showCurve && curveData.length > 0 && curveMeta && (() => {
                      const isEffectCurve = curveXKey === 'effectSize';
                      const twoGroupTests = ['independent-t', 'mann-whitney', 'compare-correlations-independent'];
                      const perGroupTests = ['anova-oneway', 'kruskal-wallis'];
                      const xLabel = isEffectCurve
                        ? `Tamanho de efeito (${getEffectSizeFamily().symbol})`
                        : twoGroupTests.includes(selectedTest)
                        ? 'n do grupo 1 (n₁)'
                        : perGroupTests.includes(selectedTest)
                        ? 'n por grupo'
                        : ['paired-t', 'wilcoxon-paired', 'mcnemar'].includes(selectedTest)
                        ? 'Número de pares'
                        : ['anova-repeated', 'friedman', 'cochran-q', 'manova-repeated'].includes(selectedTest)
                        ? 'Número de participantes'
                        : 'Tamanho amostral (N)';

                      const fmtX = (v: number) => isEffectCurve ? Number(v).toFixed(3) : `${Math.round(v)}`;
                      const markerX = curveMeta.refX;
                      const markerPower = curveMeta.refPower;
                      const markerLabel = isEffectCurve
                        ? `EMD = ${Number(markerX).toFixed(4)}`
                        : `${twoGroupTests.includes(selectedTest) ? 'n₁' : perGroupTests.includes(selectedTest) ? 'n/grupo' : 'N'} = ${markerX}`;
                      const target = curveMeta.targetPower;
                      const xs = curveData.map((d) => (isEffectCurve ? d.effectSize : d.n) as number);
                      const xMin = Math.min(...xs);
                      const xMax = Math.max(...xs);
                      const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`;
                      // Round tick values (1, 2, 5 × 10ⁿ) covering the plotted range.
                      const niceTicks = (lo: number, hi: number, count = 5): number[] => {
                        const range = hi - lo;
                        if (!(range > 0)) return [lo];
                        const raw = range / count;
                        const mag = Math.pow(10, Math.floor(Math.log10(raw)));
                        const norm = raw / mag;
                        let step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
                        if (!isEffectCurve) step = Math.max(1, Math.round(step));
                        const out: number[] = [];
                        for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) out.push(Number(t.toPrecision(12)));
                        return out;
                      };
                      const xTicks = niceTicks(xMin, xMax);

                      return (
                      <>
                        <Separator />
                        <div className="space-y-2 min-w-0 overflow-hidden" data-testid="power-curve">
                          <div className="flex items-baseline justify-between gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold">Curva de Poder</h4>
                            <span className="text-xs text-muted-foreground" data-testid="curve-marker-text">
                              {markerLabel} → poder {pct(markerPower)}
                            </span>
                          </div>
                          <div className="w-full overflow-hidden">
                          <ResponsiveContainer width="100%" height={260}>
                            <RechartsLine data={curveData} margin={{ top: 22, right: 16, bottom: 18, left: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey={curveXKey}
                                type="number"
                                domain={[xMin, xMax]}
                                allowDataOverflow={false}
                                ticks={xTicks}
                                interval={0}
                                tickFormatter={(v: number) => isEffectCurve ? Number(v).toFixed(xTicks.length > 1 && xTicks[1] - xTicks[0] < 0.1 ? 2 : 1) : `${v}`}
                                label={{ value: xLabel, position: 'insideBottom', offset: -10, fontSize: 12 }}
                              />
                              <YAxis
                                domain={[0, 1]}
                                ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
                                tickFormatter={(v: number) => v.toFixed(1)}
                                label={{ value: 'Poder (1 − β)', angle: -90, position: 'insideLeft', offset: 10, fontSize: 12 }}
                              />
                              <RechartsTooltip
                                formatter={(value: number) => [pct(value), 'Poder']}
                                labelFormatter={(label) => `${xLabel} = ${fmtX(Number(label))}`}
                              />
                              {target !== undefined && (
                                <ReferenceLine
                                  y={target}
                                  stroke="hsl(var(--destructive))"
                                  strokeDasharray="3 3"
                                  label={{ value: `Poder alvo ${pct(target)}`, position: 'insideBottomLeft', fontSize: 11 }}
                                />
                              )}
                              <ReferenceLine
                                x={markerX}
                                stroke="hsl(var(--primary))"
                                strokeDasharray="4 2"
                                label={{ value: markerLabel, position: 'top', fontSize: 11 }}
                              />
                              <Line type="monotone" dataKey="power" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
                              <ReferenceDot x={markerX} y={markerPower} r={4} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2} />
                            </RechartsLine>
                          </ResponsiveContainer>
                          </div>
                          {curveMeta.groupRule && !isEffectCurve && (
                            <p className="text-xs text-muted-foreground">Na curva, {curveMeta.groupRule}.</p>
                          )}
                        </div>
                      </>
                      );
                    })()}

                    {/* Citation Section - Available for all calculation modes */}
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <button
                          onClick={() => setShowCitation(!showCitation)}
                          className="flex items-center gap-2 text-sm font-semibold hover-elevate w-full text-left py-1"
                          data-testid="button-toggle-citation"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>Citação e Referência</span>
                          {showCitation ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                        </button>

                        {showCitation && (
                          <div className="space-y-4 text-sm min-w-0 overflow-hidden">
                            {/* Como citar o aplicativo */}
                            <div className="space-y-2 min-w-0">
                              <h5 className="font-medium text-muted-foreground">Como citar este aplicativo:</h5>
                              <div className="bg-muted/50 rounded-md p-3 relative group overflow-hidden">
                                <p className="pr-8 text-xs leading-relaxed break-words">
                                  Psicometria Online Academy. ({getCurrentYear()}). <em>Calculadora de Análise de Poder Estatístico</em> [Software]. Recuperado de https://psicometriaonline.com.br/
                                </p>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute top-2 right-2 h-6 w-6"
                                  onClick={() => {
                                    const text = `Psicometria Online Academy. (${getCurrentYear()}). Calculadora de Análise de Poder Estatístico [Software]. Recuperado de https://psicometriaonline.com.br/`;
                                    navigator.clipboard.writeText(text);
                                    toast({ title: 'Citação copiada!' });
                                  }}
                                  data-testid="button-copy-app-citation"
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Como referenciar o procedimento */}
                            <div className="space-y-2 min-w-0">
                              <h5 className="font-medium text-muted-foreground">Como referenciar o procedimento:</h5>
                              
                              {/* Input para referência do tamanho de efeito - only show for modes that use effect size input */}
                              {(calculationMode === 'calculate-n' || calculationMode === 'have-n-power') && (
                                <div className="space-y-1 pb-1">
                                  <div className="flex items-center gap-1">
                                    <Label htmlFor="effect-size-reference" className="text-xs text-muted-foreground">
                                      Referência do tamanho de efeito:
                                    </Label>
                                    <TooltipProvider>
                                      <UITooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs text-xs">
                                          A estimativa de tamanho de efeito (i.e., o tamanho do achado esperado) deve ser baseado na literatura. Portanto, é recomendado que você tenha uma justificativa teórica para o número que você adicionou para realizar o cálculo. Caso haja, digite a referência aqui, que aparecerá automaticamente no texto abaixo. Caso não tenha, deixe em branco e ajuste a frase abaixo manualmente.
                                        </TooltipContent>
                                      </UITooltip>
                                    </TooltipProvider>
                                  </div>
                                  <Input
                                    id="effect-size-reference"
                                    type="text"
                                    placeholder="Insira sua referência aqui"
                                    value={effectSizeReference}
                                    onChange={(e) => setEffectSizeReference(e.target.value)}
                                    className="h-8 text-xs focus-visible:ring-0 focus-visible:border-primary"
                                    data-testid="input-effect-size-reference"
                                  />
                                </div>
                              )}
                              
                              <div className="bg-muted/50 rounded-md p-3 relative group overflow-hidden">
                                <p 
                                  className="pr-8 text-xs leading-relaxed text-justify break-words"
                                  dangerouslySetInnerHTML={{ 
                                    __html: generateCitationText().replace(
                                      /\[inserir referência\]/g, 
                                      '<span style="background-color: #F9E97C; padding: 0 2px; border-radius: 2px;">[inserir referência]</span>'
                                    ) 
                                  }}
                                />
                                
                                {/* References section integrated */}
                                <div className="mt-3 pt-3 border-t border-border/30">
                                  <h6 className="text-xs font-medium text-muted-foreground mb-2">Referências:</h6>
                                  <div className="space-y-1.5">
                                    {getTestReferences(selectedTest).map((refKey) => (
                                      <p 
                                        key={refKey} 
                                        className="text-xs leading-relaxed pl-4 -indent-4"
                                        dangerouslySetInnerHTML={{ __html: APA_REFERENCES[refKey] }}
                                      />
                                    ))}
                                  </div>
                                </div>
                                
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute top-2 right-2 h-6 w-6"
                                  onClick={() => {
                                    const procedureText = generateCitationText();
                                    const refsText = getTestReferences(selectedTest)
                                      .map(refKey => APA_REFERENCES[refKey].replace(/<\/?em>/g, ''))
                                      .join('\n');
                                    const fullText = `${procedureText}\n\nReferências:\n${refsText}`;
                                    navigator.clipboard.writeText(fullText);
                                    toast({ title: 'Texto e referências copiados!' });
                                  }}
                                  data-testid="button-copy-procedure-citation"
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-center">
                    <div className="space-y-2">
                      <Calculator className="w-10 h-10 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Configure e calcule
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <EffectSizeRatingWidget calculatorKey="poder_amostral" />
    </div>
  );
}
