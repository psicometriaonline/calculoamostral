import { createRoot } from "react-dom/client";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Router, Switch, Route, Redirect } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import PowerAnalysis from "@/pages/power-analysis";
import PrecisaoAmostral from "@/pages/precisao-amostral";
import "./index.css";

function AccountBar() {
  const { data } = useQuery<{ authenticated: boolean; email?: string }>({ queryKey: ["/api/auth/me"] });
  const sair = async () => {
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); } catch {}
    window.location.replace("/");
  };
  return (
    <div className="border-b bg-white" data-testid="account-bar">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2">
        <a href="/" className="flex items-center gap-3 no-underline" aria-label="Página principal">
          <img src="/logo-horizontal.png" alt="psicometria.online" className="block h-7 w-auto" />
          <span className="hidden border-l pl-3 text-sm font-semibold text-[#174552] sm:inline">Calculadora Amostral</span>
        </a>
        <div className="flex items-center gap-4 text-sm">
          {data?.email && <span className="text-muted-foreground" data-testid="account-email">{data.email}</span>}
          <button type="button" onClick={sair} className="min-h-[36px] rounded-md border px-3 font-medium text-[#00749A] hover:bg-[#E3F3F8]" data-testid="button-logout">
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AccountBar />
        <Router base="/calculadora">
          <Switch>
            <Route path="/poder-amostral"><PowerAnalysis /></Route>
            <Route path="/precisao-amostral"><PrecisaoAmostral /></Route>
            <Route><Redirect to="/poder-amostral" /></Route>
          </Switch>
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
