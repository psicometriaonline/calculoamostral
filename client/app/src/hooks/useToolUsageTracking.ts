import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
const TOOL_TYPES = { CLASSIFIER: 'classifier', EFFECT_SIZE: 'effect_size', POWER_ANALYSIS: 'power_analysis', SYNTAX_GENERATOR: 'syntax_generator', CHATBOT: 'chatbot', GLOSSARY: 'glossary', LIBRARY: 'library', BOOKS: 'books' } as const;
const ACTION_TYPES = { INTERACTION: 'interaction', CALCULATION: 'calculation', COMPLETION: 'completion', SEARCH: 'search', VIEW: 'view', CLICK: 'click', SAVE: 'save' } as const;
import { useExpiredUsageLimits } from "./useExpiredUsageLimits";

type ToolType = typeof TOOL_TYPES[keyof typeof TOOL_TYPES];
type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES];

interface TrackUsageParams {
  toolType: ToolType;
  actionType: ActionType;
  subType?: string;
  targetId?: string;
  searchQuery?: string;
  metadata?: Record<string, any>;
}

const TOOL_TYPE_TO_LIMIT_KEY: Record<string, string> = {
  [TOOL_TYPES.EFFECT_SIZE]: 'effect_size',
  [TOOL_TYPES.CLASSIFIER]: 'classifier',
  [TOOL_TYPES.SYNTAX_GENERATOR]: 'syntax_generator',
  [TOOL_TYPES.POWER_ANALYSIS]: 'power_analysis',
};

export function useToolUsageTracking() {
  const queryClient = useQueryClient();
  const { isExpiredFreeTier, status, checkTool } = useExpiredUsageLimits();

  const trackMutation = useMutation({
    mutationFn: async (params: TrackUsageParams) => {
      return apiRequest("POST", "/api/tool-usage/track", params);
    },
    onError: (error) => {
      console.warn("Failed to track tool usage:", error);
    },
  });

  const trackUsage = (
    toolType: ToolType,
    actionType: ActionType,
    options?: {
      subType?: string;
      targetId?: string;
      searchQuery?: string;
      metadata?: Record<string, any>;
    }
  ) => {
    if (isExpiredFreeTier && actionType === ACTION_TYPES.CALCULATION) {
      checkTool({
        toolType: TOOL_TYPE_TO_LIMIT_KEY[toolType] || toolType,
        actionType: 'CALCULATION',
        subType: options?.subType,
      }).catch(() => {});
    }

    trackMutation.mutate({
      toolType,
      actionType,
      ...options,
    });
  };

  const isToolLimitReached = (toolType: ToolType): boolean => {
    if (!isExpiredFreeTier || !status) return false;
    const limitKey = TOOL_TYPE_TO_LIMIT_KEY[toolType];
    if (!limitKey) return false;
    const toolStatus = status.tools[limitKey];
    if (!toolStatus) return false;
    return !toolStatus.allowed;
  };

  const getToolLimitInfo = (toolType: ToolType) => {
    if (!isExpiredFreeTier || !status) return null;
    const limitKey = TOOL_TYPE_TO_LIMIT_KEY[toolType];
    if (!limitKey) return null;
    return status.tools[limitKey] ?? null;
  };

  return {
    trackUsage,
    isTracking: trackMutation.isPending,
    isExpiredFreeTier,
    isToolLimitReached,
    getToolLimitInfo,
  };
}

export { TOOL_TYPES, ACTION_TYPES };
