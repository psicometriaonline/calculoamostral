import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Ruler, Calculator, Info, AlertTriangle, HelpCircle, History, Save, Trash2, FileDown, BookOpen } from "lucide-react";
import { CalculadoraTipoSelector } from "@/components/CalculadoraAmostralTabs";
import { SampleSizeInfoModal } from "@/components/SampleSizeInfoModal";
import { getSampleSizeInfo } from "@/lib/sampleSizeInfo";
import type { SampleSizePrecisionCalculation } from "@shared/schema";
import EffectSizeRatingWidget, { logEffectSizeCalculation } from "@/components/tools/EffectSizeRatingWidget";

type PrecisionMode = "absolute" | "relative";

interface PrecisionResult {
  procedureType: string;
  zUsed: number;
  n0: number;
  nFinite: number | null;
  nAdjusted: number | null;
  n1?: number;
  n2?: number;
  formula: { n0: string; nFinite?: string; nAdjusted?: string };
  warnings: string[];
  tRefinement?: {
    tUsed: number;
    dfUsed: number;
    iterations: number;
    converged: boolean;
  } | null;
  input: {
    prevalenceP?: number;
    sigmaSD?: number;
    meanMu?: number | null;
    sigma1?: number;
    sigma2?: number;
    sigmaMode?: "pooled" | "separate";
    p1?: number;
    p2?: number;
    allocationRatio?: number | null;
    marginD: number;
    confidenceLevel: number;
    precisionMode: PrecisionMode;
    populationN?: number | null;
    nonResponseRate?: number | null;
    useTDistribution?: boolean | null;
  };
}

const PROCEDIMENTOS = [
  { id: "prevalence-cochran", label: "Estimação de uma proporção (Cochran)", available: true },
  { id: "mean-population", label: "Média populacional", available: true },
  { id: "diff-proportions", label: "Diferença de proporções", available: true },
  { id: "diff-means", label: "Diferença de médias", available: true },
];

function procedureLabel(id: string): string {
  return PROCEDIMENTOS.find((p) => p.id === id)?.label ?? id;
}

export default function PrecisaoAmostral() {
  const { toast } = useToast();
  const [procedimento, setProcedimento] = useState("prevalence-cochran");
  const [confianca, setConfianca] = useState("95");
  const [margemErro, setMargemErro] = useState("0.05");
  const [propEsperada, setPropEsperada] = useState("0.5");
  const [desvioPadrao, setDesvioPadrao] = useState("");
  const [mediaEsperada, setMediaEsperada] = useState("");
  const [sigmaMode, setSigmaMode] = useState<"pooled" | "separate">("pooled");
  const [sigma1, setSigma1] = useState("");
  const [sigma2, setSigma2] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [allocationRatio, setAllocationRatio] = useState("1");
  const [precisionMode, setPrecisionMode] = useState<PrecisionMode>("absolute");
  const [useTDistribution, setUseTDistribution] = useState(false);
  const [populacao, setPopulacao] = useState("");
  const [naoResposta, setNaoResposta] = useState("");
  const [result, setResult] = useState<PrecisionResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const info = getSampleSizeInfo(procedimento);

  // Histórico
  const { data: history } = useQuery<SampleSizePrecisionCalculation[]>({
    queryKey: ["/api/sample-size-precision/history"],
  });

  const calcMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/sample-size-precision/calculate", payload);
      return (await res.json()) as PrecisionResult;
    },
    onSuccess: (data) => {
      setResult(data);
      logEffectSizeCalculation('precisao_amostral');
      toast({ title: "✓ Cálculo concluído", description: "Resultados exibidos à direita" });
    },
    onError: (err: any) => {
      toast({ title: "Erro no cálculo", description: err?.message ?? "Verifique os parâmetros.", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/sample-size-precision/save", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sample-size-precision/history"] });
      toast({ title: "✓ Salvo", description: "Cálculo salvo no histórico" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err?.message ?? "Tente novamente.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sample-size-precision/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sample-size-precision/history"] });
      toast({ title: "✓ Removido", description: "Cálculo removido do histórico" });
    },
  });

  const handleCalculate = () => {
    const isPositiveNumber = (s: string) => {
      const v = parseFloat(s);
      return Number.isFinite(v) && v > 0;
    };
    const erro = (msg: string) => {
      toast({ title: "Preencha os campos obrigatórios", description: msg, variant: "destructive" });
    };

    if (!isPositiveNumber(margemErro)) {
      erro("Informe a margem de erro (E) — um número maior que zero.");
      return;
    }

    if (procedimento === "mean-population") {
      if (!isPositiveNumber(desvioPadrao)) {
        erro("Informe o desvio-padrão (σ) — um número maior que zero.");
        return;
      }
      if (precisionMode === "relative") {
        const mu = parseFloat(mediaEsperada);
        if (!Number.isFinite(mu) || mu === 0) {
          erro("No modo relativo, informe a média esperada (μ) diferente de zero.");
          return;
        }
      }
    } else if (procedimento === "diff-means") {
      if (sigmaMode === "separate") {
        if (!isPositiveNumber(sigma1) || !isPositiveNumber(sigma2)) {
          erro("Informe os desvios-padrão dos dois grupos (σ₁ e σ₂) — números maiores que zero.");
          return;
        }
      } else if (!isPositiveNumber(desvioPadrao)) {
        erro("Informe o desvio-padrão comum (σ) — um número maior que zero.");
        return;
      }
    } else if (procedimento === "diff-proportions") {
      const pp1 = parseFloat(p1);
      const pp2 = parseFloat(p2);
      if (!Number.isFinite(pp1) || pp1 <= 0 || pp1 >= 1) {
        erro("Informe a proporção esperada do grupo 1 (p₁) — um número entre 0 e 1.");
        return;
      }
      if (!Number.isFinite(pp2) || pp2 <= 0 || pp2 >= 1) {
        erro("Informe a proporção esperada do grupo 2 (p₂) — um número entre 0 e 1.");
        return;
      }
    } else {
      const p = parseFloat(propEsperada);
      if (!Number.isFinite(p) || p <= 0 || p >= 1) {
        erro("Informe a proporção esperada (P) — um número entre 0 e 1.");
        return;
      }
    }

    if ((procedimento === "diff-means" || procedimento === "diff-proportions") && allocationRatio.trim()) {
      const kk = parseFloat(allocationRatio);
      if (!Number.isFinite(kk) || kk <= 0) {
        erro("A razão de alocação (k = n₂/n₁) deve ser um número maior que zero.");
        return;
      }
    }

    if (populacao.trim()) {
      const pop = parseInt(populacao, 10);
      if (!Number.isInteger(pop) || pop <= 0) {
        erro("O tamanho da população deve ser um número inteiro maior que zero.");
        return;
      }
    }

    if (naoResposta.trim()) {
      const nr = parseFloat(naoResposta);
      if (!Number.isFinite(nr) || nr < 0 || nr >= 1) {
        erro("A taxa de não-resposta deve ser um número entre 0 e 0,99 (ex.: 0.20).");
        return;
      }
    }

    const payload: any = {
      procedureType: procedimento,
      marginD: parseFloat(margemErro),
      confidenceLevel: parseFloat(confianca),
      precisionMode,
    };
    if (procedimento === "mean-population") {
      payload.sigmaSD = parseFloat(desvioPadrao);
      if (precisionMode === "relative" && mediaEsperada.trim()) {
        payload.meanMu = parseFloat(mediaEsperada);
      }
      if (useTDistribution) payload.useTDistribution = true;
    } else if (procedimento === "diff-means") {
      payload.precisionMode = "absolute";
      payload.sigmaMode = sigmaMode;
      if (sigmaMode === "separate") {
        payload.sigma1 = parseFloat(sigma1);
        payload.sigma2 = parseFloat(sigma2);
      } else {
        payload.sigmaSD = parseFloat(desvioPadrao);
      }
      if (useTDistribution) payload.useTDistribution = true;
      if (allocationRatio.trim()) payload.allocationRatio = parseFloat(allocationRatio);
    } else if (procedimento === "diff-proportions") {
      payload.precisionMode = "absolute";
      payload.p1 = parseFloat(p1);
      payload.p2 = parseFloat(p2);
      if (allocationRatio.trim()) payload.allocationRatio = parseFloat(allocationRatio);
    } else {
      payload.prevalenceP = parseFloat(propEsperada);
    }
    if (populacao.trim()) payload.populationN = parseInt(populacao, 10);
    if (naoResposta.trim()) payload.nonResponseRate = parseFloat(naoResposta);
    calcMutation.mutate(payload);
  };

  const handleLimpar = () => {
    setConfianca("95");
    setPrecisionMode("absolute");
    setPopulacao("");
    setNaoResposta("");
    setResult(null);
    if (procedimento === "mean-population") {
      setMargemErro("");
      setDesvioPadrao("");
      setMediaEsperada("");
      setUseTDistribution(false);
    } else if (procedimento === "diff-means") {
      setMargemErro("");
      setDesvioPadrao("");
      setSigma1("");
      setSigma2("");
      setSigmaMode("pooled");
      setUseTDistribution(false);
      setAllocationRatio("1");
    } else if (procedimento === "diff-proportions") {
      setMargemErro("0.05");
      setP1("");
      setP2("");
      setAllocationRatio("1");
    } else {
      setMargemErro("0.05");
      setPropEsperada("0.5");
    }
  };

  const handleSave = () => {
    if (!result) return;
    const payload = {
      procedureType: result.procedureType,
      inputParameters: {
        prevalenceP: result.input.prevalenceP ?? null,
        sigmaSD: result.input.sigmaSD ?? null,
        meanMu: result.input.meanMu ?? null,
        sigma1: result.input.sigma1 ?? null,
        sigma2: result.input.sigma2 ?? null,
        sigmaMode: result.input.sigmaMode ?? null,
        p1: result.input.p1 ?? null,
        p2: result.input.p2 ?? null,
        allocationRatio: result.input.allocationRatio ?? null,
        marginD: result.input.marginD,
        confidenceLevel: result.input.confidenceLevel,
        precisionMode: result.input.precisionMode,
        populationN: result.input.populationN ?? null,
        nonResponseRate: result.input.nonResponseRate ?? null,
        useTDistribution: result.input.useTDistribution ?? null,
        formula: result.formula,
        warnings: result.warnings,
        tRefinement: result.tRefinement ?? null,
      },
      n0: result.n0,
      nFinite: result.nFinite,
      nAdjusted: result.nAdjusted,
      zUsed: String(result.zUsed),
    };
    saveMutation.mutate(payload);
  };

  const handleDownloadTXT = () => {
    if (!result) return;

    const inp = result.input;
    const procType = result.procedureType;
    const isTwoGroup = procType === "diff-means" || procType === "diff-proportions";

    const procedureReferences =
      procType === "mean-population"
        ? [
            "Cochran, W. G. (1977). Sampling Techniques (3rd ed.). Wiley.",
            "Daniel, W. W. (1999). Biostatistics: A Foundation for Analysis in the Health Sciences (7th ed.). Wiley.",
          ]
        : procType === "diff-means" || procType === "diff-proportions"
        ? [
            "Daniel, W. W. (1999). Biostatistics: A Foundation for Analysis in the Health Sciences (7th ed.). Wiley.",
            "Rosner, B. (2015). Fundamentals of Biostatistics (8th ed.). Cengage.",
          ]
        : [
            "Cochran, W. G. (1977). Sampling Techniques (3rd ed.). Wiley.",
            "Lwanga, S. K., & Lemeshow, S. (1991). Sample size determination in health studies. WHO.",
          ];

    const lines: string[] = [];
    lines.push("# Cálculo Amostral por Precisão de Estimativa");
    lines.push("");
    lines.push(`Procedimento: ${procedureLabel(procType)}`);
    lines.push(`Modo de precisão: ${inp.precisionMode === "relative" ? "Relativa" : "Absoluta"}`);
    lines.push("");

    // Input parameters
    lines.push("## Parâmetros de entrada");
    lines.push(`Nível de confiança: ${inp.confidenceLevel}%`);
    lines.push(`Margem de erro (${inp.precisionMode === "relative" ? "relativa" : "absoluta"}): ${inp.marginD}`);
    if (inp.prevalenceP !== undefined && inp.prevalenceP !== null) {
      lines.push(`Proporção esperada (p): ${inp.prevalenceP}`);
    }
    if (inp.sigmaSD !== undefined && inp.sigmaSD !== null) {
      lines.push(`Desvio-padrão (σ): ${inp.sigmaSD}`);
    }
    if (inp.meanMu !== undefined && inp.meanMu !== null) {
      lines.push(`Média esperada (μ): ${inp.meanMu}`);
    }
    if (inp.sigmaMode) {
      lines.push(`Desvios-padrão: ${inp.sigmaMode === "pooled" ? "Combinado (pooled)" : "Separados por grupo"}`);
    }
    if (inp.sigma1 !== undefined && inp.sigma1 !== null) {
      lines.push(`Desvio-padrão grupo 1 (σ₁): ${inp.sigma1}`);
    }
    if (inp.sigma2 !== undefined && inp.sigma2 !== null) {
      lines.push(`Desvio-padrão grupo 2 (σ₂): ${inp.sigma2}`);
    }
    if (inp.p1 !== undefined && inp.p1 !== null) {
      lines.push(`Proporção grupo 1 (p₁): ${inp.p1}`);
    }
    if (inp.p2 !== undefined && inp.p2 !== null) {
      lines.push(`Proporção grupo 2 (p₂): ${inp.p2}`);
    }
    if (isTwoGroup && inp.allocationRatio !== undefined && inp.allocationRatio !== null) {
      lines.push(`Razão de alocação (n₂/n₁): ${inp.allocationRatio}`);
    }
    if (inp.useTDistribution) {
      lines.push(`Distribuição t de Student: sim (refinamento iterativo)`);
    }
    if (inp.populationN !== undefined && inp.populationN !== null) {
      lines.push(`Tamanho da população (N): ${inp.populationN}`);
    }
    if (inp.nonResponseRate !== undefined && inp.nonResponseRate !== null) {
      lines.push(`Taxa de não-resposta: ${inp.nonResponseRate}`);
    }
    lines.push("");

    // Results (mirrors the on-screen panel)
    lines.push("## Resultados");
    const finalNValue = result.nAdjusted ?? result.nFinite ?? result.n0;
    if (isTwoGroup) {
      const bn1 = result.n1 ?? finalNValue;
      const bn2 = result.n2 ?? finalNValue;
      lines.push(`Tamanho amostral grupo 1 (n₁): ${bn1}`);
      lines.push(`Tamanho amostral grupo 2 (n₂): ${bn2}`);
      lines.push(`Tamanho amostral total: ${bn1 + bn2}`);
    } else {
      lines.push(`Tamanho amostral necessário: ${finalNValue}`);
    }
    lines.push("");

    lines.push("## Passos do cálculo");
    if (result.tRefinement) {
      lines.push(
        `Quantil t de Student: t = ${result.tRefinement.tUsed.toFixed(4)} (${Number.isInteger(result.tRefinement.dfUsed) ? result.tRefinement.dfUsed : result.tRefinement.dfUsed.toFixed(1)} g.l.)`,
      );
      lines.push(
        `Iterações até convergir: ${result.tRefinement.iterations} (${result.tRefinement.converged ? "convergiu" : "não convergiu"})`,
      );
    } else {
      lines.push(`Quantil z: z = ${result.zUsed.toFixed(4)}`);
    }
    lines.push("");
    lines.push(`1. Fórmula base (população infinita): ${result.formula.n0}`);
    lines.push(`   n₀ = ${result.n0}`);
    if (result.nFinite !== null && result.formula.nFinite) {
      lines.push(`2. Correção para população finita: ${result.formula.nFinite}`);
      lines.push(`   n = ${result.nFinite}`);
    }
    if (result.nAdjusted !== null && result.formula.nAdjusted) {
      lines.push(`3. Inflação por não-resposta: ${result.formula.nAdjusted}`);
      lines.push(`   n_ajust = ${result.nAdjusted}`);
    }
    lines.push("");

    // Warnings
    if (result.warnings?.length > 0) {
      lines.push("## Avisos");
      result.warnings.forEach((w) => lines.push(`- ${w}`));
      lines.push("");
    }

    // Citation & references
    lines.push("## Citação e Referência");
    lines.push("Como citar este aplicativo:");
    lines.push(
      `Psicometria Online Academy. (${new Date().getFullYear()}). Calculadora de Tamanho Amostral por Precisão de Estimativa [Software]. Recuperado de https://psicometriaonline.com.br/`,
    );
    lines.push("");
    lines.push("Referências:");
    procedureReferences.forEach((ref) => lines.push(ref));
    lines.push("");

    lines.push("---------------------------------------");
    lines.push(`Calculado em: ${new Date().toLocaleString()}`);
    lines.push("Ferramenta: Calculadora de Tamanho Amostral por Precisão - Psicometria Online Academy");

    const fileContent = lines.join("\n");
    const blob = new Blob([fileContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `precisao_amostral_${procType}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "✓ TXT baixado", description: "Relatório gerado com sucesso" });
  };

  const handleRestore = (calc: SampleSizePrecisionCalculation) => {
    const params: any = calc.inputParameters ?? {};
    setProcedimento(calc.procedureType);
    if (params.confidenceLevel != null) setConfianca(String(params.confidenceLevel));
    if (params.marginD != null) setMargemErro(String(params.marginD));
    if (params.prevalenceP != null) setPropEsperada(String(params.prevalenceP));
    setDesvioPadrao(params.sigmaSD != null ? String(params.sigmaSD) : "");
    setMediaEsperada(params.meanMu != null ? String(params.meanMu) : "");
    setSigma1(params.sigma1 != null ? String(params.sigma1) : "");
    setSigma2(params.sigma2 != null ? String(params.sigma2) : "");
    setSigmaMode((params.sigmaMode as "pooled" | "separate") ?? "pooled");
    setP1(params.p1 != null ? String(params.p1) : "");
    setP2(params.p2 != null ? String(params.p2) : "");
    setAllocationRatio(params.allocationRatio != null ? String(params.allocationRatio) : "1");
    if (params.precisionMode) setPrecisionMode(params.precisionMode as PrecisionMode);
    setUseTDistribution(params.useTDistribution === true);
    setPopulacao(params.populationN != null ? String(params.populationN) : "");
    setNaoResposta(params.nonResponseRate != null ? String(params.nonResponseRate) : "");

    const restoredFinalPerGroup = calc.nAdjusted ?? calc.nFinite ?? calc.n0;
    const restoredK = params.allocationRatio != null ? Number(params.allocationRatio) : 1;
    const isTwoGroupRestore = calc.procedureType === "diff-means" || calc.procedureType === "diff-proportions";
    const restored: PrecisionResult = {
      procedureType: calc.procedureType,
      zUsed: parseFloat(calc.zUsed) || 0,
      n0: calc.n0,
      nFinite: calc.nFinite ?? null,
      nAdjusted: calc.nAdjusted ?? null,
      n1: isTwoGroupRestore ? restoredFinalPerGroup : undefined,
      n2: isTwoGroupRestore ? Math.ceil(restoredK * restoredFinalPerGroup) : undefined,
      formula: params.formula ?? { n0: "" },
      warnings: params.warnings ?? [],
      tRefinement: params.tRefinement ?? null,
      input: {
        prevalenceP: params.prevalenceP ?? undefined,
        sigmaSD: params.sigmaSD ?? undefined,
        meanMu: params.meanMu ?? null,
        sigma1: params.sigma1 ?? undefined,
        sigma2: params.sigma2 ?? undefined,
        sigmaMode: (params.sigmaMode as "pooled" | "separate") ?? undefined,
        p1: params.p1 ?? undefined,
        p2: params.p2 ?? undefined,
        allocationRatio: params.allocationRatio ?? null,
        marginD: params.marginD ?? 0.05,
        confidenceLevel: params.confidenceLevel ?? 95,
        precisionMode: (params.precisionMode as PrecisionMode) ?? "absolute",
        populationN: params.populationN ?? null,
        nonResponseRate: params.nonResponseRate ?? null,
        useTDistribution: params.useTDistribution ?? null,
      },
    };
    setResult(restored);
    setHistoryOpen(false);
    toast({ title: "Cálculo restaurado", description: "Os parâmetros e resultados foram recuperados do histórico" });
  };

  const finalN = useMemo(() => {
    if (!result) return null;
    return result.nAdjusted ?? result.nFinite ?? result.n0;
  }, [result]);

  const procDef = PROCEDIMENTOS.find((p) => p.id === procedimento);

  return (
    <TooltipProvider>
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
      <div className="min-h-screen flex flex-col md:h-screen md:overflow-hidden">
        {/* Header */}
        <div className="border-b bg-background px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-start sm:items-center justify-between gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <Ruler className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <h1 className="sm:text-xl font-bold text-[24px]">Calculadora de Tamanho Amostral por Precisão</h1>
            </div>

            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-toggle-history">
                  <History className="w-4 h-4 mr-2" />
                  Histórico {history && history.length > 0 && `(${history.length})`}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>

          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleContent>
              <Card className="mt-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Cálculos Salvos</CardTitle>
                </CardHeader>
                <CardContent className="max-h-48 overflow-y-auto">
                  {history && history.length > 0 ? (
                    <div className="space-y-2">
                      {history.map((calc) => {
                        const params: any = calc.inputParameters ?? {};
                        const nFinal = calc.nAdjusted ?? calc.nFinite ?? calc.n0;
                        return (
                          <Card
                            key={calc.id}
                            className="p-2 hover-elevate cursor-pointer"
                            onClick={() => handleRestore(calc)}
                            data-testid={`card-calculation-${calc.id}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-0.5 min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {procedureLabel(calc.procedureType)}
                                </p>
                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  <span>n = {nFinal}</span>
                                  {params.confidenceLevel != null && <span>NC: {params.confidenceLevel}%</span>}
                                  {params.marginD != null && <span>d: {params.marginD}</span>}
                                  {params.prevalenceP != null && <span>P: {params.prevalenceP}</span>}
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
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-3">Nenhum cálculo salvo</p>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <CalculadoraTipoSelector />

        {/* Conteúdo principal — 2 colunas */}
        <div className="flex-1 md:overflow-hidden overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:h-full p-4">
            {/* ESQUERDA — Configuração */}
            <div className="md:overflow-y-auto">
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-base">Configuração</CardTitle>
                  <Button
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
                  <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                    <div className="flex items-center gap-1">
                      <Label className="text-sm">Procedimento</Label>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs text-xs">
                          Tipo de parâmetro populacional que você quer estimar com uma margem de erro definida (sem testar hipótese).<br /><br />
                          <strong>Prevalência (Cochran):</strong> ideal para surveys e estudos epidemiológicos que estimam uma única proporção, como taxa de adesão, prevalência de doença ou fração de respondentes a favor.<br /><br />
                          <strong>Média populacional:</strong> para estimar a média de uma variável numérica (escore, idade, tempo) com margem de erro definida, conhecendo o desvio-padrão esperado (σ).<br /><br />
                          <strong>Diferença de médias:</strong> para estimar a diferença entre as médias de dois grupos independentes (ex.: tratamento vs. controle) com margem de erro definida. Retorna o n por grupo (alocação igual).<br /><br />
                          <strong>Diferença de proporções:</strong> para estimar a diferença entre as proporções de dois grupos independentes (ex.: taxa de adesão de tratamento vs. controle) com margem de erro definida. Retorna o n por grupo (alocação igual).
                        </TooltipContent>
                      </UITooltip>
                    </div>
                    <Select value={procedimento} onValueChange={setProcedimento}>
                      <SelectTrigger data-testid="select-procedimento" className="h-8 w-full overflow-hidden">
                        <span className="truncate"><SelectValue /></span>
                      </SelectTrigger>
                      <SelectContent>
                        {PROCEDIMENTOS.map((p) => (
                          <SelectItem key={p.id} value={p.id} disabled={!p.available}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {procedimento === "prevalence-cochran" && (
                    <>
                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Nível de Confiança</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Probabilidade de o intervalo de confiança conter o valor populacional verdadeiro. Padrão: 95%.<br /><br />
                              Quanto maior o nível, maior o n necessário (em 95% o z é 1,96; em 99% o z é 2,5758).
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Select value={confianca} onValueChange={setConfianca}>
                          <SelectTrigger className="h-8 w-full" data-testid="select-confianca">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="90">90% (Z = 1.6449)</SelectItem>
                            <SelectItem value="95">95% (Z = 1.96)</SelectItem>
                            <SelectItem value="99">99% (Z = 2.5758)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Margem de Erro (d)</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Quanto o intervalo pode se afastar da estimativa pontual.<br /><br />
                              <strong>Absoluta:</strong> 0,05 = ±5 pontos percentuais (P ± d).<br />
                              <strong>Relativa:</strong> 0,20 = ±20% do valor estimado (P ± d·P), útil quando P é pequeno.<br /><br />
                              Quanto menor a margem, maior o n.<br /><br />
                              Atenção: com P baixo (abaixo de ~5%), a margem absoluta gera um n pequeno e enganoso — o estudo quase não observa eventos. Garanta pelo menos ~5 (idealmente 10) eventos esperados (n ≥ 5/P) e prefira a margem relativa.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" step="0.01" min="0.001" max="0.99"
                          className="h-8"
                          value={margemErro}
                          onChange={(e) => setMargemErro(e.target.value)}
                          data-testid="input-margem"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Modo de precisão</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Como a margem de erro é interpretada.<br /><br />
                              <strong>Absoluta:</strong> d em pontos percentuais (P ± d). Padrão para a maioria dos surveys.<br /><br />
                              <strong>Relativa:</strong> d como fração do próprio P (P ± d·P). Útil quando a prevalência esperada é pequena: ±5 pp em torno de 2% não faz sentido, mas ±20% relativo (=0,4 pp) sim.<br /><br />
                              Em eventos raros, garanta ~5 (idealmente 10) eventos esperados (n ≥ 5/P) ou planeje pelo número de eventos: m = (z/ε)², n = m/P. Relate o intervalo por Wilson ou Clopper-Pearson, nunca por Wald.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Select value={precisionMode} onValueChange={(v) => setPrecisionMode(v as PrecisionMode)}>
                          <SelectTrigger className="h-8 w-full" data-testid="select-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="absolute">Absoluta</SelectItem>
                            <SelectItem value="relative">Relativa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Label className="text-sm">Proporção Esperada (P)</Label>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs text-xs">
                                Sua melhor estimativa, antes do estudo, da proporção que será encontrada na população (entre 0 e 1).<br /><br />
                                Se não tem ideia, use <strong>0,50</strong>, que é o valor que exige a maior amostra e funciona como cenário conservador.
                              </TooltipContent>
                            </UITooltip>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold tabular-nums" data-testid="prop-value">{propEsperada}</span>
                            <Button variant="ghost" size="sm" onClick={() => setPropEsperada("0.5")} data-testid="btn-conservador">
                              Usar 0,50
                            </Button>
                          </div>
                        </div>
                        <Slider
                          value={[parseFloat(propEsperada) || 0.5]}
                          min={0.01} max={0.99} step={0.01}
                          onValueChange={(v) => setPropEsperada(v[0].toString())}
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center pt-2 border-t">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">População (N)</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Tamanho total da população de onde a amostra será retirada (opcional).<br /><br />
                              Quando preenchido, aplica a correção para população finita: n = n₀ / (1 + (n₀−1)/N), reduzindo o n necessário.<br /><br />
                              Para N &gt; 10.000 a correção tem efeito menor que 4% e geralmente pode ser omitida.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" min="1" className="h-8"
                          placeholder="Opcional (em branco = infinita)"
                          value={populacao}
                          onChange={(e) => setPopulacao(e.target.value)}
                          data-testid="input-populacao"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Não-resposta</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Fração esperada de participantes que serão recrutados mas não fornecerão dado utilizável (entre 0 e 0,99; ex.: 0,20 = 20%).<br /><br />
                              O n final é dividido por (1 − NR) para garantir que, após as perdas, o n efetivo continue suficiente.<br /><br />
                              Para NR ≥ 50% o n praticamente dobra, então revise o desenho do estudo.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" step="0.01" min="0" max="0.99" className="h-8"
                          placeholder="Opcional (ex.: 0.20 = 20%)"
                          value={naoResposta}
                          onChange={(e) => setNaoResposta(e.target.value)}
                          data-testid="input-nr"
                        />
                      </div>

                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          onClick={handleCalculate}
                          disabled={calcMutation.isPending}
                          className="flex-1"
                          data-testid="btn-calcular"
                        >
                          <Calculator className="w-4 h-4 mr-2" />
                          {calcMutation.isPending ? "Calculando..." : "Calcular"}
                        </Button>
                        <Button variant="ghost" onClick={handleLimpar} data-testid="btn-limpar">
                          Limpar
                        </Button>
                      </div>
                    </>
                  )}

                  {procedimento === "mean-population" && (
                    <>
                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Nível de Confiança</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Probabilidade de o intervalo de confiança conter a média populacional verdadeira. Padrão: 95%.<br /><br />
                              Quanto maior o nível, maior o n necessário (em 95% o z é 1,96; em 99% o z é 2,5758).
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Select value={confianca} onValueChange={setConfianca}>
                          <SelectTrigger className="h-8 w-full" data-testid="select-confianca-media">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="90">90% (Z = 1.6449)</SelectItem>
                            <SelectItem value="95">95% (Z = 1.96)</SelectItem>
                            <SelectItem value="99">99% (Z = 2.5758)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Modo de precisão</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Como a margem de erro é interpretada.<br /><br />
                              <strong>Absoluta:</strong> a margem (E) é dada na mesma escala da variável (ex.: ±2 pontos de QI). Padrão para a maioria dos estudos.<br /><br />
                              <strong>Relativa:</strong> a margem é uma fração da própria média μ (ex.: 0,05 = ±5% de μ). Exige informar μ e equivale a usar o coeficiente de variação (σ/μ).
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Select value={precisionMode} onValueChange={(v) => setPrecisionMode(v as PrecisionMode)}>
                          <SelectTrigger className="h-8 w-full" data-testid="select-mode-media">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="absolute">Absoluta</SelectItem>
                            <SelectItem value="relative">Relativa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">{precisionMode === "absolute" ? "Margem de erro (E)" : "Margem relativa (ε)"}</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Semilargura do intervalo de confiança que você tolera.<br /><br />
                              <strong>Absoluta:</strong> E na mesma escala da variável (ex.: E = 2 = "tolero ± 2 unidades em torno da média").<br />
                              <strong>Relativa:</strong> ε como fração de μ (ex.: 0,05 = ± 5% de μ).<br /><br />
                              Quanto menor a margem, maior o n (n cresce com 1/E²).
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" step="any" min="0"
                          className="h-8"
                          placeholder={precisionMode === "absolute" ? "ex.: 2" : "ex.: 0.05"}
                          value={margemErro}
                          onChange={(e) => setMargemErro(e.target.value)}
                          data-testid="input-margem-media"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Desvio-padrão (σ)</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Variabilidade esperada da variável na população, na mesma escala da média.<br /><br />
                              Use um valor de estudo-piloto, da literatura ou de dados históricos. Se só houver a amplitude (máx − mín), uma aproximação grosseira é amplitude / 4.<br /><br />
                              Quanto maior σ, maior o n (n cresce com σ²).
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" step="any" min="0"
                          className="h-8"
                          placeholder="ex.: 10"
                          value={desvioPadrao}
                          onChange={(e) => setDesvioPadrao(e.target.value)}
                          data-testid="input-sigma"
                        />
                      </div>

                      {precisionMode === "relative" && (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label className="text-sm">Média esperada (μ)</Label>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs text-xs">
                                Sua melhor estimativa, antes do estudo, da média que será encontrada na população.<br /><br />
                                Necessária apenas no modo relativo: a margem passa a ser ε·μ, e o cálculo usa o coeficiente de variação σ/μ.
                              </TooltipContent>
                            </UITooltip>
                          </div>
                          <Input
                            type="number" step="any"
                            className="h-8"
                            placeholder="ex.: 50"
                            value={mediaEsperada}
                            onChange={(e) => setMediaEsperada(e.target.value)}
                            data-testid="input-mu"
                          />
                        </div>
                      )}

                      <div className="flex items-start gap-2 pt-2 border-t">
                        <Checkbox
                          id="check-t-refinement"
                          checked={useTDistribution}
                          onCheckedChange={(v) => setUseTDistribution(v === true)}
                          className="mt-0.5"
                          data-testid="check-t-refinement"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="check-t-refinement" className="text-sm cursor-pointer">
                              Refinar com distribuição t (amostras pequenas)
                            </Label>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs text-xs">
                                Por padrão, o cálculo usa o quantil normal z, que subestima levemente o n quando a amostra é pequena (n &lt; ~30) e σ foi estimado de um piloto.<br /><br />
                                Marcando esta opção, o n₀ é recalculado iterando o quantil t de Student com (n−1) graus de liberdade até convergir — mais preciso para estudos pequenos. Para amostras grandes a diferença é desprezível.
                              </TooltipContent>
                            </UITooltip>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Aumenta levemente o n para corrigir a aproximação normal em amostras pequenas.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center pt-2 border-t">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">População (N)</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Tamanho total da população de onde a amostra será retirada (opcional).<br /><br />
                              Quando preenchido, aplica a correção para população finita: n = n₀ / (1 + (n₀−1)/N), reduzindo o n necessário.<br /><br />
                              Para N &gt; 10.000 a correção tem efeito menor que 4% e geralmente pode ser omitida.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" min="1" className="h-8"
                          placeholder="Opcional (em branco = infinita)"
                          value={populacao}
                          onChange={(e) => setPopulacao(e.target.value)}
                          data-testid="input-populacao-media"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Não-resposta</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Fração esperada de participantes que serão recrutados mas não fornecerão dado utilizável (entre 0 e 0,99; ex.: 0,20 = 20%).<br /><br />
                              O n final é dividido por (1 − NR) para garantir que, após as perdas, o n efetivo continue suficiente.<br /><br />
                              Para NR ≥ 50% o n praticamente dobra, então revise o desenho do estudo.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" step="0.01" min="0" max="0.99" className="h-8"
                          placeholder="Opcional (ex.: 0.20 = 20%)"
                          value={naoResposta}
                          onChange={(e) => setNaoResposta(e.target.value)}
                          data-testid="input-nr-media"
                        />
                      </div>

                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          onClick={handleCalculate}
                          disabled={calcMutation.isPending}
                          className="flex-1"
                          data-testid="btn-calcular-media"
                        >
                          <Calculator className="w-4 h-4 mr-2" />
                          {calcMutation.isPending ? "Calculando..." : "Calcular"}
                        </Button>
                        <Button variant="ghost" onClick={handleLimpar} data-testid="btn-limpar-media">
                          Limpar
                        </Button>
                      </div>
                    </>
                  )}

                  {procedimento === "diff-proportions" && (
                    <>
                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Nível de Confiança</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Probabilidade de o intervalo de confiança conter a diferença verdadeira entre as duas proporções. Padrão: 95%.<br /><br />
                              Quanto maior o nível, maior o n necessário (em 95% o z é 1,96; em 99% o z é 2,5758).
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Select value={confianca} onValueChange={setConfianca}>
                          <SelectTrigger className="h-8 w-full" data-testid="select-confianca-diff-proportions">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="90">90% (Z = 1.6449)</SelectItem>
                            <SelectItem value="95">95% (Z = 1.96)</SelectItem>
                            <SelectItem value="99">99% (Z = 2.5758)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Margem de erro (E)</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Semilargura do intervalo de confiança que você tolera para a <strong>diferença entre as duas proporções</strong>, em pontos de proporção (ex.: E = 0,10 = "tolero ± 10 pontos percentuais em torno da diferença observada").<br /><br />
                              Quanto menor a margem, maior o n (n cresce com 1/E²).<br /><br />
                              Atenção: se p₁ ou p₂ for baixo (abaixo de ~5%), a margem absoluta gera um n pequeno e enganoso. Garanta ~5 (idealmente 10) eventos esperados por grupo e planeje pelo número de eventos: m = (z/ε)², n = m/p. Relate cada proporção por Wilson ou Clopper-Pearson, não por Wald.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" step="any" min="0"
                          className="h-8"
                          placeholder="ex.: 0.10"
                          value={margemErro}
                          onChange={(e) => setMargemErro(e.target.value)}
                          data-testid="input-margem-diff-proportions"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Proporção grupo 1 (p₁)</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Proporção esperada no primeiro grupo, entre 0 e 1 (ex.: 0,30 = 30%).<br /><br />
                              Use um valor de estudo-piloto, da literatura ou histórico. Na maior incerteza, p próximo de 0,5 maximiza a variância e o n (escolha conservadora).
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" step="any" min="0" max="1"
                          className="h-8"
                          placeholder="ex.: 0.5"
                          value={p1}
                          onChange={(e) => setP1(e.target.value)}
                          data-testid="input-p1"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Proporção grupo 2 (p₂)</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Proporção esperada no segundo grupo, entre 0 e 1 (ex.: 0,40 = 40%).<br /><br />
                              Cada grupo contribui com p(1 − p) para a variância; quanto mais próximas de 0,5, maior o n por grupo.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" step="any" min="0" max="1"
                          className="h-8"
                          placeholder="ex.: 0.5"
                          value={p2}
                          onChange={(e) => setP2(e.target.value)}
                          data-testid="input-p2"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Razão de alocação (k)</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Razão entre os tamanhos dos grupos, k = n₂/n₁ (padrão 1 = grupos iguais).<br /><br />
                              Use k = 2 para alocar o dobro de participantes ao grupo 2; k = 0,5 para o dobro no grupo 1.<br /><br />
                              Útil quando um grupo é mais difícil ou caro de recrutar. A alocação igual (k = 1) minimiza o n total.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" step="any" min="0" className="h-8"
                          placeholder="1 (grupos iguais)"
                          value={allocationRatio}
                          onChange={(e) => setAllocationRatio(e.target.value)}
                          data-testid="input-allocation-diff-proportions"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center pt-2 border-t">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">População por grupo (N)</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Tamanho da população de <strong>cada grupo</strong> de onde a amostra será retirada (opcional).<br /><br />
                              Quando preenchido, aplica a correção para população finita ao n por grupo: n = n₀ / (1 + (n₀−1)/N).<br /><br />
                              Para N &gt; 10.000 a correção tem efeito menor que 4% e geralmente pode ser omitida.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" min="1" className="h-8"
                          placeholder="Opcional (em branco = infinita)"
                          value={populacao}
                          onChange={(e) => setPopulacao(e.target.value)}
                          data-testid="input-populacao-diff-proportions"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Não-resposta</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Fração esperada de participantes que serão recrutados mas não fornecerão dado utilizável (entre 0 e 0,99; ex.: 0,20 = 20%).<br /><br />
                              O n por grupo é dividido por (1 − NR) para garantir que, após as perdas, o n efetivo continue suficiente.<br /><br />
                              Para NR ≥ 50% o n praticamente dobra, então revise o desenho do estudo.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" step="0.01" min="0" max="0.99" className="h-8"
                          placeholder="Opcional (ex.: 0.20 = 20%)"
                          value={naoResposta}
                          onChange={(e) => setNaoResposta(e.target.value)}
                          data-testid="input-nr-diff-proportions"
                        />
                      </div>

                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          onClick={handleCalculate}
                          disabled={calcMutation.isPending}
                          className="flex-1"
                          data-testid="btn-calcular-diff-proportions"
                        >
                          <Calculator className="w-4 h-4 mr-2" />
                          {calcMutation.isPending ? "Calculando..." : "Calcular"}
                        </Button>
                        <Button variant="ghost" onClick={handleLimpar} data-testid="btn-limpar-diff-proportions">
                          Limpar
                        </Button>
                      </div>
                    </>
                  )}

                  {procedimento === "diff-means" && (
                    <>
                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Nível de Confiança</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Probabilidade de o intervalo de confiança conter a diferença verdadeira entre as duas médias. Padrão: 95%.<br /><br />
                              Quanto maior o nível, maior o n necessário (em 95% o z é 1,96; em 99% o z é 2,5758).
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Select value={confianca} onValueChange={setConfianca}>
                          <SelectTrigger className="h-8 w-full" data-testid="select-confianca-diff-means">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="90">90% (Z = 1.6449)</SelectItem>
                            <SelectItem value="95">95% (Z = 1.96)</SelectItem>
                            <SelectItem value="99">99% (Z = 2.5758)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Margem de erro (E)</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Semilargura do intervalo de confiança que você tolera para a <strong>diferença entre as duas médias</strong>, na mesma escala da variável (ex.: E = 5 = "tolero ± 5 unidades em torno da diferença observada").<br /><br />
                              Quanto menor a margem, maior o n (n cresce com 1/E²).
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" step="any" min="0"
                          className="h-8"
                          placeholder="ex.: 5"
                          value={margemErro}
                          onChange={(e) => setMargemErro(e.target.value)}
                          data-testid="input-margem-diff-means"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Desvios-padrão</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Como informar a variabilidade dos dois grupos.<br /><br />
                              <strong>Comum (pooled):</strong> assume que os dois grupos têm o mesmo desvio-padrão σ. Use quando não houver razão para esperar variâncias diferentes.<br /><br />
                              <strong>Separados por grupo:</strong> informe σ₁ e σ₂ distintos. Use quando os grupos tiverem dispersões claramente diferentes.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Select value={sigmaMode} onValueChange={(v) => setSigmaMode(v as "pooled" | "separate")}>
                          <SelectTrigger className="h-8 w-full" data-testid="select-sigma-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pooled">Comum (pooled)</SelectItem>
                            <SelectItem value="separate">Separados por grupo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {sigmaMode === "pooled" ? (
                        <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                          <div className="flex items-center gap-1">
                            <Label className="text-sm">Desvio-padrão comum (σ)</Label>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs text-xs">
                                Variabilidade comum esperada nos dois grupos, na mesma escala da variável.<br /><br />
                                Use um valor de estudo-piloto, da literatura ou de dados históricos. Se só houver a amplitude (máx − mín), uma aproximação grosseira é amplitude / 4.<br /><br />
                                Quanto maior σ, maior o n (n por grupo cresce com σ²).
                              </TooltipContent>
                            </UITooltip>
                          </div>
                          <Input
                            type="number" step="any" min="0"
                            className="h-8"
                            placeholder="ex.: 12"
                            value={desvioPadrao}
                            onChange={(e) => setDesvioPadrao(e.target.value)}
                            data-testid="input-sigma-pooled"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label className="text-sm">Desvio-padrão grupo 1 (σ₁)</Label>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Variabilidade esperada no primeiro grupo, na mesma escala da variável.<br /><br />
                                  Quanto maiores σ₁ e σ₂, maior o n por grupo (cresce com σ₁² + σ₂²).
                                </TooltipContent>
                              </UITooltip>
                            </div>
                            <Input
                              type="number" step="any" min="0"
                              className="h-8"
                              placeholder="ex.: 12"
                              value={sigma1}
                              onChange={(e) => setSigma1(e.target.value)}
                              data-testid="input-sigma1"
                            />
                          </div>
                          <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Label className="text-sm">Desvio-padrão grupo 2 (σ₂)</Label>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  Variabilidade esperada no segundo grupo, na mesma escala da variável.<br /><br />
                                  Quanto maiores σ₁ e σ₂, maior o n por grupo (cresce com σ₁² + σ₂²).
                                </TooltipContent>
                              </UITooltip>
                            </div>
                            <Input
                              type="number" step="any" min="0"
                              className="h-8"
                              placeholder="ex.: 8"
                              value={sigma2}
                              onChange={(e) => setSigma2(e.target.value)}
                              data-testid="input-sigma2"
                            />
                          </div>
                        </>
                      )}

                      <div className="flex items-start gap-2 pt-2 border-t">
                        <Checkbox
                          id="check-t-refinement-diff"
                          checked={useTDistribution}
                          onCheckedChange={(v) => setUseTDistribution(v === true)}
                          className="mt-0.5"
                          data-testid="check-t-refinement-diff"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <Label htmlFor="check-t-refinement-diff" className="text-sm cursor-pointer">
                              Refinar com distribuição t (amostras pequenas)
                            </Label>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs text-xs">
                                Por padrão, o cálculo usa o quantil normal z, que subestima levemente o n por grupo quando a amostra é pequena (n &lt; ~30) e σ foi estimado de um piloto.<br /><br />
                                Marcando esta opção, o n é recalculado iterando o quantil t de Student com os graus de liberdade do desenho de duas amostras (pooled: 2·(n−1); separado: Welch–Satterthwaite) até convergir — mais preciso para estudos pequenos. Para amostras grandes a diferença é desprezível.
                              </TooltipContent>
                            </UITooltip>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Aumenta levemente o n por grupo para corrigir a aproximação normal em amostras pequenas.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center pt-2 border-t">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Razão de alocação (k)</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Razão entre os tamanhos dos grupos, k = n₂/n₁ (padrão 1 = grupos iguais).<br /><br />
                              Use k = 2 para alocar o dobro de participantes ao grupo 2; k = 0,5 para o dobro no grupo 1.<br /><br />
                              Útil quando um grupo é mais difícil ou caro de recrutar. A alocação igual (k = 1) minimiza o n total.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" step="any" min="0" className="h-8"
                          placeholder="1 (grupos iguais)"
                          value={allocationRatio}
                          onChange={(e) => setAllocationRatio(e.target.value)}
                          data-testid="input-allocation-diff-means"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">População por grupo (N)</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Tamanho da população de <strong>cada grupo</strong> de onde a amostra será retirada (opcional).<br /><br />
                              Quando preenchido, aplica a correção para população finita ao n por grupo: n = n₀ / (1 + (n₀−1)/N).<br /><br />
                              Para N &gt; 10.000 a correção tem efeito menor que 4% e geralmente pode ser omitida.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" min="1" className="h-8"
                          placeholder="Opcional (em branco = infinita)"
                          value={populacao}
                          onChange={(e) => setPopulacao(e.target.value)}
                          data-testid="input-populacao-diff-means"
                        />
                      </div>

                      <div className="grid grid-cols-[minmax(100px,140px)_1fr] md:grid-cols-[180px_1fr] gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Label className="text-sm">Não-resposta</Label>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              Fração esperada de participantes que serão recrutados mas não fornecerão dado utilizável (entre 0 e 0,99; ex.: 0,20 = 20%).<br /><br />
                              O n por grupo é dividido por (1 − NR) para garantir que, após as perdas, o n efetivo continue suficiente.<br /><br />
                              Para NR ≥ 50% o n praticamente dobra, então revise o desenho do estudo.
                            </TooltipContent>
                          </UITooltip>
                        </div>
                        <Input
                          type="number" step="0.01" min="0" max="0.99" className="h-8"
                          placeholder="Opcional (ex.: 0.20 = 20%)"
                          value={naoResposta}
                          onChange={(e) => setNaoResposta(e.target.value)}
                          data-testid="input-nr-diff-means"
                        />
                      </div>

                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          onClick={handleCalculate}
                          disabled={calcMutation.isPending}
                          className="flex-1"
                          data-testid="btn-calcular-diff-means"
                        >
                          <Calculator className="w-4 h-4 mr-2" />
                          {calcMutation.isPending ? "Calculando..." : "Calcular"}
                        </Button>
                        <Button variant="ghost" onClick={handleLimpar} data-testid="btn-limpar-diff-means">
                          Limpar
                        </Button>
                      </div>
                    </>
                  )}

                  {procDef && !procDef.available && (
                    <Alert>
                      <Info className="w-4 h-4" />
                      <AlertDescription className="text-sm">
                        Este procedimento ainda não está disponível. Em breve.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* DIREITA — Resultados */}
            <div className="md:overflow-y-auto pb-4 md:pb-0">
              <Card className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resultados</CardTitle>
                </CardHeader>
                <CardContent className="md:max-h-[calc(100vh-200px)] md:overflow-y-auto space-y-3">
                  {!result && (
                    <div className="flex flex-col items-center justify-center text-center py-16 space-y-3">
                      <Calculator className="w-10 h-10 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Preencha os parâmetros e clique em <strong>Calcular</strong> para obter o tamanho amostral.
                      </p>
                    </div>
                  )}

                  {result && finalN !== null && (
                    <>
                      <div className="flex flex-wrap gap-2">
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

                      {(() => {
                        const isTwoGroup = result.procedureType === "diff-means" || result.procedureType === "diff-proportions";
                        const bn1 = result.n1 ?? finalN;
                        const bn2 = result.n2 ?? finalN;
                        const unequal = isTwoGroup && bn1 !== bn2;
                        return (
                      <div className="space-y-1" data-testid="result-banner">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                          {isTwoGroup ? (unequal ? "Tamanho amostral por grupo (alocação desigual)" : "Tamanho amostral por grupo") : "Tamanho amostral necessário"}
                        </div>
                        {unequal ? (
                          <>
                            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                              <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold text-primary leading-none tabular-nums" data-testid="result-n1">{bn1}</span>
                                <span className="text-sm text-muted-foreground">grupo 1 (n₁)</span>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold text-primary leading-none tabular-nums" data-testid="result-n2">{bn2}</span>
                                <span className="text-sm text-muted-foreground">grupo 2 (n₂)</span>
                              </div>
                            </div>
                            <div className="text-sm font-medium tabular-nums pt-0.5" data-testid="result-n-total">
                              Total: {bn1 + bn2} participantes ({bn1} + {bn2})
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-baseline gap-2">
                              <span className="text-4xl font-bold text-primary leading-none tabular-nums" data-testid="result-n">
                                {finalN}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {isTwoGroup ? "por grupo" : "participantes"}
                              </span>
                            </div>
                            {isTwoGroup && (
                              <div className="text-sm font-medium tabular-nums pt-0.5" data-testid="result-n-total">
                                Total: {finalN * 2} participantes ({finalN} + {finalN})
                              </div>
                            )}
                          </>
                        )}
                        <div className="text-xs text-muted-foreground font-mono pt-1">
                          {result.tRefinement
                            ? <>t = {result.tRefinement.tUsed.toFixed(4)} ({Number.isInteger(result.tRefinement.dfUsed) ? result.tRefinement.dfUsed : result.tRefinement.dfUsed.toFixed(1)} g.l.)</>
                            : <>z = {result.zUsed.toFixed(4)}</>} · n₀ = {result.n0}
                          {result.nFinite !== null && <> · n_finito = {result.nFinite}</>}
                          {result.nAdjusted !== null && <> · n_ajust = {result.nAdjusted}</>}
                        </div>
                      </div>
                        );
                      })()}

                      {result.warnings?.length > 0 && (
                        <div className="space-y-2">
                          {result.warnings.map((w, i) => (
                            <Alert key={i} variant="default" className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-900">
                              <AlertTriangle className="w-4 h-4" />
                              <AlertDescription className="text-sm">{w}</AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2 pt-2 border-t" data-testid="result-details">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Passos do cálculo
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex flex-col gap-1 p-3 rounded-md bg-muted/30">
                            <div className="font-medium">
                              {result.procedureType === "mean-population"
                                ? (result.tRefinement
                                    ? "1. Fórmula base refinada com t de Student (população infinita)"
                                    : "1. Fórmula base (população infinita)")
                                : result.procedureType === "diff-means"
                                ? (result.tRefinement
                                    ? "1. Fórmula base por grupo refinada com t de Student (população infinita)"
                                    : "1. Fórmula base por grupo (população infinita)")
                                : result.procedureType === "diff-proportions"
                                ? "1. Fórmula base por grupo (população infinita)"
                                : "1. Cochran (população infinita)"}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">{result.formula.n0}</div>
                            <div className="text-base font-semibold tabular-nums">n₀ = {result.n0}</div>
                            {result.tRefinement && (
                              <div className="text-xs text-muted-foreground">
                                Iterado com o quantil t de Student ({Number.isInteger(result.tRefinement.dfUsed) ? result.tRefinement.dfUsed : result.tRefinement.dfUsed.toFixed(1)} g.l.,
                                {" "}{result.tRefinement.iterations} iteraç{result.tRefinement.iterations === 1 ? "ão" : "ões"} até convergir).
                              </div>
                            )}
                          </div>
                          {result.nFinite !== null && (
                            <div className="flex flex-col gap-1 p-3 rounded-md bg-muted/30">
                              <div className="font-medium">2. Correção para população finita</div>
                              <div className="font-mono text-xs text-muted-foreground">{result.formula.nFinite}</div>
                              <div className="text-base font-semibold tabular-nums">n = {result.nFinite}</div>
                            </div>
                          )}
                          {result.nAdjusted !== null && (
                            <div className="flex flex-col gap-1 p-3 rounded-md bg-muted/30">
                              <div className="font-medium">3. Inflação por não-resposta</div>
                              <div className="font-mono text-xs text-muted-foreground">{result.formula.nAdjusted}</div>
                              <div className="text-base font-semibold tabular-nums">n_ajust = {result.nAdjusted}</div>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground pt-2 border-t">
                          {result.procedureType === "mean-population" ? (
                            <>
                              Referências: Cochran, W. G. (1977). <em>Sampling Techniques</em> (3rd ed.). Wiley. ·
                              Daniel, W. W. (1999). <em>Biostatistics: A Foundation for Analysis in the Health Sciences</em> (7th ed.). Wiley.
                            </>
                          ) : result.procedureType === "diff-means" || result.procedureType === "diff-proportions" ? (
                            <>
                              Referências: Daniel, W. W. (1999). <em>Biostatistics: A Foundation for Analysis in the Health Sciences</em> (7th ed.). Wiley. ·
                              Rosner, B. (2015). <em>Fundamentals of Biostatistics</em> (8th ed.). Cengage.
                            </>
                          ) : (
                            <>
                              Referências: Cochran, W. G. (1977). <em>Sampling Techniques</em> (3rd ed.). Wiley. ·
                              Lwanga, S. K., &amp; Lemeshow, S. (1991). <em>Sample size determination in health studies</em>. WHO.
                            </>
                          )}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <EffectSizeRatingWidget calculatorKey="precisao_amostral" />
    </TooltipProvider>
  );
}
