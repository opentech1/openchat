/**
 * Telemetry tracking hook for chat room
 * Handles PostHog event tracking and user identification
 */

import { useEffect } from "react";
import { identifyClient, registerClientProperties } from "@/lib/posthog";

export interface UseChatTelemetryParams {
	workspaceId: string | null;
	apiKey: string | null;
}

/**
 * Hook to manage telemetry for chat room
 * Identifies user and registers properties when workspace or API key changes
 */
export function useChatTelemetry({ workspaceId, apiKey }: UseChatTelemetryParams) {
	useEffect(() => {
		if (!workspaceId) return;

		identifyClient(workspaceId, {
			workspaceId,
			properties: { auth_state: "member" },
		});

		registerClientProperties({
			auth_state: "member",
			workspace_id: workspaceId,
			has_openrouter_key: Boolean(apiKey),
		});
	}, [workspaceId, apiKey]);
}
