import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface ToolLimitStatus {
  limit: number | null;
  used: number;
  remaining: number | null;
  allowed: boolean;
  resetsAt: string | null;
}

export interface WatchLimitStatus {
  limitMinutes: number | null;
  usedMinutes: number;
  remainingMinutes: number | null;
  allowed: boolean;
  resetsAt: string | null;
}

export interface UsageLimitsStatus {
  isExpiredFreeTier: boolean;
  tools: Record<string, ToolLimitStatus>;
  watchTime: WatchLimitStatus;
  resourcesAccess: boolean;
}

export function useExpiredUsageLimits(enabled = true) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<UsageLimitsStatus>({
    queryKey: ["/api/usage-limits/status"],
    enabled,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const checkToolMutation = useMutation({
    mutationFn: async (params: { toolType: string; actionType: string; subType?: string }) => {
      const res = await apiRequest("POST", "/api/usage-limits/check-tool", params);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usage-limits/status"] });
    },
  });

  const reportWatchTimeMutation = useMutation({
    mutationFn: async (secondsWatched: number) => {
      const res = await apiRequest("POST", "/api/usage-limits/report-watch-time", { secondsWatched });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/usage-limits/status"] });
    },
  });

  return {
    status: data ?? null,
    isExpiredFreeTier: data?.isExpiredFreeTier ?? false,
    isLoading,
    error,
    checkTool: checkToolMutation.mutateAsync,
    reportWatchTime: reportWatchTimeMutation.mutateAsync,
    isCheckingTool: checkToolMutation.isPending,
    isReportingWatch: reportWatchTimeMutation.isPending,
  };
}
