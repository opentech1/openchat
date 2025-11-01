"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import { authClient } from "@/lib/auth-client";

import { useBrandTheme } from "@/components/brand-theme-provider";
import { loadOpenRouterKey } from "@/lib/openrouter-key-storage";
import { identifyClient, registerClientProperties } from "@/lib/posthog";

export function PosthogBootstrap() {
	const { theme, resolvedTheme } = useTheme();
	const { theme: brandTheme } = useBrandTheme();
	const { data: session, isPending: loading } = authClient.useSession();
	const identifyRef = useRef<string | null>(null);

	const user = session?.user;
	const resolvedWorkspaceId = useMemo(() => user?.id ?? null, [user?.id]);

	useEffect(() => {
		if (loading || !resolvedWorkspaceId) return;
		if (identifyRef.current === resolvedWorkspaceId) return;
		identifyRef.current = resolvedWorkspaceId;
		identifyClient(resolvedWorkspaceId, {
			workspaceId: resolvedWorkspaceId,
			properties: {
				auth_state: user ? "member" : "anonymous",
			},
		});
	}, [loading, resolvedWorkspaceId, user]);

	useEffect(() => {
		if (!resolvedWorkspaceId) return;
		registerClientProperties({
			workspace_id: resolvedWorkspaceId,
			auth_state: user ? "member" : "anonymous",
		});
	}, [resolvedWorkspaceId, user]);

	useEffect(() => {
		const preferred =
			theme === "system"
				? resolvedTheme ?? "system"
				: theme ?? resolvedTheme ?? "system";
		registerClientProperties({ ui_theme: preferred });
	}, [theme, resolvedTheme]);

	useEffect(() => {
		if (!brandTheme) return;
		registerClientProperties({ brand_theme: brandTheme });
	}, [brandTheme]);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const key = await loadOpenRouterKey();
				if (cancelled) return;
				registerClientProperties({ has_openrouter_key: Boolean(key) });
			} catch {
				if (cancelled) return;
				registerClientProperties({ has_openrouter_key: false });
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	return null;
}
