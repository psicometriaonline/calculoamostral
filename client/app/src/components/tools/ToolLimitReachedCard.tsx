import { Lock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface ToolLimitReachedCardProps {
  used: number;
  limit: number;
  toolLabel?: string;
}

export function ToolLimitReachedCard({ used, limit, toolLabel = "cálculos" }: ToolLimitReachedCardProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col items-center py-6 px-4 space-y-4">
      <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <Lock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
      </div>

      <div className="text-center space-y-1">
        <p className="text-base font-semibold text-foreground">Limite diário atingido</p>
        <p className="text-sm text-muted-foreground">
          Você já usou seu limite de cálculos de hoje.
        </p>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Renova às 00:00.
      </p>

      <div className="w-full max-w-xs pt-1">
        <Button
          onClick={() => setLocation("/user/subscription")}
          className="w-full"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Fazer upgrade
        </Button>
      </div>
    </div>
  );
}
