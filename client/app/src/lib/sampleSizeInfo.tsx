import type { SampleSizeParameterInfo } from "@/components/SampleSizeInfoModal";

export interface SampleSizeInfo {
  title: string;
  summary?: React.ReactNode;
  parameters: SampleSizeParameterInfo[];
  guidelines: React.ReactNode;
  example: React.ReactNode;
  references: string[];
}

const COMMON_POWER_PARAMS: SampleSizeParameterInfo[] = [
  {
    name: "α (alfa)",
    description:
      "Probabilidade de cometer erro Tipo I, ou seja, rejeitar a hipótese nula quando ela é verdadeira (falso positivo). Padrão: 0,05.",
  },
  {
    name: "Poder (1 − β)",
    description:
      "Probabilidade de detectar o efeito quando ele realmente existe (1 menos a probabilidade de erro Tipo II). Padrão: 0,80; estudos críticos: 0,90 ou 0,95.",
  },
  {
    name: "Caudas",
    description:
      "Bilateral (duas caudas) testa diferença em qualquer direção; unilateral testa diferença em uma direção pré-especificada. Use bilateral por padrão; só escolha unilateral com justificativa teórica forte registrada antes da coleta.",
  },
];

const COHEN_REF =
  "Cohen, J. (1988). Statistical Power Analysis for the Behavioral Sciences (2nd ed.). Lawrence Erlbaum Associates.";
const COHEN_PRIMER_REF =
  "Cohen, J. (1992). A power primer. Psychological Bulletin, 112(1), 155–159.";
const GPOWER_REF =
  "Faul, F., Erdfelder, E., Lang, A.-G., & Buchner, A. (2007). G*Power 3: A flexible statistical power analysis program for the social, behavioral, and biomedical sciences. Behavior Research Methods, 39(2), 175–191.";
const LAKENS_REF =
  "Lakens, D. (2013). Calculating and reporting effect sizes to facilitate cumulative science: A practical primer for t-tests and ANOVAs. Frontiers in Psychology, 4, 863.";
const LEHMANN_REF =
  "Lehmann, E. L. (1975). Nonparametrics: Statistical Methods Based on Ranks. Holden-Day.";
const HODGES_LEHMANN_REF =
  "Hodges, J. L., & Lehmann, E. L. (1956). The efficiency of some nonparametric competitors of the t-test. Annals of Mathematical Statistics, 27(2), 324–335.";
const MULLER_PETERSON_REF =
  "Muller, K. E., & Peterson, B. L. (1984). Practical methods for computing power in testing the multivariate general linear hypothesis. Computational Statistics & Data Analysis, 2(2), 143–158.";
const PILLAI_REF =
  "Pillai, K. C. S. (1955). Some new test criteria in multivariate analysis. Annals of Mathematical Statistics, 26(1), 117–121.";

export const SAMPLE_SIZE_INFO: Record<string, SampleSizeInfo> = {
  // ─────────────────────────────────────────────────────────────
  // POR PRECISÃO — Cochran (prevalência)
  // ─────────────────────────────────────────────────────────────
  "prevalence-cochran": {
    title: "Tamanho amostral por precisão: prevalência (Cochran)",
    summary: (
      <p>
        Calcula quantos participantes são necessários para estimar uma única
        proporção populacional (prevalência, taxa de adesão, fração de
        respondentes a favor) com uma margem de erro pré-definida e um nível
        de confiança especificado. É a fórmula clássica de Cochran (1977),
        adequada para surveys e estudos descritivos. Atenção:{" "}
        <strong>não</strong> testa hipótese.
      </p>
    ),
    parameters: [
      {
        name: "Nível de Confiança",
        description:
          "Probabilidade de o intervalo de confiança conter o valor populacional verdadeiro. Padrão: 95% (Z = 1,96). Quanto maior a confiança, maior o n.",
      },
      {
        name: "Margem de Erro (d)",
        description:
          "Quanto o intervalo pode se afastar da estimativa pontual. Quanto menor, maior o n (n cresce com 1/d²).",
      },
      {
        name: "Modo de precisão",
        description: (
          <span>
            <strong>Absoluta:</strong> a margem é dada em pontos percentuais em
            torno da estimativa. É a opção padrão para a maioria dos surveys.{" "}
            <strong>Relativa:</strong> a margem é uma fração do próprio valor
            estimado, útil quando a prevalência esperada é pequena (por
            exemplo, uma margem relativa de 20% em torno de uma prevalência de
            2% equivale a 0,4 ponto percentual).
          </span>
        ),
      },
      {
        name: "Proporção Esperada (P)",
        description:
          "Sua melhor estimativa, antes do estudo, da proporção que será encontrada (entre 0 e 1). Se não tem ideia, use 0,50, que é o valor que exige a maior amostra e funciona como cenário conservador.",
      },
      {
        name: "População (N)",
        description:
          "Tamanho total da população de onde a amostra será retirada (opcional). Quando preenchido, aplica a correção para população finita, que reduz o n quando a população é pequena. Para uma população acima de 10.000 o efeito é menor que 4%.",
      },
      {
        name: "Não-resposta (NR)",
        description:
          "Fração esperada de recrutados que não fornecerão dado utilizável (entre 0 e 0,99). O n final é aumentado para compensar essas perdas. Para uma não-resposta de 50% ou mais o n praticamente dobra, então revise o desenho.",
      },
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <strong>Cenário conservador:</strong> quando não há estimativa
          prévia de P, use P = 0,50, que produz o maior n possível.
        </li>
        <li>
          <strong>Modo absoluto</strong> é a escolha padrão. Use{" "}
          <strong>modo relativo</strong> apenas quando estiver estimando
          prevalências pequenas (P &lt; 10%) e precisar manter o erro
          proporcional ao próprio P.
        </li>
        <li>
          <strong>Eventos raros (P &lt; ~5%):</strong> a margem absoluta gera
          um n pequeno e enganoso — o estudo quase não observa eventos e o
          intervalo normal (Wald) subcobre o valor verdadeiro (em P = 2% um IC
          "de 95%" cobre só 86,6%). Garanta pelo menos ~5 (idealmente 10)
          eventos esperados, ou seja <strong>n ≥ 5/P</strong>, prefira a margem
          relativa (ex.: ± 20% do próprio P) ou planeje pelo número de eventos:{" "}
          <strong>m = (z/ε)²</strong> e <strong>n = m/P</strong>.
        </li>
        <li>
          <strong>Relate o intervalo por Wilson</strong> (bom equilíbrio) ou{" "}
          <strong>Clopper-Pearson</strong> (exato, conservador) em proporções
          baixas — nunca pelo intervalo de Wald, que subcobre o valor
          verdadeiro.
        </li>
        <li>
          <strong>Correção para população finita</strong> só é útil quando N é
          conhecido e relativamente pequeno (poucos milhares). Acima disso, a
          correção tem efeito desprezível e pode ser omitida.
        </li>
        <li>
          <strong>Inflar para não-resposta</strong> com base em surveys
          piloto ou histórico do público-alvo. Subestimar NR é a causa mais
          comum de subdimensionamento.
        </li>
        <li>
          <strong>Reporte sempre</strong>: P assumido, d, nível de confiança,
          modo (abs/rel), N (se finito), NR e o n final ajustado.
        </li>
      </ul>
    ),
    example: (
      <div className="text-sm space-y-2">
        <p>
          <strong>Objetivo:</strong> estimar a prevalência de ansiedade em
          estudantes universitários de uma universidade com 8.000 alunos, com
          margem de erro absoluta de ±4 pp e 95% de confiança. Estudos
          anteriores sugerem P ≈ 30%. Espera-se 10% de não-resposta.
        </p>
        <p>
          <strong>Parâmetros:</strong> P = 0,30; d = 0,04; modo = absoluto;
          confiança = 95%; N = 8.000; NR = 0,10.
        </p>
        <p>
          <strong>Resultado:</strong> o cálculo base pede 505 participantes,
          que caem para 475 após a correção para população finita e sobem para{" "}
          <strong>528</strong> depois de compensar a não-resposta. Esse é o
          total a recrutar.
        </p>
        <p className="pt-2 border-t">
          <strong>Evento raro (P = 2%) — armadilha da margem absoluta:</strong>{" "}
          com d = ± 5 pp a fórmula devolve apenas <strong>n = 31</strong>, mas
          isso equivale a 0,6 evento esperado (n·P) e o IC de Wald vai de −2,9%
          a 6,9% (cruza zero) — um resultado enganoso.
        </p>
        <p>
          <strong>Abordagem correta:</strong> use margem relativa de ± 20%
          (n = z²·(1−P)/(d²·P) = 1,96² × 0,98 / (0,20² × 0,02) ≈{" "}
          <strong>4.706</strong>, ~94 eventos esperados) ou o critério de
          eventos (m = (1,96/0,20)² ≈ 97; n = 97/0,02 ={" "}
          <strong>4.850</strong>) — praticamente o mesmo resultado. Relate o IC
          por Wilson, não por Wald.
        </p>
      </div>
    ),
    references: [
      "Cochran, W. G. (1977). Sampling Techniques (3rd ed.). John Wiley & Sons.",
      "Daniel, W. W. (1999). Biostatistics: A Foundation for Analysis in the Health Sciences (7th ed.). John Wiley & Sons.",
      "Lwanga, S. K., & Lemeshow, S. (1991). Sample Size Determination in Health Studies. WHO.",
      "Brown, L. D., Cai, T. T., & DasGupta, A. (2001). Interval Estimation for a Binomial Proportion. Statistical Science, 16(2), 101–133.",
      "Agresti, A., & Coull, B. A. (1998). Approximate is Better than 'Exact' for Interval Estimation of Binomial Proportions. The American Statistician, 52(2), 119–126.",
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // POR PRECISÃO — Média populacional
  // ─────────────────────────────────────────────────────────────
  "mean-population": {
    title: "Tamanho amostral por precisão: média populacional",
    summary: (
      <p>
        Calcula quantos participantes são necessários para estimar a{" "}
        <strong>média</strong> de uma variável numérica (um escore, idade,
        tempo de reação, pressão arterial) com uma margem de erro pré-definida
        e um nível de confiança especificado. Baseia-se na aproximação normal
        do intervalo de confiança para a média e exige um valor esperado para
        o <strong>desvio-padrão (σ)</strong>. Atenção: <strong>não</strong>{" "}
        testa hipótese — apenas dimensiona a precisão da estimativa.
      </p>
    ),
    parameters: [
      {
        name: "Nível de Confiança",
        description:
          "Probabilidade de o intervalo de confiança conter a média populacional verdadeira. Padrão: 95% (Z = 1,96). Quanto maior a confiança, maior o n.",
      },
      {
        name: "Margem de Erro (E)",
        description:
          "Semilargura do intervalo de confiança tolerada, na mesma escala da variável (modo absoluto). Quanto menor, maior o n (n cresce com 1/E²).",
      },
      {
        name: "Desvio-padrão (σ)",
        description:
          "Variabilidade esperada da variável na população, na mesma escala da média. Use um valor de estudo-piloto, da literatura ou histórico. Quanto maior σ, maior o n (n cresce com σ²).",
      },
      {
        name: "Modo de precisão",
        description: (
          <span>
            <strong>Absoluta:</strong> a margem E é dada na escala da variável
            (ex.: ± 2 unidades). É a opção padrão.{" "}
            <strong>Relativa:</strong> a margem é uma fração da própria média μ
            (ε), e o cálculo passa a usar o coeficiente de variação σ/μ. Exige
            informar μ.
          </span>
        ),
      },
      {
        name: "Média esperada (μ)",
        description:
          "Sua melhor estimativa, antes do estudo, da média que será encontrada. Necessária apenas no modo relativo, em que a margem vira ε·μ.",
      },
      {
        name: "População (N)",
        description:
          "Tamanho total da população de onde a amostra será retirada (opcional). Quando preenchido, aplica a correção para população finita, que reduz o n quando a população é pequena. Para N acima de 10.000 o efeito é menor que 4%.",
      },
      {
        name: "Não-resposta (NR)",
        description:
          "Fração esperada de recrutados que não fornecerão dado utilizável (entre 0 e 0,99). O n final é aumentado para compensar essas perdas. Para NR de 50% ou mais o n praticamente dobra, então revise o desenho.",
      },
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <strong>O σ é o parâmetro crítico:</strong> como n cresce com σ²,
          subestimar a variabilidade leva a amostras pequenas demais. Prefira
          um σ de estudo-piloto ou, na dúvida, um valor um pouco maior
          (conservador).
        </li>
        <li>
          <strong>Modo absoluto</strong> é a escolha padrão. Use{" "}
          <strong>modo relativo</strong> quando faz mais sentido tolerar um
          erro proporcional à média (ex.: ± 5% de μ) — útil para variáveis com
          ordens de grandeza muito diferentes.
        </li>
        <li>
          <strong>Correção para população finita</strong> só é útil quando N é
          conhecido e relativamente pequeno (poucos milhares). Acima disso o
          efeito é desprezível.
        </li>
        <li>
          <strong>Inflar para não-resposta</strong> com base em estudos-piloto
          ou histórico do público-alvo.
        </li>
        <li>
          <strong>Reporte sempre:</strong> σ assumido, E (ou ε e μ), nível de
          confiança, modo (abs/rel), N (se finito), NR e o n final ajustado.
        </li>
      </ul>
    ),
    example: (
      <div className="text-sm space-y-2">
        <p>
          <strong>Objetivo:</strong> estimar o escore médio de um teste
          psicométrico com margem de erro absoluta de ± 2 pontos e 95% de
          confiança, sabendo de estudos anteriores que o desvio-padrão é de
          cerca de 10 pontos.
        </p>
        <p>
          <strong>Parâmetros:</strong> σ = 10; E = 2; modo = absoluto;
          confiança = 95%.
        </p>
        <p>
          <strong>Cálculo:</strong> n₀ = (1,96 × 10 / 2)² = 9,8² ≈ 96,04.
        </p>
        <p>
          <strong>Resultado:</strong> <strong>n = 97</strong> participantes
          (população infinita). Com uma população de 500 pessoas, cai para 81;
          com 10% de não-resposta sobre esse valor, sobe para 90.
        </p>
      </div>
    ),
    references: [
      "Cochran, W. G. (1977). Sampling Techniques (3rd ed.). John Wiley & Sons.",
      "Daniel, W. W. (1999). Biostatistics: A Foundation for Analysis in the Health Sciences (7th ed.). John Wiley & Sons.",
      "Lwanga, S. K., & Lemeshow, S. (1991). Sample Size Determination in Health Studies. WHO.",
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // POR PRECISÃO — Diferença de duas médias
  // ─────────────────────────────────────────────────────────────
  "diff-means": {
    title: "Tamanho amostral por precisão: diferença entre duas médias",
    summary: (
      <p>
        Calcula quantos participantes <strong>por grupo</strong> são
        necessários para estimar a <strong>diferença</strong> entre as médias
        de dois grupos independentes (ex.: tratamento vs. controle) com uma
        margem de erro pré-definida e um nível de confiança especificado.
        Baseia-se na aproximação normal do intervalo de confiança para a
        diferença de médias. Por padrão usa <strong>alocação igual</strong>{" "}
        (n₁ = n₂), mas aceita uma <strong>razão de alocação</strong> k = n₂/n₁
        para dimensionar grupos de tamanhos diferentes. Atenção:{" "}
        <strong>não</strong> testa hipótese — apenas dimensiona a precisão da
        estimativa da diferença.
      </p>
    ),
    parameters: [
      {
        name: "Nível de Confiança",
        description:
          "Probabilidade de o intervalo conter a diferença verdadeira entre as duas médias. Padrão: 95% (Z = 1,96). Quanto maior a confiança, maior o n.",
      },
      {
        name: "Margem de Erro (E)",
        description:
          "Semilargura tolerada do intervalo de confiança para a diferença entre as médias, na mesma escala da variável. Quanto menor, maior o n (n cresce com 1/E²).",
      },
      {
        name: "Modo de desvios",
        description: (
          <span>
            <strong>Comum (pooled):</strong> assume um único desvio-padrão σ
            para os dois grupos; com alocação igual o n por grupo é 2z²σ²/E².{" "}
            <strong>Separados:</strong> usa σ₁ e σ₂ distintos; com alocação igual
            o n por grupo é z²(σ₁² + σ₂²)/E².
          </span>
        ),
      },
      {
        name: "Desvio-padrão (σ ou σ₁, σ₂)",
        description:
          "Variabilidade esperada da variável em cada grupo, na mesma escala. Use valores de estudo-piloto, da literatura ou históricos. Quanto maior a variabilidade, maior o n.",
      },
      {
        name: "Razão de alocação (k = n₂/n₁)",
        description:
          "Razão entre os tamanhos dos dois grupos (padrão 1 = grupos iguais). Use k = 2 para alocar o dobro de participantes ao grupo 2, ou k = 0,5 para o dobro no grupo 1. Calcula-se n₁ = z²(σ₁² + σ₂²/k)/E² e n₂ = k·n₁. A alocação igual (k = 1) minimiza o n total; afastá-la aumenta o número de participantes necessários.",
      },
      {
        name: "População por grupo (N)",
        description:
          "Tamanho da população de cada grupo (opcional). Quando preenchido, aplica a correção para população finita ao n por grupo. Para N acima de 10.000 o efeito é menor que 4%.",
      },
      {
        name: "Não-resposta (NR)",
        description:
          "Fração esperada de recrutados que não fornecerão dado utilizável (entre 0 e 0,99). O n por grupo é aumentado para compensar essas perdas. Para NR de 50% ou mais o n praticamente dobra.",
      },
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <strong>O resultado é por grupo:</strong> com alocação igual o total é
          2 × n; com alocação desigual o estudo precisa de n₁ + n₂ participantes.
          Sempre reporte os dois tamanhos.
        </li>
        <li>
          <strong>Alocação igual (k = 1) é a mais eficiente:</strong> minimiza o
          n total para a mesma precisão. Use k ≠ 1 apenas quando um grupo for
          mais difícil ou caro de recrutar — o total de participantes aumenta.
        </li>
        <li>
          <strong>Use o modo separado</strong> quando houver razão para esperar
          variâncias claramente diferentes entre os grupos; caso contrário, o
          modo comum (pooled) é mais simples e parcimonioso.
        </li>
        <li>
          <strong>A variabilidade é o parâmetro crítico:</strong> como o n
          cresce com o quadrado dos desvios, subestimá-los leva a amostras
          pequenas demais. Na dúvida, seja conservador.
        </li>
        <li>
          <strong>Correção para população finita</strong> só é útil quando a
          população de cada grupo é conhecida e relativamente pequena.
        </li>
        <li>
          <strong>Reporte sempre:</strong> σ (ou σ₁ e σ₂), E, nível de
          confiança, modo de desvios, N por grupo (se finito), NR, o n por grupo
          e o total.
        </li>
      </ul>
    ),
    example: (
      <div className="text-sm space-y-2">
        <p>
          <strong>Objetivo:</strong> estimar a diferença no escore médio de um
          teste entre um grupo tratamento e um grupo controle com margem de erro
          de ± 5 pontos e 95% de confiança, assumindo desvio-padrão comum de 12
          pontos.
        </p>
        <p>
          <strong>Parâmetros:</strong> σ = 12 (comum); E = 5; confiança = 95%.
        </p>
        <p>
          <strong>Cálculo:</strong> n por grupo = 2 × 1,96² × 12² / 5² =
          2 × 3,8416 × 144 / 25 ≈ 44,25.
        </p>
        <p>
          <strong>Resultado:</strong> <strong>n = 45 por grupo</strong>{" "}
          (total de 90 participantes), para população infinita.
        </p>
        <p>
          <strong>Com alocação desigual (k = 2):</strong> n₁ = z²(σ₁² + σ₂²/k)/E²
          = 1,96² × (144 + 144/2) / 25 ≈ 33,2 → <strong>n₁ = 34</strong> e{" "}
          <strong>n₂ = 68</strong> (total 102 — maior que os 90 da alocação
          igual).
        </p>
      </div>
    ),
    references: [
      "Cochran, W. G. (1977). Sampling Techniques (3rd ed.). John Wiley & Sons.",
      "Daniel, W. W. (1999). Biostatistics: A Foundation for Analysis in the Health Sciences (7th ed.). John Wiley & Sons.",
      "Rosner, B. (2015). Fundamentals of Biostatistics (8th ed.). Cengage Learning.",
    ],
  },

  "diff-proportions": {
    title: "Tamanho amostral por precisão: diferença entre duas proporções",
    summary: (
      <p>
        Calcula quantos participantes <strong>por grupo</strong> são
        necessários para estimar a <strong>diferença</strong> entre as
        proporções de dois grupos independentes (ex.: taxa de adesão no grupo
        tratamento vs. controle) com uma margem de erro pré-definida e um nível
        de confiança especificado. Baseia-se na aproximação normal (Wald) do
        intervalo de confiança para a diferença de proporções. Por padrão usa{" "}
        <strong>alocação igual</strong> (n₁ = n₂), mas aceita uma{" "}
        <strong>razão de alocação</strong> k = n₂/n₁ para dimensionar grupos de
        tamanhos diferentes. Atenção: <strong>não</strong> testa hipótese —
        apenas dimensiona a precisão da estimativa da diferença.
      </p>
    ),
    parameters: [
      {
        name: "Nível de Confiança",
        description:
          "Probabilidade de o intervalo conter a diferença verdadeira entre as duas proporções. Padrão: 95% (Z = 1,96). Quanto maior a confiança, maior o n.",
      },
      {
        name: "Margem de Erro (E)",
        description:
          "Semilargura tolerada do intervalo de confiança para a diferença entre as proporções, em pontos de proporção (ex.: E = 0,10 = ± 10 pontos percentuais). Quanto menor, maior o n (n cresce com 1/E²).",
      },
      {
        name: "Proporção esperada (p₁, p₂)",
        description:
          "Valor esperado de cada proporção, entre 0 e 1 (ex.: 0,30 = 30%). Use valores de estudo-piloto, da literatura ou históricos. Na maior incerteza, p próximo de 0,5 maximiza a variância e o n.",
      },
      {
        name: "Razão de alocação (k = n₂/n₁)",
        description:
          "Razão entre os tamanhos dos dois grupos (padrão 1 = grupos iguais). Use k = 2 para alocar o dobro de participantes ao grupo 2, ou k = 0,5 para o dobro no grupo 1. Calcula-se n₁ = z²[p₁(1−p₁) + p₂(1−p₂)/k]/E² e n₂ = k·n₁. A alocação igual (k = 1) minimiza o n total; afastá-la aumenta o número de participantes necessários.",
      },
      {
        name: "População por grupo (N)",
        description:
          "Tamanho da população de cada grupo (opcional). Quando preenchido, aplica a correção para população finita ao n por grupo. Para N acima de 10.000 o efeito é menor que 4%.",
      },
      {
        name: "Não-resposta (NR)",
        description:
          "Fração esperada de recrutados que não fornecerão dado utilizável (entre 0 e 0,99). O n por grupo é aumentado para compensar essas perdas. Para NR de 50% ou mais o n praticamente dobra.",
      },
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <strong>O resultado é por grupo:</strong> com alocação igual o total é
          2 × n; com alocação desigual o estudo precisa de n₁ + n₂ participantes.
          Sempre reporte os dois tamanhos.
        </li>
        <li>
          <strong>Alocação igual (k = 1) é a mais eficiente:</strong> minimiza o
          n total para a mesma precisão. Use k ≠ 1 apenas quando um grupo for
          mais difícil ou caro de recrutar — o total de participantes aumenta.
        </li>
        <li>
          <strong>A variância depende das proporções:</strong> cada grupo
          contribui com p(1 − p), que é máxima em p = 0,5. Na dúvida sobre os
          valores, usar p próximos de 0,5 é a escolha conservadora.
        </li>
        <li>
          <strong>A margem é sempre absoluta</strong> (em pontos de proporção):
          não há modo relativo, pois a diferença pode ser próxima de zero,
          tornando uma margem proporcional indefinida.
        </li>
        <li>
          <strong>Proporções baixas (p₁ ou p₂ &lt; ~5%):</strong> sem modo
          relativo, esta calculadora é especialmente vulnerável — a margem
          absoluta devolve um n por grupo pequeno e enganoso, com quase nenhum
          evento, e o IC de Wald subcobre a diferença. Garanta ~5 (idealmente
          10) eventos esperados por grupo (<strong>n ≥ 5/p</strong>) ou planeje
          pelo número de eventos: <strong>m = (z/ε)²</strong>,{" "}
          <strong>n = m/p</strong>. Relate cada proporção por Wilson ou
          Clopper-Pearson, nunca por Wald.
        </li>
        <li>
          <strong>Correção para população finita</strong> só é útil quando a
          população de cada grupo é conhecida e relativamente pequena.
        </li>
        <li>
          <strong>Reporte sempre:</strong> p₁, p₂, E, nível de confiança, N por
          grupo (se finito), NR, o n por grupo e o total.
        </li>
      </ul>
    ),
    example: (
      <div className="text-sm space-y-2">
        <p>
          <strong>Objetivo:</strong> estimar a diferença entre as taxas de
          adesão de dois grupos com margem de erro de ± 10 pontos percentuais e
          95% de confiança, esperando proporções em torno de 0,5 nos dois
          grupos (cenário mais conservador).
        </p>
        <p>
          <strong>Parâmetros:</strong> p₁ = 0,5; p₂ = 0,5; E = 0,10; confiança =
          95%.
        </p>
        <p>
          <strong>Cálculo:</strong> n por grupo = 1,96² × (0,5×0,5 + 0,5×0,5) /
          0,10² = 3,8416 × 0,5 / 0,01 ≈ 192,08.
        </p>
        <p>
          <strong>Resultado:</strong> <strong>n = 193 por grupo</strong>{" "}
          (total de 386 participantes), para população infinita.
        </p>
        <p>
          <strong>Com alocação desigual (k = 2):</strong> n₁ = z²[p₁(1−p₁) +
          p₂(1−p₂)/k]/E² = 1,96² × (0,25 + 0,25/2) / 0,01 ≈ 144,06 →{" "}
          <strong>n₁ = 145</strong> e <strong>n₂ = 290</strong> (total 435 —
          maior que os 386 da alocação igual).
        </p>
        <p className="pt-2 border-t">
          <strong>Eventos raros — armadilha da margem absoluta:</strong> com
          p₁ = 2%, p₂ = 3% e E = ± 5 pp, a fórmula devolve só{" "}
          <strong>n = 75 por grupo</strong>, mas o grupo de p = 2% observa ~1,5
          evento esperado — bem abaixo do mínimo de 5. O IC de Wald subcobre a
          diferença e o resultado é enganoso. Planeje pelo número de eventos por
          grupo (m = (z/ε)², n = m/p) e relate cada proporção por Wilson ou
          Clopper-Pearson.
        </p>
      </div>
    ),
    references: [
      "Cochran, W. G. (1977). Sampling Techniques (3rd ed.). John Wiley & Sons.",
      "Daniel, W. W. (1999). Biostatistics: A Foundation for Analysis in the Health Sciences (7th ed.). John Wiley & Sons.",
      "Rosner, B. (2015). Fundamentals of Biostatistics (8th ed.). Cengage Learning.",
      "Newcombe, R. G. (1998). Two-Sided Confidence Intervals for the Single Proportion: Comparison of Seven Methods. Statistics in Medicine, 17(8), 857–872.",
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // POR PODER — Médias
  // ─────────────────────────────────────────────────────────────
  "one-sample-t": {
    title: "Teste t de uma amostra",
    summary: (
      <p>
        Verifica se a média de um único grupo difere de um valor de referência
        conhecido (média populacional histórica, valor teórico, ponto de
        corte). A hipótese nula afirma que a média do grupo é igual ao valor de
        referência.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito d (Cohen)",
        description:
          "Mede a distância entre a média esperada e o valor de referência, expressa em desvios-padrão. Pequeno: 0,20; Médio: 0,50; Grande: 0,80.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Sempre que possível, estime d a partir de estudos prévios da mesma
          área, em vez de usar os valores de referência de Cohen como atalho.
        </li>
        <li>
          Para detectar efeitos pequenos (d = 0,20) com poder 0,80 e α = 0,05
          bilateral, são necessários ~199 sujeitos. Para d médio (0,50), ~34.
          Para d grande (0,80), ~15.
        </li>
        <li>
          O teste pressupõe distribuição aproximadamente normal da variável
          (ou n grande o suficiente para o TCL atuar).
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> avaliar se o QI médio de estudantes de uma
        escola difere de 100 (média populacional). Espera-se efeito médio
        (d = 0,50). Com α = 0,05 bilateral e poder = 0,80, são necessários{" "}
        <strong>~34 estudantes</strong>.
      </p>
    ),
    references: [COHEN_REF, COHEN_PRIMER_REF, GPOWER_REF],
  },

  "paired-t": {
    title: "Teste t pareado",
    summary: (
      <p>
        Compara duas medições do mesmo sujeito (antes e depois, pré e pós,
        olho esquerdo e direito, gêmeos pareados). Mais eficiente que o
        independente quando há correlação entre as medidas.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito d_z (Cohen)",
        description:
          "Mede a média das diferenças entre as duas medições, expressa em desvios-padrão dessas diferenças. Use o desvio-padrão das diferenças, NÃO o das medidas brutas. Pequeno: 0,20; Médio: 0,50; Grande: 0,80.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Para d_z = 0,50, α = 0,05 bilateral e poder = 0,80: ~34 pares de
          observações.
        </li>
        <li>
          Quanto maior a correlação entre as duas medidas, menor o DP das
          diferenças e maior o tamanho de efeito resultante, por isso o pareado
          costuma exigir muito menos sujeitos que o independente equivalente.
        </li>
        <li>
          O cálculo usa o número de <strong>pares</strong>, não de medições
          isoladas. Cada participante contribui com 2 medidas e conta como 1.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> avaliar se a pressão arterial mudou após um
        programa de exercícios nos mesmos pacientes. Espera-se efeito médio
        (d_z = 0,50). Com α = 0,05 bilateral e poder = 0,80, são necessários{" "}
        <strong>~34 pacientes</strong> avaliados pré e pós.
      </p>
    ),
    references: [COHEN_REF, COHEN_PRIMER_REF, LAKENS_REF, GPOWER_REF],
  },

  "independent-t": {
    title: "Teste t para amostras independentes",
    summary: (
      <p>
        Compara as médias de dois grupos independentes, com sujeitos diferentes
        em cada grupo. A hipótese nula afirma que as médias dos dois grupos são
        iguais.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito d (Cohen)",
        description:
          "Mede a diferença entre as médias dos dois grupos, expressa em desvios-padrão. Pequeno: 0,20; Médio: 0,50; Grande: 0,80.",
      },
      {
        name: "Razão n₁/n₂",
        description:
          "Razão entre os tamanhos dos grupos. 1 = grupos iguais (mais eficiente). 2 = grupo 1 tem o dobro do grupo 2. 0,5 = grupo 2 tem o dobro do grupo 1.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <strong>Sempre prefira grupos iguais</strong> quando o recrutamento
          permitir, pois é o desenho mais eficiente para um dado n total.
        </li>
        <li>
          Razão ≠ 1 só faz sentido quando recrutar para um dos grupos é muito
          mais difícil ou caro. O n total cresce em troca de flexibilidade.
        </li>
        <li>
          Para d = 0,50, α = 0,05 bilateral, poder = 0,80 e grupos iguais:
          ~63 a 64 sujeitos por grupo (cerca de 126 a 128 no total).
        </li>
        <li>
          Pressupõe distribuição aproximadamente normal e variâncias
          semelhantes entre os grupos (Welch dispensa a 2ª).
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> comparar a eficácia de dois tratamentos
        para ansiedade aplicados a grupos distintos de pacientes. Espera-se
        efeito médio (d = 0,50), grupos iguais. Com α = 0,05 bilateral e
        poder = 0,80, são necessários <strong>~64 por grupo (128 total)</strong>.
      </p>
    ),
    references: [COHEN_REF, COHEN_PRIMER_REF, LAKENS_REF, GPOWER_REF],
  },

  "anova-oneway": {
    title: "ANOVA one-way",
    summary: (
      <p>
        Compara as médias de três ou mais grupos independentes formados por um
        único fator de classificação. A hipótese nula afirma que todos os
        grupos têm a mesma média.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito f (Cohen)",
        description:
          "Mede o quanto as médias dos grupos se espalham em relação à variação dentro dos grupos. Pequeno: 0,10; Médio: 0,25; Grande: 0,40.",
      },
      {
        name: "Número de grupos (k)",
        description:
          "Quantos grupos serão comparados (k ≥ 3 para ANOVA one-way).",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Para f = 0,25 (efeito médio), k = 3, α = 0,05 e poder = 0,80: ~53
          sujeitos por grupo.
        </li>
        <li>
          A ANOVA não usa "caudas": é sempre um teste unilateral por
          construção.
        </li>
        <li>
          Aumentar k geralmente aumenta o n total. Pressupõe normalidade e
          homogeneidade de variâncias.
        </li>
        <li>
          Detectar uma diferença global não diz onde ela está, então planeje
          comparações post-hoc (Tukey, Bonferroni) que tipicamente exigem n
          maior por grupo.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> comparar a perda de peso entre três tipos
        de dieta (baixo carboidrato, vegetariana, mediterrânea). Espera-se
        efeito médio (f = 0,25). Com α = 0,05 e poder = 0,80, são necessários{" "}
        <strong>~53 sujeitos por grupo (159 no total)</strong>.
      </p>
    ),
    references: [COHEN_REF, COHEN_PRIMER_REF, LAKENS_REF, GPOWER_REF],
  },

  // ─────────────────────────────────────────────────────────────
  // POR PODER — Médias (não-paramétricos)
  // ─────────────────────────────────────────────────────────────
  "wilcoxon-one-sample": {
    title: "Wilcoxon de uma amostra (signed-rank)",
    summary: (
      <p>
        Alternativa não-paramétrica ao teste t de uma amostra. Compara a
        mediana de um único grupo com um valor de referência fixo quando
        os dados não são aproximadamente normais ou são ordinais. A hipótese
        nula afirma que a mediana do grupo é igual ao valor de referência,
        supondo distribuição simétrica em torno dela.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito d (Cohen, paramétrico equivalente)",
        description:
          "Mede a distância entre a mediana e o valor de referência, expressa em desvios-padrão. Mesmos valores de referência do t: pequeno 0,20; médio 0,50; grande 0,80. O n calculado já incorpora o ajuste de eficiência do teste, que exige cerca de 4,7% a mais de sujeitos que o t equivalente.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <strong>Quando usar:</strong> dados ordinais, distribuições não-normais
          mas simétricas, presença de outliers que comprometeriam o t.
        </li>
        <li>
          <strong>Quando NÃO usar:</strong> se os dados são razoavelmente normais,
          prefira o teste t (mais poderoso); se a distribuição é fortemente
          assimétrica, considere o teste do sinal.
        </li>
        <li>
          <strong>Método (igual ao G*Power):</strong> método A.R.E. com
          distribuição de origem normal (A.R.E. = 3/π ≈ 0,955): t não central
          com δ = d·√(N·A.R.E.) e gl = N·A.R.E. − 1, por isso os graus de
          liberdade não são inteiros. O ajuste é assintótico; para n menor que
          15 valide por simulação ou tabelas exatas.
        </li>
        <li>
          <strong>Perdas/dropouts:</strong> aumente o n final para compensar a
          não-resposta esperada, fora deste cálculo.
        </li>
        <li>
          <strong>Reporte sempre:</strong> efeito d assumido, α, poder, n final
          e a justificativa do efeito mínimo clinicamente relevante.
        </li>
      </ul>
    ),
    example: (
      <div className="text-sm space-y-2">
        <p>
          <strong>Cenário:</strong> testar se o tempo mediano de recuperação
          após uma cirurgia ambulatorial difere de 14 dias, com tempos
          assimétricos.
        </p>
        <p>
          <strong>Parâmetros:</strong> d = 0,50 (efeito médio); α = 0,05
          bilateral; poder = 0,80.
        </p>
        <p>
          <strong>Cálculo:</strong> o teste t de uma amostra equivalente pede
          34. Pelo método A.R.E. do G*Power, o Wilcoxon pede 35 (gl = 32,4225;
          t crítico = 2,0358928; δ = 2,8906114; poder real = 0,8006915).
        </p>
        <p>
          <strong>Resultado:</strong> <strong>N = 35 pacientes</strong>.
        </p>
      </div>
    ),
    references: [
      COHEN_REF,
      COHEN_PRIMER_REF,
      LEHMANN_REF,
      HODGES_LEHMANN_REF,
      "Wilcoxon, F. (1945). Individual comparisons by ranking methods. Biometrics Bulletin, 1(6), 80–83.",
      GPOWER_REF,
    ],
  },

  "mann-whitney": {
    title: "Mann-Whitney U (não-paramétrico)",
    summary: (
      <p>
        Alternativa não-paramétrica ao teste t para amostras independentes.
        Compara a distribuição de dois grupos independentes quando os dados
        são ordinais ou não-normais. A hipótese nula afirma que os dois grupos
        têm distribuições com o mesmo formato, ou seja, distribuições iguais.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito d (Cohen, paramétrico equivalente)",
        description:
          "Mede a diferença entre as médias dos dois grupos, expressa em desvios-padrão. Pequeno 0,20; médio 0,50; grande 0,80. O n calculado já incorpora o ajuste de eficiência do teste, que exige cerca de 4,7% mais sujeitos que o t independente.",
      },
      {
        name: "Razão n₁/n₂",
        description:
          "Razão entre os tamanhos dos grupos. 1 = grupos iguais (mais eficiente). 2 = grupo 1 tem o dobro do grupo 2. 0,5 = grupo 2 tem o dobro do grupo 1.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <strong>Quando usar:</strong> dados ordinais, distribuições
          não-normais, outliers presentes.
        </li>
        <li>
          <strong>Quando NÃO usar:</strong> se os dados são razoavelmente
          normais, prefira o t independente; se as variâncias diferem muito,
          considere Brunner-Munzel ou bootstrap.
        </li>
        <li>
          <strong>Método (igual ao G*Power):</strong> método A.R.E. com
          distribuição de origem normal (A.R.E. = 3/π ≈ 0,955): t não central
          com δ = d·√(n₁·n₂·A.R.E./(n₁+n₂)) e gl = (n₁+n₂)·A.R.E. − 2.
        </li>
        <li>
          <strong>Suposição central:</strong> o ajuste de eficiência vale
          quando as distribuições têm a mesma forma, apenas deslocada. Se uma
          amostra é muito mais dispersa, o teste detecta diferença de
          dispersão, não de posição.
        </li>
        <li>
          <strong>Grupos iguais:</strong> sempre prefira grupos de tamanho
          igual quando o recrutamento permitir, pois é o desenho mais
          eficiente.
        </li>
        <li>
          <strong>Reporte sempre:</strong> efeito d, α, poder, n por grupo e
          a justificativa do efeito mínimo clinicamente relevante.
        </li>
      </ul>
    ),
    example: (
      <div className="text-sm space-y-2">
        <p>
          <strong>Cenário:</strong> comparar a satisfação de clientes
          (escala Likert de 1 a 10) entre duas lojas.
        </p>
        <p>
          <strong>Parâmetros:</strong> d = 0,50; α = 0,05 bilateral;
          poder = 0,80; grupos iguais.
        </p>
        <p>
          <strong>Cálculo:</strong> o t independente equivalente pede 64 por
          grupo. Pelo método A.R.E. do G*Power: gl = 125,9606; t crítico =
          1,9789766; δ = 2,8279915; poder real = 0,8013372.
        </p>
        <p>
          <strong>Resultado:</strong>{" "}
          <strong>N = 67 por grupo (134 no total)</strong>, idêntico ao G*Power.
        </p>
      </div>
    ),
    references: [
      COHEN_REF,
      COHEN_PRIMER_REF,
      LEHMANN_REF,
      HODGES_LEHMANN_REF,
      "Mann, H. B., & Whitney, D. R. (1947). On a test of whether one of two random variables is stochastically larger than the other. Annals of Mathematical Statistics, 18(1), 50–60.",
      GPOWER_REF,
    ],
  },

  "wilcoxon-paired": {
    title: "Wilcoxon pareado (signed-rank)",
    summary: (
      <p>
        Alternativa não-paramétrica ao teste t pareado. Compara duas medições
        do mesmo sujeito (antes e depois, pré e pós, olho esquerdo e direito)
        quando as diferenças intra-sujeito não são normais ou os dados são
        ordinais. A hipótese nula afirma que a mediana das diferenças é zero,
        supondo diferenças simétricas em torno de zero.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito d_z (Cohen, paramétrico equivalente)",
        description:
          "Mede a média das diferenças entre as duas medições, expressa em desvios-padrão dessas diferenças. Use o desvio-padrão das diferenças, NÃO o das medidas brutas. Pequeno 0,20; médio 0,50; grande 0,80. O n calculado já incorpora o ajuste de eficiência do teste.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <strong>Quando usar:</strong> escalas ordinais (dor, Likert),
          diferenças intra-sujeito assimétricas mas simétricas, presença de
          outliers nas diferenças.
        </li>
        <li>
          <strong>Quando NÃO usar:</strong> se as diferenças são razoavelmente
          normais, prefira o t pareado; se são fortemente assimétricas,
          considere o teste do sinal.
        </li>
        <li>
          <strong>O n são pares:</strong> cada participante contribui com 2
          medidas e conta como 1. A vantagem do pareado depende de correlação
          positiva entre as medições; sem isso o n se aproxima do
          Mann-Whitney.
        </li>
        <li>
          <strong>Método (igual ao G*Power):</strong> método A.R.E. com
          distribuição de origem normal (A.R.E. = 3/π ≈ 0,955): t não central
          com δ = d_z·√(N·A.R.E.) e gl = N·A.R.E. − 1. Para n menor que 15
          valide por simulação.
        </li>
        <li>
          <strong>Reporte sempre:</strong> d_z assumido, α, poder, n de pares
          e justificativa.
        </li>
      </ul>
    ),
    example: (
      <div className="text-sm space-y-2">
        <p>
          <strong>Cenário:</strong> comparar níveis de dor (escala de 0 a 10)
          antes e após tratamento nos mesmos pacientes.
        </p>
        <p>
          <strong>Parâmetros:</strong> d_z = 0,50; α = 0,05 bilateral;
          poder = 0,80.
        </p>
        <p>
          <strong>Cálculo:</strong> o t pareado equivalente pede 34 pares. Pelo
          método A.R.E. do G*Power, o Wilcoxon pede 35 pares (gl = 32,4225;
          t crítico = 2,0358928).
        </p>
        <p>
          <strong>Resultado:</strong> <strong>N = 35 pares</strong>.
        </p>
      </div>
    ),
    references: [
      COHEN_REF,
      COHEN_PRIMER_REF,
      LAKENS_REF,
      LEHMANN_REF,
      "Wilcoxon, F. (1945). Individual comparisons by ranking methods. Biometrics Bulletin, 1(6), 80–83.",
      GPOWER_REF,
    ],
  },

  "kruskal-wallis": {
    title: "Kruskal-Wallis H (não-paramétrico)",
    summary: (
      <p>
        Alternativa não-paramétrica à ANOVA one-way. Compara a distribuição
        de três ou mais grupos independentes quando os dados são ordinais
        ou não-normais. A hipótese nula afirma que todos os grupos têm
        distribuições com o mesmo formato, ou seja, distribuições iguais. É um
        teste unilateral por construção, sem escolha de "caudas".
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito f (Cohen, paramétrico equivalente)",
        description:
          "Mede o quanto as médias dos grupos se espalham em relação à variação dentro dos grupos. Pequeno 0,10; médio 0,25; grande 0,40. O n calculado já incorpora o ajuste de eficiência do teste sobre o N total.",
      },
      {
        name: "Número de grupos (k)",
        description:
          "Quantos grupos serão comparados (k ≥ 3). k = 2 colapsa para o Mann-Whitney; prefira aquele teste, com benchmark de efeito mais direto.",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <strong>Estatística do teste:</strong> o poder é calculado a partir
          do tamanho de efeito, do número de grupos e do tamanho da amostra,
          usando o F não central da ANOVA com o método A.R.E. (distribuição de
          origem normal, A.R.E. = 3/π): N efetivo = N·A.R.E. no λ e no gl do
          denominador. O G*Power não tem módulo de Kruskal-Wallis, então não há
          valor dele para comparar.
        </li>
        <li>
          <strong>Quando usar ou não:</strong> para dados ordinais ou
          não-normais, use Kruskal-Wallis; para dados normais e variâncias
          semelhantes, use a ANOVA one-way; para formas muito diferentes entre
          grupos, considere Brunner-Dette-Munk.
        </li>
        <li>
          <strong>Sempre unilateral:</strong> o teste usa apenas a cauda
          superior, então não há escolha de "caudas" no planejamento.
        </li>
        <li>
          <strong>Post-hoc:</strong> detectar uma diferença global não diz
          entre quais grupos ela está; planeje comparações por pares
          (Dunn + Bonferroni/Holm), que tipicamente exigem n maior.
        </li>
        <li>
          <strong>Reporte sempre:</strong> f, k, α, poder, n por grupo e
          justificativa do efeito mínimo clinicamente relevante.
        </li>
      </ul>
    ),
    example: (
      <div className="text-sm space-y-2">
        <p>
          <strong>Cenário:</strong> comparar a satisfação de funcionários
          (Likert) entre três departamentos.
        </p>
        <p>
          <strong>Parâmetros:</strong> f = 0,25; k = 3; α = 0,05;
          poder = 0,80.
        </p>
        <p>
          <strong>Cálculo:</strong> por busca iterativa, combinando o tamanho
          de efeito, os 3 grupos e o ajuste de eficiência, o resultado converge
          em n = 55.
        </p>
        <p>
          <strong>Resultado:</strong>{" "}
          <strong>N ≈ 55 por grupo (cerca de 165 no total)</strong>, 2 a mais
          por grupo que a ANOVA one-way equivalente.
        </p>
      </div>
    ),
    references: [
      COHEN_REF,
      COHEN_PRIMER_REF,
      LEHMANN_REF,
      "Kruskal, W. H., & Wallis, W. A. (1952). Use of ranks in one-criterion variance analysis. Journal of the American Statistical Association, 47(260), 583–621.",
      "Dunn, O. J. (1964). Multiple comparisons using rank sums. Technometrics, 6(3), 241–252.",
      GPOWER_REF,
    ],
  },

  "friedman": {
    title: "Friedman (não-paramétrico, medidas repetidas)",
    summary: (
      <p>
        Alternativa não-paramétrica à ANOVA de medidas repetidas. Compara
        três ou mais medições relacionadas nos mesmos sujeitos (k condições
        ou tempos) quando os dados são ordinais ou não-normais. A hipótese
        nula afirma que as condições têm a mesma distribuição dentro de cada
        sujeito. É unilateral por construção.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito f (Cohen, paramétrico equivalente)",
        description:
          "Mede o quanto as médias das condições se espalham em relação à variação residual (na escala da ANOVA de medidas repetidas). Pequeno 0,10; médio 0,25; grande 0,40. O n calculado já incorpora o ajuste de eficiência do teste.",
      },
      {
        name: "Número de condições (k)",
        description:
          "Quantas medições cada sujeito faz (k ≥ 3). k = 2 colapsa para o Wilcoxon pareado. Para variáveis dicotômicas (sim/não), use Q de Cochran.",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <strong>Estatística do teste:</strong> o poder é calculado a partir
          do tamanho de efeito, do número de condições e do tamanho da amostra,
          usando o F não central de medidas repetidas com o método A.R.E.
          (distribuição de origem normal, A.R.E. = 3/π): N efetivo = N·A.R.E.
          no λ e no gl do erro. O G*Power não tem módulo de Friedman.
        </li>
        <li>
          <strong>Não exige correlação como input:</strong> ao contrário da
          ANOVA repetidas, a correlação intra-sujeito já está embutida no
          ranqueamento dentro de cada bloco. O resultado tende a ser
          conservador quando a correlação real é muito alta.
        </li>
        <li>
          <strong>Quando usar ou não:</strong> para dados ordinais ou
          não-normais, use Friedman; para dados normais com esfericidade, use
          a ANOVA de medidas repetidas; para variáveis dicotômicas, use o Q de
          Cochran.
        </li>
        <li>
          <strong>Post-hoc:</strong> use Wilcoxon pareado por pares com
          correção de Bonferroni, ou teste de Nemenyi.
        </li>
        <li>
          <strong>Perdas/dropouts:</strong> em medidas repetidas, um único
          valor faltante elimina o sujeito inteiro, então sobrestime a
          não-resposta e aumente o n final para compensá-la, fora deste
          cálculo.
        </li>
        <li>
          <strong>Reporte sempre:</strong> f, k, α, poder, n de sujeitos e
          justificativa do efeito mínimo clinicamente relevante.
        </li>
      </ul>
    ),
    example: (
      <div className="text-sm space-y-2">
        <p>
          <strong>Cenário:</strong> avaliar a preferência de consumidores
          por 3 sabores de um produto, com cada pessoa provando todos os
          três e atribuindo notas em escala ordinal.
        </p>
        <p>
          <strong>Parâmetros:</strong> f = 0,25; k = 3; α = 0,05;
          poder = 0,80.
        </p>
        <p>
          <strong>Cálculo:</strong> por busca iterativa, combinando o tamanho
          de efeito, as 3 condições e o ajuste de eficiência, o resultado
          converge em n = 56.
        </p>
        <p>
          <strong>Resultado:</strong>{" "}
          <strong>N ≈ 56 sujeitos</strong> (168 observações totais).
        </p>
      </div>
    ),
    references: [
      COHEN_REF,
      COHEN_PRIMER_REF,
      LEHMANN_REF,
      "Friedman, M. (1937). The use of ranks to avoid the assumption of normality implicit in the analysis of variance. Journal of the American Statistical Association, 32(200), 675–701.",
      "Nemenyi, P. B. (1963). Distribution-free multiple comparisons (Tese de doutorado). Princeton University.",
      GPOWER_REF,
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // POR PODER — Correlações
  // ─────────────────────────────────────────────────────────────
  "pearson-correlation": {
    title: "Correlação de Pearson",
    summary: (
      <p>
        Testa se existe associação linear entre duas variáveis contínuas
        (coeficiente r de Pearson). A hipótese nula afirma que não existe
        correlação entre as duas variáveis.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito |ρ|",
        description:
          "Correlação populacional esperada, em valor absoluto (de 0 a 1). Pequeno: 0,10; Médio: 0,30; Grande: 0,50.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Para ρ = 0,30 com α = 0,05 e poder = 0,80: ~85 sujeitos. Para
          ρ = 0,10: ~782. Para ρ = 0,50: ~29.
        </li>
        <li>
          A relação entre n e ρ não é linear: efeitos pequenos exigem n
          drasticamente maior.
        </li>
        <li>
          Pressupõe variáveis aproximadamente bivariate-normal. Para dados
          ordinais ou não-normais, considere Spearman.
        </li>
        <li>
          Correlação ≠ causalidade. Detectar associação não justifica
          inferência causal sem desenho apropriado.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> investigar a relação entre horas de estudo
        e desempenho em provas. Espera-se correlação média (ρ = 0,30). Com
        α = 0,05 bilateral e poder = 0,80, são necessários{" "}
        <strong>~85 estudantes</strong>.
      </p>
    ),
    references: [COHEN_REF, COHEN_PRIMER_REF, GPOWER_REF],
  },

  // ─────────────────────────────────────────────────────────────
  // POR PODER — Proporções
  // ─────────────────────────────────────────────────────────────
  "two-proportions": {
    title: "Duas proporções independentes (z-test)",
    summary: (
      <p>
        Compara as proporções de dois grupos independentes, como taxas de
        sucesso, conversão, mortalidade ou adesão. A hipótese nula afirma que
        as duas proporções populacionais são iguais.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito h (Cohen)",
        description:
          "Mede a distância entre as duas proporções em uma escala transformada que faz o n depender apenas do tamanho de efeito, e não dos valores absolutos das proporções. Pequeno: 0,20; Médio: 0,50; Grande: 0,80.",
      },
      {
        name: "Razão de alocação",
        description:
          "Geralmente fixada em 1 (grupos iguais). Use razão diferente apenas com justificativa.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Passar de 15% para 25% dá h ≈ 0,25 (efeito pequeno-médio) e exige
          ~124 sujeitos por grupo (α = 0,05, poder = 0,80).
        </li>
        <li>
          Para detectar diferenças pequenas entre proporções próximas de 0%
          ou 100%, h fica muito reduzido e o n exigido cresce bastante;
          considere se a diferença é clinicamente relevante antes de coletar.
        </li>
        <li>
          O teste z assume amostras grandes (regra: n·p ≥ 10 e n·(1−p) ≥ 10
          em cada grupo). Para amostras pequenas, use Fisher exato.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> comparar a taxa de conversão de duas
        campanhas de marketing (campanha A: ~15% esperado, B: ~25%
        esperado). h ≈ 0,252. Com α = 0,05 bilateral e poder = 0,80, são
        necessários <strong>~124 sujeitos por grupo (248 no total)</strong>.
      </p>
    ),
    references: [COHEN_REF, COHEN_PRIMER_REF, GPOWER_REF],
  },

  "chi-square-2x2": {
    title: "Qui-quadrado 2×2",
    summary: (
      <p>
        Testa se duas variáveis categóricas dicotômicas estão associadas em
        uma tabela 2×2. A hipótese nula afirma que as duas variáveis são
        independentes.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito w (Cohen)",
        description:
          "Mede a força da associação entre as duas variáveis na tabela. Para tabelas 2×2 com marginais balanceadas, fica próximo do h de Cohen. Pequeno: 0,10; Médio: 0,30; Grande: 0,50.",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Para w = 0,30 (efeito médio) com α = 0,05 e poder = 0,80: ~87 a 88
          sujeitos no total. Para w = 0,10: ~785.
        </li>
        <li>
          O qui-quadrado não tem "caudas": é um teste sempre unilateral por
          construção.
        </li>
        <li>
          Se alguma frequência <em>esperada</em> for menor que 5, prefira o
          teste exato de Fisher.
        </li>
        <li>
          Para comparações pareadas (mesmo sujeito, dois momentos), use o
          teste de McNemar, não o qui-quadrado.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> verificar se há relação entre gênero (M/F)
        e preferência por um produto (sim/não). Espera-se efeito médio
        (w = 0,30). Com α = 0,05 e poder = 0,80, são necessários{" "}
        <strong>~88 participantes no total</strong>.
      </p>
    ),
    references: [COHEN_REF, COHEN_PRIMER_REF, GPOWER_REF],
  },

  "chi-square-independence": {
    title: "Qui-quadrado de independência (r × c): Tamanho amostral por poder",
    summary: (
      <p>
        Testa se duas variáveis categóricas estão associadas em uma{" "}
        <strong>tabela de contingência r × c</strong> com r ou c maior
        que 2 (ex.: faixa etária com 3 níveis × preferência de produto
        com 4 níveis, df = 6). A hipótese nula afirma que as duas variáveis
        são independentes, ou seja, a probabilidade de cada combinação de
        linha e coluna é o produto das probabilidades de cada uma
        separadamente; a hipótese alternativa afirma que existe associação.
        Para tabelas 2 × 2 use o teste dedicado, que pede{" "}
        <em>p₁</em> e <em>p₂</em> em vez de <em>w</em>.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito w (Cohen)",
        description:
          "Mede a força da associação entre as duas variáveis na tabela. Para tabelas maiores que 2×2 relaciona-se ao V de Cramér. Benchmarks de Cohen (1988): pequeno = 0,10; médio = 0,30; grande = 0,50. Em tabela 3×3, isso corresponde a um V de Cramér de aproximadamente 0,07 / 0,21 / 0,35.",
      },
      {
        name: "Número de linhas (r)",
        description:
          "Quantidade de categorias da variável-linha (mínimo 2). Junto com c define os graus de liberdade df = (r − 1)(c − 1).",
      },
      {
        name: "Número de colunas (c)",
        description:
          "Quantidade de categorias da variável-coluna (mínimo 2). Não use r = 2 e c = 2 ao mesmo tempo: para esse caso use o qui-quadrado 2×2 dedicado.",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <strong>Estatística do teste:</strong> o poder é calculado a partir
          do tamanho de efeito, dos graus de liberdade da tabela e do tamanho
          da amostra, usando a distribuição qui-quadrado. É a mesma rota usada
          por <code>pwr::pwr.chisq.test</code> (Cohen, 1988, cap. 7).
        </li>
        <li>
          <strong>Use quando:</strong> duas variáveis categóricas
          medidas em sujeitos independentes, com pelo menos uma das
          dimensões maior que 2. <strong>Não use</strong> em tabelas
          2 × 2 (teste dedicado), em medidas pareadas (McNemar para 2
          condições, Q de Cochran para k ≥ 3), nem quando se quer
          comparar a distribuição observada a uma teórica fixa
          (goodness-of-fit).
        </li>
        <li>
          <strong>Sem caudas:</strong> qui-quadrado é sempre unilateral
          por construção, então não há escolha de caudas.
        </li>
        <li>
          <strong>Limites da aproximação:</strong> com frequências
          esperadas pequenas (&lt; 5 em mais de 20 % das células, ou
          &lt; 1 em qualquer célula) a aproximação assintótica falha;
          prefira o teste exato de Fisher (versão r × c). O mínimo
          prático no cálculo é N ≥ 5.
        </li>
        <li>
          <strong>Cuidado ao escolher w:</strong> superestimar w produz
          amostras pequenas demais e perde poder real. Sempre que
          possível, derive w da distribuição conjunta esperada (matriz
          de probabilidades), não use o benchmark diretamente.
        </li>
        <li>
          <strong>Perdas/dropouts:</strong> infle o N obtido por{" "}
          1 / (1 − NR), onde NR é a taxa esperada de não-resposta.
        </li>
        <li>
          <strong>Reporte sempre:</strong> w assumido (e como foi
          derivado), α, poder, r × c, df e N final. Se o objetivo for
          detectar tendências ordinais, considere testes específicos
          (Cochran-Armitage, gama de Goodman-Kruskal) em vez do
          qui-quadrado global.
        </li>
      </ul>
    ),
    example: (
      <div className="text-sm space-y-2">
        <p>
          <strong>Cenário:</strong> tabela 3 × 3 (df = 4), efeito médio
          esperado.
        </p>
        <p>
          <strong>Parâmetros:</strong> w = 0,30; α = 0,05; poder = 0,80;
          r = 3; c = 3.
        </p>
        <p>
          <strong>Cálculo:</strong> com df = 4 e efeito médio, o tamanho de
          amostra necessário para atingir poder de cerca de 0,80 fica em torno
          de N = 133. O mesmo resultado é confirmado por{" "}
          <code>pwr.chisq.test(w = 0,30, df = 4, sig.level = 0,05, power = 0,80)</code>,
          que aponta N de aproximadamente 132,6.
        </p>
        <p>
          <strong>Resultado:</strong>{" "}
          <strong>N ≈ 133 participantes no total</strong>.
        </p>
      </div>
    ),
    references: [
      COHEN_REF,
      COHEN_PRIMER_REF,
      GPOWER_REF,
      "Cramér, H. (1946). Mathematical Methods of Statistics. Princeton University Press.",
      "Champely, S. (2020). pwr: Basic Functions for Power Analysis (pwr.chisq.test).",
    ],
  },

  "cochran-q": {
    title: "Q de Cochran: Tamanho amostral por poder",
    summary: (
      <p>
        Extensão do teste de McNemar para <strong>k ≥ 3 condições pareadas</strong>:
        verifica se a proporção de "sucessos" (variável dicotômica 0/1)
        difere entre três ou mais medidas tomadas nos{" "}
        <strong>mesmos sujeitos</strong> (medidas repetidas / blocos
        relacionados). A hipótese nula afirma que a proporção de sucessos é
        igual em todas as condições; a hipótese alternativa afirma que pelo
        menos uma proporção difere. Exemplos típicos: a mesma pessoa avaliada
        em pré, pós e follow-up dizendo se aderiu ou não ao tratamento; o
        mesmo aluno acertando ou não três versões do mesmo item; o mesmo
        paciente apresentando ou não um sintoma em três avaliações.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito w (Cohen)",
        description:
          "Mede o quanto as proporções de sucesso variam entre as condições, calculado a partir das proporções esperadas em cada condição. Benchmarks de Cohen (1988): pequeno = 0,10; médio = 0,30; grande = 0,50. Sempre que possível, derive o valor das proporções esperadas em cada condição, em vez de usar diretamente os benchmarks.",
      },
      {
        name: "Número de condições (k)",
        description:
          "Quantidade de medidas/momentos pareados avaliados nos mesmos sujeitos (mínimo 3). Os graus de liberdade do teste serão df = k − 1. Para k = 2, o procedimento se reduz ao teste de McNemar: use o teste dedicado.",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <strong>Estatística do teste:</strong> o poder é calculado a partir
          do tamanho de efeito, do número de condições e do tamanho da amostra,
          usando a distribuição qui-quadrado. É a mesma abordagem usada por{" "}
          <code>pwr::pwr.chisq.test</code> (Cohen, 1988, cap. 7).
        </li>
        <li>
          <strong>Use Cochran Q quando:</strong> resposta dicotômica
          (sim/não, acerto/erro), mesmos sujeitos em todas as condições,
          k ≥ 3. <strong>Não use</strong> se os grupos forem
          independentes (use qui-quadrado de independência ou comparação
          de proporções), se a resposta for ordinal/contínua (use
          Friedman ou ANOVA de medidas repetidas) ou se houver apenas
          duas condições (use McNemar).
        </li>
        <li>
          <strong>Sem caudas:</strong> qui-quadrado é sempre unilateral
          por construção, então não há escolha de caudas.
        </li>
        <li>
          <strong>Limites da aproximação:</strong> com N pequeno ou
          marginais muito desbalanceadas (totais por linha próximos de 0
          ou de k), o teste fica conservador. O mínimo prático é{" "}
          <strong>N ≥ 5 sujeitos</strong> para a aproximação valer; em
          geral, almeje N ≥ 30 sujeitos com Σ Rᵢ ≥ 24.
        </li>
        <li>
          <strong>Correlação intra-sujeito:</strong> o cálculo não modela
          diretamente a correlação entre as k medidas além do que já
          está embutido na estrutura pareada; designs com correlações
          extremas podem desviar do resultado teórico.
        </li>
        <li>
          <strong>Perdas/dropouts:</strong> inflate o N obtido por{" "}
          1 / (1 − NR), onde NR é a taxa esperada de não-resposta. Em
          desenhos longitudinais, NR costuma crescer a cada onda.
        </li>
        <li>
          <strong>Reporte sempre:</strong> w assumido (e como foi
          derivado), k, α, poder, N final e a justificativa do efeito
          mínimo clinicamente relevante.
        </li>
      </ul>
    ),
    example: (
      <div className="text-sm space-y-2">
        <p>
          <strong>Cenário:</strong> estudo longitudinal de adesão a
          tratamento medida nos mesmos pacientes em três momentos
          (pré, pós e follow-up). Espera-se efeito médio (w = 0,30).
        </p>
        <p>
          <strong>Parâmetros:</strong> w = 0,30; k = 3 (df = 2);
          α = 0,05; poder = 0,80.
        </p>
        <p>
          <strong>Cálculo:</strong> com df = 2 e efeito médio, o tamanho de
          amostra necessário para atingir poder de cerca de 0,80 fica em torno
          de N = 108 sujeitos.
        </p>
        <p>
          <strong>Resultado:</strong> <strong>N ≈ 108 sujeitos</strong>{" "}
          (compatível com <code>pwr::pwr.chisq.test(w=0.3, df=2, sig.level=0.05, power=0.8)</code>).
        </p>
      </div>
    ),
    references: [
      "Cochran, W. G. (1950). The comparison of percentages in matched samples. Biometrika, 37(3–4), 256–266.",
      COHEN_REF,
      COHEN_PRIMER_REF,
      "Champely, S. (2020). pwr: Basic Functions for Power Analysis. R package (pwr.chisq.test).",
      GPOWER_REF,
      "Sheskin, D. J. (2011). Handbook of Parametric and Nonparametric Statistical Procedures (5th ed., cap. 26). Chapman & Hall/CRC.",
      "Conover, W. J. (1999). Practical Nonparametric Statistics (3rd ed., pp. 388–396). John Wiley & Sons.",
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // POR PODER — Médias (ANOVA avançadas)
  // ─────────────────────────────────────────────────────────────
  "anova-factorial": {
    title: "ANOVA fatorial (dois fatores entre-sujeitos)",
    summary: (
      <p>
        Planeja o n para detectar um <strong>efeito principal</strong> (A ou B)
        ou a <strong>interação A×B</strong> em um delineamento fatorial com dois
        fatores entre-sujeitos. A hipótese nula afirma que não há efeito (do
        fator ou da interação).
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito f (Cohen)",
        description:
          "f de Cohen para o efeito de interesse. Pequeno: 0,10; Médio: 0,25; Grande: 0,40.",
      },
      {
        name: "Níveis dos fatores A e B",
        description:
          "Número de níveis de cada fator. O total de células é A × B; o n retornado é POR CÉLULA (multiplique por A × B para o total).",
      },
      {
        name: "Efeito a detectar",
        description:
          "Efeito principal de A, de B, ou a interação A×B. Interações costumam ter f menor que efeitos principais.",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          O resultado é o n <strong>por célula</strong>. O total do estudo é
          n × (níveis de A) × (níveis de B).
        </li>
        <li>
          Para a interação em um 2×3 com f = 0,25 (médio), α = 0,05 e
          poder = 0,80: ~27 por célula (162 no total).
        </li>
        <li>
          Use o mesmo f que se refere ao efeito específico testado: planejar a
          interação com o f de um efeito principal costuma subdimensionar.
        </li>
        <li>
          Pressupõe delineamento balanceado e variâncias homogêneas.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> delineamento 2×3 para detectar a interação
        tratamento × gênero com efeito médio (f = 0,25). Com α = 0,05 e
        poder = 0,80, são necessários{" "}
        <strong>~27 sujeitos por célula (162 no total)</strong>.
      </p>
    ),
    references: [COHEN_REF, GPOWER_REF],
  },

  "anova-repeated": {
    title: "ANOVA de medidas repetidas (within-subjects)",
    summary: (
      <p>
        Planeja o número de sujeitos quando os <strong>mesmos participantes</strong>{" "}
        são medidos em 3 ou mais momentos/condições. A hipótese nula afirma que
        todas as médias das medições são iguais.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito f (Cohen)",
        description:
          "f de Cohen. Pequeno: 0,10; Médio: 0,25; Grande: 0,40.",
      },
      {
        name: "Nº de medições (m)",
        description:
          "Quantidade de medições repetidas por sujeito (≥ 2).",
      },
      {
        name: "Correlação entre medidas (ρ)",
        description:
          "Correlação média entre as medidas repetidas. Quanto maior, maior o poder para o mesmo n; superestimar ρ subdimensiona o estudo.",
      },
      {
        name: "Correção de esfericidade (ε)",
        description:
          "Greenhouse-Geisser/Huynh-Feldt. ε = 1 assume esfericidade; ε < 1 reduz os graus de liberdade e aumenta o n.",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          O ganho de poder vem da correlação entre as medidas: quanto mais
          correlacionadas, mais econômico fica o delineamento intra-sujeitos.
        </li>
        <li>
          Para 3 medições, f = 0,25, ρ = 0,5 e ε = 1 (α = 0,05, poder = 0,80):
          ~28 sujeitos.
        </li>
        <li>
          Para apenas 2 medições, use o t pareado. Para dados ordinais, Friedman.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> desempenho cognitivo medido em 3 momentos nos
        mesmos participantes, efeito médio (f = 0,25), ρ = 0,5. Com α = 0,05 e
        poder = 0,80, são necessários <strong>~28 sujeitos</strong>.
      </p>
    ),
    references: [COHEN_REF, GPOWER_REF],
  },

  "anova-mixed": {
    title: "ANOVA mista (between × within)",
    summary: (
      <p>
        Combina um fator <strong>entre-sujeitos</strong> (grupos) com um fator{" "}
        <strong>intra-sujeitos</strong> (medidas repetidas). Planeja para o efeito
        between, within ou a interação Grupo × Tempo.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito f (Cohen)",
        description:
          "f de Cohen para o efeito escolhido. Pequeno: 0,10; Médio: 0,25; Grande: 0,40.",
      },
      {
        name: "Nº de grupos (g) e medições (m)",
        description:
          "Grupos entre-sujeitos e medições repetidas por sujeito.",
      },
      {
        name: "Correlação (ρ) e esfericidade (ε)",
        description:
          "Afetam os efeitos within e interação (não o between). ρ alto e ε = 1 reduzem o n dos efeitos intra-sujeitos.",
      },
      {
        name: "Efeito a detectar",
        description:
          "Between (entre grupos), within (ao longo do tempo) ou a interação Grupo × Tempo.",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          O resultado é o <strong>N total</strong> (todos os grupos somados), não
          o n por grupo.
        </li>
        <li>
          Para 2 grupos, 3 medições, f = 0,25, ρ = 0,5: interação ~28 no total;
          efeito between ~44 no total.
        </li>
        <li>
          O efeito between não se beneficia da correlação entre medidas e costuma
          exigir n bem maior que a interação.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> 2 tratamentos medidos em 3 momentos; detectar a
        interação Grupo × Tempo com efeito médio (f = 0,25, ρ = 0,5). Com
        α = 0,05 e poder = 0,80, são necessários{" "}
        <strong>~28 sujeitos no total (14 por grupo)</strong>.
      </p>
    ),
    references: [COHEN_REF, GPOWER_REF],
  },

  // ─────────────────────────────────────────────────────────────
  // POR PODER — MANOVA (traço de Pillai)
  // ─────────────────────────────────────────────────────────────
  "manova": {
    title: "MANOVA (one-way)",
    summary: (
      <p>
        Planeja o N total para comparar <strong>vários grupos</strong> em{" "}
        <strong>duas ou mais variáveis-resposta simultaneamente</strong>, usando
        a estatística <strong>traço de Pillai</strong>. A hipótese nula afirma
        que os vetores de médias são iguais entre os grupos.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito (f²)",
        description:
          "f² multivariado do efeito. Relaciona-se ao traço de Pillai por V = s·f²/(1+f²). Valores de referência (Cohen): pequeno 0,02; médio 0,15; grande 0,35.",
      },
      {
        name: "Variáveis-resposta (p)",
        description:
          "Número de variáveis dependentes analisadas em conjunto (≥ 2).",
      },
      {
        name: "Número de grupos (k)",
        description:
          "Grupos a comparar (≥ 2). Define os graus de liberdade da hipótese (p·(k−1)) e do erro (N−k).",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          O resultado é o <strong>N total</strong> (todos os grupos somados).
        </li>
        <li>
          O traço de Pillai é a estatística mais robusta a violações de
          pressupostos entre as quatro multivariadas usuais.
        </li>
        <li>
          Adicionar variáveis-resposta pouco correlacionadas com o efeito tende
          a reduzir o poder; inclua apenas desfechos teoricamente relevantes.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> 3 grupos comparados em 2 desfechos, com
        f² = 0,0625 (traço de Pillai V = 0,1176). Com α = 0,05 e poder = 0,80,
        são necessários <strong>N = 98 no total</strong>.
      </p>
    ),
    references: [COHEN_REF, MULLER_PETERSON_REF, PILLAI_REF, GPOWER_REF],
  },

  "manova-factorial": {
    title: "MANOVA fatorial",
    summary: (
      <p>
        Planeja o N total para detectar um efeito (principal ou interação) em um
        delineamento <strong>fatorial multivariado</strong> com várias
        variáveis-resposta, usando o <strong>traço de Pillai</strong>.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito (f²)",
        description:
          "f² multivariado do efeito testado. V = s·f²/(1+f²). Referência (Cohen): pequeno 0,02; médio 0,15; grande 0,35.",
      },
      {
        name: "Variáveis-resposta (p)",
        description:
          "Número de variáveis dependentes analisadas em conjunto (≥ 2).",
      },
      {
        name: "Número de grupos (k)",
        description:
          "Total de células do delineamento fatorial. Define os graus de liberdade do erro (N−k).",
      },
      {
        name: "Número de preditores",
        description:
          "Graus de liberdade da hipótese do efeito testado. Para a interação A×B é (a−1)(b−1); para um efeito principal é (níveis−1).",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          O resultado é o <strong>N total</strong> do delineamento.
        </li>
        <li>
          Use o f² e os graus de liberdade que se referem ao efeito específico
          testado (interações costumam ter f² menor que efeitos principais).
        </li>
        <li>
          Pressupõe delineamento balanceado e homogeneidade das matrizes de
          covariância.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> delineamento fatorial com 6 células e 2
        variáveis-resposta, detectando um efeito com 3 graus de liberdade de
        hipótese e f² = 0,0625 (traço de Pillai V = 0,1176). Com α = 0,05 e
        poder = 0,95, são necessários <strong>N = 171 no total</strong>.
      </p>
    ),
    references: [COHEN_REF, MULLER_PETERSON_REF, PILLAI_REF, GPOWER_REF],
  },

  "manova-repeated": {
    title: "MANOVA de medidas repetidas",
    summary: (
      <p>
        Planeja o N para um delineamento de <strong>medidas repetidas</strong>{" "}
        analisado pela abordagem <strong>multivariada</strong> (traço de Pillai),
        sem assumir esfericidade. A hipótese nula afirma que as médias das
        medições são iguais.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito (f²)",
        description:
          "f² multivariado do efeito intra-sujeitos. V = s·f²/(1+f²). Referência (Cohen): pequeno 0,02; médio 0,15; grande 0,35.",
      },
      {
        name: "Nº de medições (m)",
        description:
          "Número de medições repetidas por sujeito (≥ 2). Os contrastes geram p = m−1 variáveis transformadas.",
      },
      {
        name: "Nº de grupos",
        description:
          "Grupos entre-sujeitos. Use 1 para um único grupo.",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          A abordagem multivariada <strong>não exige esfericidade</strong>, ao
          contrário da ANOVA de medidas repetidas univariada.
        </li>
        <li>
          O resultado é o <strong>N total</strong> de sujeitos.
        </li>
        <li>
          Para muitos níveis e amostras pequenas, a abordagem univariada
          corrigida (Greenhouse-Geisser) pode ter mais poder.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> 4 medições em um único grupo (p = m − 1 = 3),
        com f² = 0,0625. Com α = 0,05 e poder = 0,80, são necessários{" "}
        <strong>N = 179 sujeitos</strong>.
      </p>
    ),
    references: [COHEN_REF, MULLER_PETERSON_REF, PILLAI_REF, GPOWER_REF],
  },

  // ─────────────────────────────────────────────────────────────
  // POR PODER — Correlações avançadas
  // ─────────────────────────────────────────────────────────────
  "spearman-correlation": {
    title: "Correlação de Spearman (rho)",
    summary: (
      <p>
        Testa associação <strong>monotônica</strong> (não necessariamente
        linear) entre duas variáveis, útil para dados ordinais ou não-normais.
        A hipótese nula afirma que não existe associação monotônica entre as
        duas variáveis.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito |ρ_s|",
        description:
          "Correlação de postos esperada, em valor absoluto. Pequeno: 0,10; Médio: 0,30; Grande: 0,50.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Para o planejamento amostral, usa a mesma aproximação (z de Fisher) do
          Pearson: para n &gt; 10 as propriedades são muito próximas.
        </li>
        <li>
          Para ρ_s = 0,30 com α = 0,05 e poder = 0,80: ~85 sujeitos (igual ao
          Pearson para o mesmo coeficiente).
        </li>
        <li>
          Não há desconto de eficiência específico para postos; trate o n como
          estimativa de planejamento.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> relação entre posição no ranking de vendas e
        satisfação, efeito médio (ρ_s = 0,30). Com α = 0,05 bilateral e
        poder = 0,80, são necessários <strong>~85 sujeitos</strong>.
      </p>
    ),
    references: [COHEN_REF, GPOWER_REF],
  },

  "kendall-correlation": {
    title: "Correlação de Kendall (tau-b)",
    summary: (
      <p>
        Testa associação <strong>ordinal</strong> baseada em pares concordantes e
        discordantes, robusta com amostras pequenas e muitos empates. A
        hipótese nula afirma que não existe associação ordinal entre as duas
        variáveis.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito |τ|",
        description:
          "Tau de Kendall esperado, em valor absoluto. Pequeno: 0,10; Médio: 0,30; Grande: 0,50. Lembre que τ tende a ser menor que ρ (≈ ρ/1,5).",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Usa a variância assintótica exata do tau. Para τ = 0,30
          com α = 0,05 e poder = 0,80: ~43 sujeitos.
        </li>
        <li>
          Os modos "calcular tamanho" e "tenho n" usam a mesma fórmula, então o n
          retornado atinge o poder-alvo quando reconferido.
        </li>
        <li>
          τ e ρ não estão na mesma escala; interprete os limiares de Cohen com
          cautela.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> concordância entre dois juízes que ordenam
        candidatos, efeito médio (τ = 0,30). Com α = 0,05 bilateral e
        poder = 0,80, são necessários <strong>~43 sujeitos</strong>.
      </p>
    ),
    references: [
      COHEN_REF,
      "Kendall, M. G. (1938). A new measure of rank correlation. Biometrika, 30(1/2), 81–93.",
      "Bonett, D. G., & Wright, T. A. (2000). Sample size requirements for estimating Pearson, Kendall and Spearman correlations. Psychometrika, 65(1), 23–28.",
    ],
  },

  "compare-correlations-independent": {
    title: "Comparação de duas correlações independentes",
    summary: (
      <p>
        Testa se a correlação entre as mesmas duas variáveis difere entre{" "}
        <strong>duas amostras independentes</strong>. A hipótese nula afirma
        que as duas correlações populacionais são iguais.
      </p>
    ),
    parameters: [
      {
        name: "Correlações r₁ e r₂",
        description:
          "Correlações esperadas em cada amostra. O n depende dos valores absolutos, não só da diferença: a mesma Δρ exige menos sujeitos quando as correlações estão perto de ±1.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Compara as duas correlações na escala transformada de Fisher; quanto
          maior a diferença entre elas, menor o n por grupo.
        </li>
        <li>
          Para r₁ = 0,50 vs r₂ = 0,20 (α = 0,05, poder = 0,80): ~134 por grupo
          (268 no total).
        </li>
        <li>
          Pressupõe grupos de tamanho igual e variáveis bivariadas normais.
          Diferenças pequenas exigem n por grupo muito elevado.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> a correlação entre ansiedade e desempenho
        difere entre homens e mulheres (amostras separadas), r₁ = 0,50 vs
        r₂ = 0,20. Com α = 0,05 bilateral e poder = 0,80, são necessários{" "}
        <strong>~134 por grupo (268 no total)</strong>.
      </p>
    ),
    references: [
      COHEN_REF,
      "Fisher, R. A. (1921). On the 'probable error' of a coefficient of correlation deduced from a small sample. Metron, 1, 3–32.",
      GPOWER_REF,
    ],
  },

  "compare-correlations-dependent": {
    title: "Comparação de correlações dependentes (sobrepostas)",
    summary: (
      <p>
        Em uma <strong>única amostra</strong> com três variáveis, testa se duas
        correlações que <strong>compartilham uma variável comum</strong> (X)
        diferem. A hipótese nula afirma que as duas correlações que envolvem a
        variável comum são iguais.
      </p>
    ),
    parameters: [
      {
        name: "r₁ (ρ_xy) e r₂ (ρ_xz)",
        description:
          "As duas correlações a comparar, ambas envolvendo a variável comum X.",
      },
      {
        name: "r₃ (ρ_yz)",
        description:
          "Correlação entre as duas variáveis NÃO comuns (Y e Z). Quanto maior, menor o n necessário.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          O n é obtido buscando o menor valor cujo poder de Steiger (t não-central)
          atinge o alvo; a aproximação por z de Fisher serve só de chute inicial.
        </li>
        <li>
          Para ρ_xy = 0,60, ρ_xz = 0,30, ρ_yz = 0,40 (α = 0,05, poder = 0,80):
          ~75 sujeitos.
        </li>
        <li>
          Os modos "calcular tamanho" e "tenho n" usam a mesma fórmula de Steiger,
          então o n retornado atinge o poder-alvo quando reconferido.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> na mesma amostra, a correlação entre
        inteligência (X) e matemática (Y) é maior que entre inteligência (X) e
        linguagem (Z)? Com ρ_xy = 0,60, ρ_xz = 0,30, ρ_yz = 0,40 (α = 0,05,
        poder = 0,80): <strong>~75 sujeitos</strong>.
      </p>
    ),
    references: [
      COHEN_REF,
      "Steiger, J. H. (1980). Tests for comparing elements of a correlation matrix. Psychological Bulletin, 87(2), 245–251.",
      GPOWER_REF,
    ],
  },

  "regression-simple": {
    title: "Regressão linear simples (um preditor)",
    summary: (
      <p>
        Planeja o n para detectar se um <strong>único preditor</strong> contínuo
        explica variância significativa (equivale a R² &gt; 0). A hipótese nula
        afirma que o preditor não tem efeito sobre o desfecho.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito f² (Cohen)",
        description:
          "Mede quanto o preditor explica da variação do desfecho em relação ao que fica sem explicação. Pequeno: 0,02; Médio: 0,15; Grande: 0,35. Por exemplo, um R² de 0,13 corresponde a um f² de aproximadamente 0,15.",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          O poder cresce com o tamanho de efeito e com o n; para um preditor a
          rota de cálculo é a da regressão com 1 grau de liberdade no numerador.
        </li>
        <li>
          Para f² = 0,15 (médio) com α = 0,05 e poder = 0,80: ~55 sujeitos. Para
          f² = 0,02 (pequeno): ~395.
        </li>
        <li>
          Para 1 preditor, o resultado coincide com o do Pearson. Com 2+
          preditores, use os modelos de regressão múltipla.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> anos de experiência predizem salário, efeito
        médio (f² = 0,15). Com α = 0,05 e poder = 0,80, são necessários{" "}
        <strong>~55 sujeitos</strong>.
      </p>
    ),
    references: [COHEN_REF, COHEN_PRIMER_REF, GPOWER_REF],
  },

  "regression-multiple-total": {
    title: "Regressão linear múltipla (R² total)",
    summary: (
      <p>
        Planeja o n para detectar se o <strong>conjunto de preditores</strong>{" "}
        explica variância significativa do desfecho (equivale a R² &gt; 0). A
        hipótese nula afirma que nenhum preditor contribui (R² do modelo igual
        a zero).
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito f² (Cohen)",
        description:
          "Mede quanto o modelo completo explica em relação ao que fica sem explicação: f² = R² / (1 − R²). Pequeno: 0,02; Médio: 0,15; Grande: 0,35. Por exemplo, um R² de 0,13 corresponde a um f² de aproximadamente 0,15.",
      },
      {
        name: "Número de preditores",
        description:
          "Quantidade de preditores do modelo. Define os graus de liberdade do numerador (igual ao número de preditores) e do denominador (n − preditores − 1). Mais preditores exigem mais sujeitos para o mesmo poder.",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Sob H₁ a estatística F segue uma F não-central com{" "}
          <code>df1 = preditores</code>, <code>df2 = n − preditores − 1</code> e
          parâmetro de não-centralidade <code>λ = f²·n</code>.
        </li>
        <li>
          Para f² = 0,15 (médio) com 5 preditores, α = 0,05 e poder = 0,80:
          ~92 sujeitos. Mais preditores aumentam o n necessário.
        </li>
        <li>
          Para testar a contribuição de apenas um bloco de preditores (modelo
          hierárquico), use o incremento de R² em vez do R² total.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> idade, escolaridade e renda (entre outros, 5
        preditores) predizem o bem-estar, efeito médio (f² = 0,15). Com α =
        0,05 e poder = 0,80, são necessários <strong>~92 sujeitos</strong>.
      </p>
    ),
    references: [COHEN_REF, COHEN_PRIMER_REF, GPOWER_REF],
  },

  "regression-multiple-increment": {
    title: "Regressão linear múltipla (incremento de R²)",
    summary: (
      <p>
        Planeja o n para detectar se um <strong>bloco de preditores</strong>{" "}
        acrescenta variância explicada além da já captada pelos demais (modelo
        hierárquico). A hipótese nula afirma que o incremento de R² é zero.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito f² (Cohen)",
        description:
          "Mede a contribuição única do bloco testado: f² = (R²_completo − R²_reduzido) / (1 − R²_completo). Pequeno: 0,02; Médio: 0,15; Grande: 0,35.",
      },
      {
        name: "Número de preditores",
        description:
          "Total de preditores do modelo completo (incluindo os testados). Define os graus de liberdade do denominador: n − preditores − 1.",
      },
      {
        name: "Preditores testados",
        description:
          "Quantidade de preditores do bloco em avaliação (o incremento). Define os graus de liberdade do numerador. Por exemplo, ao adicionar três escalas de personalidade, são 3 preditores testados.",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Sob H₁ a estatística F segue uma F não-central com{" "}
          <code>df1 = preditores testados</code>,{" "}
          <code>df2 = n − preditores − 1</code> e{" "}
          <code>λ = f²·n</code>.
        </li>
        <li>
          Para f² = 0,15 (médio), 5 preditores no total e 3 testados, α = 0,05 e
          poder = 0,80: ~79 sujeitos.
        </li>
        <li>
          O número de preditores testados nunca deve exceder o total de
          preditores do modelo.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> depois de controlar idade e sexo, adicionar
        três medidas de personalidade (5 preditores no total, 3 testados),
        efeito médio (f² = 0,15). Com α = 0,05 e poder = 0,80, são necessários{" "}
        <strong>~79 sujeitos</strong>.
      </p>
    ),
    references: [COHEN_REF, COHEN_PRIMER_REF, GPOWER_REF],
  },

  "logistic-regression": {
    title: "Regressão logística (OR esperado)",
    summary: (
      <p>
        Planeja o n para detectar se um <strong>preditor contínuo</strong> está
        associado à chance de ocorrência de um desfecho binário. A hipótese
        nula afirma que o coeficiente do preditor é zero (odds ratio igual a
        1).
      </p>
    ),
    parameters: [
      {
        name: "Odds ratio (OR) esperado",
        description:
          "Variação na chance do desfecho para o aumento de um desvio-padrão no preditor. OR ≈ 1,5: efeito pequeno; ≈ 2,5: médio; ≥ 4: grande. Valores muito próximos de 1 exigem amostras grandes.",
      },
      {
        name: "Probabilidade do evento (P)",
        description:
          "Probabilidade de ocorrência do desfecho na média do preditor (entre 0 e 1). Por exemplo, 0,5 quando metade dos casos apresenta o desfecho. O n é menor quando P está próximo de 0,5.",
      },
      {
        name: "Distribuição do preditor (X)",
        description:
          "Formato assumido para o preditor: Normal (padrão), Binomial (preditor 0/1), Exponencial, Lognormal ou Poisson — as mesmas opções do G*Power. Os parâmetros (µ, σ, π ou λ) já vêm com os defaults do G*Power. Mantenha Normal para reproduzir exatamente os resultados anteriores.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Usa o método de Demidenko (2007) com correção de variância — o
          procedimento padrão do G*Power 3.1. O n é obtido de{" "}
          <code>N = (z_(1−α/2)·√v₁ + z_(1−β)·√v₀)² / (ln OR)²</code>, em que v₀ e
          v₁ são as variâncias de β̂₁ sob H0 e H1, calculadas pela informação de
          Fisher sobre a distribuição escolhida para o preditor.
        </li>
        <li>
          Para OR = 1,5 com P = 0,5, α = 0,05 bilateral e poder = 0,80: ~208
          sujeitos. Para OR = 2 com P = 0,3: ~92.
        </li>
        <li>
          A distribuição do preditor importa: escolha Normal (padrão), Binomial,
          Exponencial, Lognormal ou Poisson conforme o formato real de X. O n
          varia bastante entre elas; com vários preditores correlacionados,
          infle o n por um fator de variância (VIF) ou use a regressão logística
          múltipla.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> o escore de estresse prevê a presença de um
        transtorno (sim/não), OR esperado = 1,5 e P = 0,5. Com α = 0,05
        bilateral e poder = 0,80, são necessários <strong>~208 sujeitos</strong>.
      </p>
    ),
    references: [
      GPOWER_REF,
      "Demidenko, E. (2007). Sample size determination for logistic regression revisited. Statistics in Medicine, 26(18), 3385–3397.",
      "Hsieh, F. Y., Bloch, D. A., & Larsen, M. D. (1998). A simple method of sample size calculation for linear and logistic regression. Statistics in Medicine, 17(14), 1623–1634.",
    ],
  },

  "multiple-logistic-regression": {
    title: "Regressão logística múltipla (OR esperado)",
    summary: (
      <p>
        Planeja o n para detectar se um <strong>preditor contínuo</strong> está
        associado à chance de ocorrência de um desfecho binário,{" "}
        <strong>ajustando para outras covariáveis</strong> do modelo. A hipótese
        nula afirma que o coeficiente do preditor de interesse é zero (odds
        ratio igual a 1).
      </p>
    ),
    parameters: [
      {
        name: "Odds ratio (OR) esperado",
        description:
          "Variação na chance do desfecho para o aumento de um desvio-padrão no preditor de interesse. OR ≈ 1,5: efeito pequeno; ≈ 2,5: médio; ≥ 4: grande. Valores muito próximos de 1 exigem amostras grandes.",
      },
      {
        name: "Probabilidade do evento (P)",
        description:
          "Probabilidade de ocorrência do desfecho na média do preditor (entre 0 e 1). Por exemplo, 0,5 quando metade dos casos apresenta o desfecho. O n é menor quando P está próximo de 0,5.",
      },
      {
        name: "R² dos demais preditores",
        description:
          "Proporção da variância do preditor de interesse explicada pelas outras covariáveis (R² da regressão desse preditor sobre as demais). Entre 0 e 1. Quanto maior, maior o n necessário, pois o n é inflado por 1/(1−R²). Use 0 quando o preditor é independente das demais variáveis.",
      },
      {
        name: "Distribuição do preditor (X)",
        description:
          "Formato assumido para o preditor de interesse: Normal (padrão), Binomial (preditor 0/1), Exponencial, Lognormal ou Poisson — as mesmas opções do G*Power. Os parâmetros (µ, σ, π ou λ) já vêm com os defaults do G*Power. Mantenha Normal para reproduzir exatamente os resultados anteriores.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Parte do método de Demidenko (2007) com correção de variância (o
          procedimento padrão do G*Power 3.1) e aplica a correção de Hsieh,
          Bloch & Larsen (1998) para as demais covariáveis:{" "}
          <code>N′ = N / (1 − R²)</code>. Isso equivale ao fator (1 − R²) que
          aparece dentro de m₁ na equação 14 do manual do G*Power.
        </li>
        <li>
          Para OR = 1,5, P = 0,5 e R² = 0,1, com α = 0,05 bilateral e poder =
          0,95: ~375 sujeitos (mesmo valor do G*Power). Com R² = 0 o resultado
          coincide com o da regressão logística de um preditor.
        </li>
        <li>
          A distribuição do preditor de interesse (Normal, Binomial,
          Exponencial, Lognormal ou Poisson) deve refletir o formato real de X;
          o n base, antes da correção 1/(1−R²), varia bastante entre elas.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> o escore de estresse prevê a presença de um
        transtorno (sim/não), OR esperado = 1,5, P = 0,5 e R² = 0,1 (o preditor
        compartilha 10% da variância com idade e sexo). Com α = 0,05 bilateral e
        poder = 0,95, são necessários <strong>~375 sujeitos</strong>.
      </p>
    ),
    references: [
      GPOWER_REF,
      "Demidenko, E. (2007). Sample size determination for logistic regression revisited. Statistics in Medicine, 26(18), 3385–3397.",
      "Hsieh, F. Y., Bloch, D. A., & Larsen, M. D. (1998). A simple method of sample size calculation for linear and logistic regression. Statistics in Medicine, 17(14), 1623–1634.",
    ],
  },

  "poisson-regression": {
    title: "Regressão de Poisson (razão de taxas)",
    summary: (
      <p>
        Planeja o n para detectar se um <strong>preditor contínuo</strong> está
        associado à taxa de ocorrência de um desfecho de contagem. A hipótese
        nula afirma que o coeficiente do preditor é zero (razão de taxas igual
        a 1).
      </p>
    ),
    parameters: [
      {
        name: "Razão de taxas (RR) esperada",
        description:
          "Variação na taxa de eventos para o aumento de uma unidade no preditor (exp(β1)). RR ≈ 1,3–1,5: efeito pequeno; ≈ 2,0: médio; ≥ 3: grande.",
      },
      {
        name: "Taxa basal de eventos",
        description:
          "Taxa média de eventos na média do preditor — o exp(β0) do G*Power, considerando o tempo de exposição/seguimento (fixado em 1). Deve ser positiva. Taxas basais maiores reduzem o n necessário.",
      },
      {
        name: "R² dos demais preditores",
        description:
          "Proporção da variância do preditor de interesse explicada pelas demais covariáveis (R² da regressão desse preditor sobre as outras). Entre 0 e 1. Quanto maior, maior o n necessário (fator 1/(1−R²)). Use 0 quando o preditor é independente das demais variáveis.",
      },
      {
        name: "Distribuição do preditor (X)",
        description:
          "Formato assumido para o preditor: Normal (padrão), Binomial (preditor 0/1), Exponencial, Lognormal ou Poisson — as mesmas opções do G*Power. Os parâmetros (µ, σ, π ou λ) já vêm com os defaults do G*Power.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Usa o método de Demidenko (2007) com correção de variância — o
          mesmo padrão do G*Power 3.1 para regressão de Poisson. A variância de
          β̂₁ vem da informação de Fisher com peso µ(X) = exp(β0 + β1·X), e{" "}
          <code>n = v₁·(z_(1−α/2) + z_(1−β)·s₁)² / (β1²·(1 − R²))</code>.
        </li>
        <li>
          Reproduz o G*Power exatamente: RR = 1,3, taxa basal = 0,85, X ~
          Normal(0, 1), α = 0,05 bilateral, poder = 0,80, R² = 0 → 130 sujeitos
          (poder real 0,8012).
        </li>
        <li>
          A distribuição do preditor (Normal, Binomial, Exponencial, Lognormal
          ou Poisson) deve refletir o formato real de X; mantenha Normal para o
          caso padrão.
        </li>
        <li>
          Pressupõe contagens Poisson (média igual à variância); havendo
          superdispersão, o n calculado é otimista — considere inflá-lo.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> o suporte social prevê o número de recaídas em
        um ano, RR esperada = 1,3 e taxa basal = 0,85, com preditor Normal. Com
        α = 0,05 bilateral, poder = 0,80 e R² = 0, são necessários{" "}
        <strong>130 sujeitos</strong>.
      </p>
    ),
    references: [
      GPOWER_REF,
      "Demidenko, E. (2007). Sample size determination for logistic regression revisited. Statistics in Medicine, 26(18), 3385–3397.",
      "Signorini, D. F. (1991). Sample size for Poisson regression. Biometrika, 78(2), 446–450.",
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // POR PODER — Proporções avançadas
  // ─────────────────────────────────────────────────────────────
  "proportion-one-sample": {
    title: "Proporção única (uma amostra)",
    summary: (
      <p>
        Testa se <strong>uma proporção observada</strong> difere de um valor de
        referência conhecido. A hipótese nula afirma que a proporção
        populacional é igual ao valor de referência.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito h (Cohen)",
        description:
          "Mede a distância entre a proporção esperada e o valor de referência em uma escala transformada que faz o n depender apenas do tamanho de efeito. Pequeno: 0,20; Médio: 0,50; Grande: 0,80.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          O n depende do tamanho de efeito h. Para h ≈ 0,30 (ex.: 0,65 contra
          0,50) com α = 0,05 e poder = 0,80: ~85 sujeitos.
        </li>
        <li>
          A mesma diferença em pontos percentuais gera h diferente conforme a
          região, então calcule h a partir das proporções concretas.
        </li>
        <li>
          Para amostras muito pequenas ou proporções perto de 0/1, prefira o
          teste binomial exato.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> a taxa de aprovação esperada (65%) difere da
        meta de 50%? h ≈ 0,30. Com α = 0,05 bilateral e poder = 0,80, são
        necessários <strong>~85 sujeitos</strong>.
      </p>
    ),
    references: [COHEN_REF, COHEN_PRIMER_REF, GPOWER_REF],
  },

  "sign-test": {
    title: "Teste do sinal (dados pareados)",
    summary: (
      <p>
        Para dados <strong>pareados</strong>, testa apenas a <strong>direção</strong>{" "}
        da diferença (melhorou/piorou), sem assumir magnitude. A hipótese nula
        afirma que metade das diferenças é positiva, ou seja, que melhoras e
        pioras são igualmente prováveis.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito g",
        description:
          "Mede o quanto a proporção esperada de sinais positivos se afasta de 0,50. Pequeno: 0,05; Médio: 0,15; Grande: 0,25.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Tratado como teste de uma proporção contra 0,50. Para
          g = 0,15 (p = 0,65) com α = 0,05 e poder = 0,80: ~85 pares.
        </li>
        <li>
          O n refere-se a pares com diferença <strong>não-nula</strong>; empates
          são descartados, então colete mais pares se empates forem prováveis.
        </li>
        <li>
          É o menos potente dos testes pareados; com dados ordinais, o Wilcoxon
          pareado é mais econômico.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> pacientes melhoram após o tratamento? Espera-se
        65% de melhoras (g = 0,15). Com α = 0,05 bilateral e poder = 0,80, são
        necessários <strong>~85 pares</strong> (com diferença não-nula).
      </p>
    ),
    references: [
      COHEN_REF,
      "Siegel, S., & Castellan, N. J. (1988). Nonparametric Statistics for the Behavioral Sciences (2nd ed.). McGraw-Hill.",
      GPOWER_REF,
    ],
  },

  "fisher-exact": {
    title: "Teste exato de Fisher (tabela 2×2) — aproximação normal",
    summary: (
      <p>
        Associação entre duas variáveis dicotômicas em tabela 2×2 quando as{" "}
        <strong>frequências esperadas são pequenas</strong> (&lt; 5). A hipótese
        nula afirma que as duas variáveis são independentes.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito w (Cohen)",
        description:
          "Mede a força da associação entre as duas variáveis na tabela. Pequeno: 0,10; Médio: 0,30; Grande: 0,50.",
      },
      {
        name: "Razão de alocação",
        description:
          "Razão entre os tamanhos dos dois grupos. Geralmente 1 (grupos iguais).",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          <strong>Aproximação normal:</strong> esta calculadora não faz o
          cálculo exato do Fisher. O poder é aproximado pelo teste z para
          tabela 2×2 (equivalente ao χ² com 1 gl): poder = P(|Z + δ| &gt; z₁₋α/₂),
          com δ = w·√(N/1,15). O fator 1,15 infla o N em 15% para refletir o
          conservadorismo do teste exato.
        </li>
        <li>
          O G*Power calcula o Fisher por enumeração exata, então os valores
          daqui podem diferir dos dele. Para um planejamento final com amostras
          pequenas, confirme no G*Power ou por simulação.
        </li>
        <li>
          Para w = 0,50 (grande) com α = 0,05 e poder = 0,80: ~37 no total. Para
          w = 0,30 (médio): ~101.
        </li>
        <li>
          Use quando as frequências esperadas são pequenas; com amostras grandes,
          o qui-quadrado 2×2 é suficiente e mais econômico.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> estudo-piloto sobre associação entre tratamento
        e cura com poucos participantes, efeito grande (w = 0,50). Com α = 0,05 e
        poder = 0,80, são necessários <strong>~37 participantes no total</strong>.
      </p>
    ),
    references: [
      COHEN_REF,
      "Fisher, R. A. (1935). The logic of inductive inference. Journal of the Royal Statistical Society, 98(1), 39–82.",
      GPOWER_REF,
    ],
  },

  "mcnemar": {
    title: "Teste de McNemar (proporções pareadas)",
    summary: (
      <p>
        Compara <strong>proporções pareadas</strong> medidas em duas
        condições/momentos nos mesmos sujeitos (antes/depois), analisando apenas
        os pares <strong>discordantes</strong>. A hipótese nula afirma que as
        proporções nas duas condições são iguais.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito g",
        description:
          "Entre os pares discordantes, desvio esperado da proporção em uma direção em relação a 0,50 (g = |p − 0,5|). Pequeno: 0,05; Médio: 0,15; Grande: 0,25.",
      },
      ...COMMON_POWER_PARAMS,
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          O cálculo assume que <strong>50% dos pares são discordantes</strong>;
          o resultado é o total de pares.
        </li>
        <li>
          Para g = 0,15 com α = 0,05 e poder = 0,80: ~170 pares. Para g = 0,25:
          ~58 pares.
        </li>
        <li>
          Se a discordância esperada for menor que 50%, o total de pares precisa
          ser bem maior: divida os discordantes pela proporção real prevista.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> a opinião dos eleitores mudou após um debate
        (mesmos respondentes antes e depois)? Efeito pequeno (g = 0,15). Com
        α = 0,05 bilateral e poder = 0,80, são necessários{" "}
        <strong>~170 pares</strong>.
      </p>
    ),
    references: [
      COHEN_REF,
      "McNemar, Q. (1947). Note on the sampling error of the difference between correlated proportions or percentages. Psychometrika, 12(2), 153–157.",
      GPOWER_REF,
    ],
  },

  "goodness-of-fit": {
    title: "Qui-quadrado de aderência (goodness-of-fit)",
    summary: (
      <p>
        Testa se a distribuição observada de uma variável categórica difere de
        uma distribuição esperada (teórica). A hipótese nula afirma que as
        frequências observadas seguem as proporções esperadas.
      </p>
    ),
    parameters: [
      {
        name: "Tamanho de efeito w (Cohen)",
        description:
          "Mede o quanto a distribuição observada se afasta da distribuição esperada. Pequeno: 0,10; Médio: 0,30; Grande: 0,50.",
      },
      {
        name: "Graus de liberdade",
        description:
          "df = (número de categorias) − 1. Mais categorias elevam o valor crítico e, portanto, o n necessário.",
      },
      ...COMMON_POWER_PARAMS.filter((p) => p.name !== "Caudas"),
    ],
    guidelines: (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          O poder cresce com o tamanho de efeito, com o n e diminui com o
          número de categorias, usando a distribuição qui-quadrado.
        </li>
        <li>
          Para w = 0,30 (médio), 4 categorias (df = 3), α = 0,05 e poder = 0,80:
          ~122 no total.
        </li>
        <li>
          O qui-quadrado não tem "caudas": é unilateral por construção. Mantenha
          frequências esperadas ≥ 5 por categoria.
        </li>
      </ul>
    ),
    example: (
      <p className="text-sm">
        <strong>Cenário:</strong> verificar se a preferência por 4 sabores se
        distribui igualmente (25% cada), efeito médio (w = 0,30, df = 3). Com
        α = 0,05 e poder = 0,80, são necessários{" "}
        <strong>~122 participantes no total</strong>.
      </p>
    ),
    references: [COHEN_REF, COHEN_PRIMER_REF, GPOWER_REF],
  },
};

export const DEFAULT_SAMPLE_SIZE_INFO: SampleSizeInfo = {
  title: "Documentação em preparação",
  summary: (
    <p>
      A documentação detalhada deste procedimento ainda está sendo escrita.
      Use os tooltips de cada campo (ícone <strong>ⓘ</strong>) para
      orientações sobre os parâmetros individuais.
    </p>
  ),
  parameters: COMMON_POWER_PARAMS,
  guidelines: (
    <p className="text-sm">
      Em geral: defina α = 0,05, poder = 0,80, e o tamanho de efeito mínimo
      clinicamente relevante para o seu campo. Quando em dúvida, consulte
      revisões da literatura específica do procedimento ou use os benchmarks
      de Cohen (1988) como ponto de partida conservador.
    </p>
  ),
  example: (
    <p className="text-sm text-muted-foreground">
      Exemplo específico em preparação. Por ora, valide seus parâmetros
      contra software de referência (G*Power 3.1) antes de comprometer
      recursos.
    </p>
  ),
  references: [COHEN_REF, COHEN_PRIMER_REF, GPOWER_REF],
};

export function getSampleSizeInfo(id: string): SampleSizeInfo {
  return SAMPLE_SIZE_INFO[id] ?? DEFAULT_SAMPLE_SIZE_INFO;
}
