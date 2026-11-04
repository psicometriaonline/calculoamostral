import { useQuery } from '@tanstack/react-query';
import type { FeatureFlag } from '@shared/schema';

export function useFeatureFlags() {
  const { data: flags = [], isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ['/api/feature-flags'],
    staleTime: 0, // Always refetch when invalidated
    refetchInterval: 60000, // Poll every 60 seconds (reduced from 10s to save bandwidth and avoid rate limits)
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  const isFeatureEnabled = (key: string): boolean => {
    const flag = flags.find((f) => f.key === key);
    return flag?.enabled ?? true; // Default to enabled if flag not found
  };

  return {
    flags,
    isLoading,
    isFeatureEnabled,
  };
}
