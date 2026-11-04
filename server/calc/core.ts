// Despacho das rotas de CÁLCULO (puro, sem DOM). Roda num Web Worker no app
// e diretamente no Node nos testes.
import { routes } from "./routes";
import { generateConsistentCurve } from "@shared/powerAnalysis/consistentCurve";
import { refineAPriori } from "@shared/powerAnalysis/aprioriRefine";

export type LocalResponse = { status: number; data: any };

const PRECISION_PROCEDURES = new Set(["prevalence-cochran", "mean-population", "diff-means", "diff-proportions"]);
const MAX_CURVE_N = 2000;
const MAX_CURVE_EFFECT = 50;

function hasNonFinite(v: any, depth = 0): boolean {
  if (depth > 4) return false;
  if (typeof v === "number") return !Number.isFinite(v);
  if (v && typeof v === "object") return Object.values(v).some((x) => hasNonFinite(x, depth + 1));
  return false;
}

export async function dispatchCalc(method: string, url: string, body: any): Promise<LocalResponse> {
  const path = url.split("?")[0];
  // Proteções do site público (docs/04 — P0 B/C)
  if (body && hasNonFinite(body)) {
    return { status: 400, data: { error: "Há campos numéricos vazios ou inválidos. Revise os valores informados." } };
  }
  if (path === "/api/sample-size-precision/calculate" && body?.procedureType != null && !PRECISION_PROCEDURES.has(body.procedureType)) {
    return { status: 400, data: { error: "Procedimento de precisão desconhecido." } };
  }
  if (path === "/api/power-analysis/curve" && body) {
    if (body.maxN != null) body.maxN = Math.min(Math.max(Number(body.maxN) || 200, 10), MAX_CURVE_N);
    if (body.maxEffect != null) body.maxEffect = Math.min(Number(body.maxEffect) || 1, MAX_CURVE_EFFECT);
  }
  // Curva consistente com o resultado (mesma função de poder do cálculo)
  if (method === "POST" && path === "/api/power-analysis/curve-consistent") {
    try {
      const { testType, mode, input, result } = body ?? {};
      if (!testType || !mode || !input || !result) return { status: 400, data: { error: "Parâmetros da curva ausentes" } };
      return { status: 200, data: generateConsistentCurve({ testType, mode, input, result }) };
    } catch (err: any) {
      return { status: 400, data: { error: err?.message ?? "Não foi possível gerar a curva" } };
    }
  }
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.pattern);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    let status = 200;
    let data: any = null;
    const res = {
      status(code: number) { status = code; return res; },
      json(v: any) { data = v; return res; },
    };
    try {
      await r.handler({ body: body ?? {}, params, session: {} }, res);
    } catch (err: any) {
      console.error("[calculadora] erro no cálculo:", err);
      return { status: 500, data: { error: "Não foi possível concluir o cálculo com esses parâmetros. Revise os valores e tente novamente." } };
    }
    // A priori: N mínimo cuja função post-hoc do próprio teste atinge o poder alvo
    // (definição do G*Power), para que N, poder real e curva fiquem coerentes.
    if (status === 200 && path === "/api/power-analysis/calculate" && data && body?.power != null && data.minDetectableEffect === undefined) {
      try {
        const { testType, ...input } = body;
        data = refineAPriori(testType, input, data);
      } catch (e) {
        console.error("[calculadora] refinamento a priori falhou:", e);
      }
    }
    if (status < 400 && data != null && hasNonFinite(data) && path.endsWith("/calculate")) {
      // evita exibir NaN/Infinity como resultado
      const clean = JSON.parse(JSON.stringify(data, (_k, v) => (typeof v === "number" && !Number.isFinite(v) ? null : v)));
      return { status, data: clean };
    }
    return { status, data };
  }
  return { status: 404, data: { error: "Recurso não encontrado" } };
}
