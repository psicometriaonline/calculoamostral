import { Link, useLocation } from "wouter";
import { Target, Ruler } from "lucide-react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export function CalculadoraTipoSelector() {
  const [location] = useLocation();
  const { isFeatureEnabled } = useFeatureFlags();

  if (!isFeatureEnabled("precisao-amostral")) return null;

  const isPoder = location.startsWith("/poder-amostral");
  const isPrecisao = location.startsWith("/precisao-amostral");

  const baseTab =
    "flex-1 inline-flex items-center justify-center gap-2 h-full text-sm md:text-base font-medium transition-colors rounded-md";
  const activeTab = "bg-background text-foreground shadow-sm";
  const inactiveTab = "text-muted-foreground hover-elevate";

  return (
    <div
      role="tablist"
      aria-label="Tipo de cálculo amostral"
      className="w-full border-b bg-background px-4 sm:px-6 py-3"
      data-testid="calc-tipo-selector"
    >
      <div className="max-w-6xl mx-auto h-12 grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted">
        <Link href="/poder-amostral">
          <button
            role="tab"
            aria-selected={isPoder}
            data-testid="tab-poder-amostral"
            className={`${baseTab} w-full ${isPoder ? activeTab : inactiveTab}`}
          >
            <Target className="w-4 h-4 md:w-5 md:h-5" />
            Por Poder Estatístico
          </button>
        </Link>
        <Link href="/precisao-amostral">
          <button
            role="tab"
            aria-selected={isPrecisao}
            data-testid="tab-precisao-amostral"
            className={`${baseTab} w-full ${isPrecisao ? activeTab : inactiveTab}`}
          >
            <Ruler className="w-4 h-4 md:w-5 md:h-5" />
            Por Precisão de Estimativa
          </button>
        </Link>
      </div>
    </div>
  );
}
