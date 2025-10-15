"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import { authClient } from "@openchat/auth/client";

import { useBrandTheme } from "@/components/brand-theme-provider";
import { loadOpenRouterKey } from "@/lib/openrouter-key-storage";
import { identifyClient, registerClientProperties } from "@/lib/posthog";
import { ensureGuestIdClient, resolveClientUserId } from "@/lib/guest.client";

export function PosthogBootstrap() {
	const { theme, resolvedTheme } = useTheme();
	const { theme: brandTheme } = useBrandTheme();
	const { data: session } = authClient.useSession();
	const identifyRef = useRef<string | null>(null);

	useEffect(() => {
		ensureGuestIdClient();
	}, []);

	const resolvedWorkspaceId = useMemo(() => {
		if (session?.user?.id) return session.user.id;
		try {
			return resolveClientUserId();
		} catch {
			return null;
		}
	}, [session?.user?.id]);

	useEffect(() => {
		if (!resolvedWorkspaceId) return;
		if (identifyRef.current === resolvedWorkspaceId && session?.user) return;
		identifyRef.current = resolvedWorkspaceId;
		identifyClient(resolvedWorkspaceId, {
			workspaceId: resolvedWorkspaceId,
			properties: {
				auth_state: session?.user ? "member" : "guest",
			},
		});
	}, [resolvedWorkspaceId, session?.user]);

	useEffect(() => {
		if (!resolvedWorkspaceId) return;
		registerClientProperties({
			auth_state: session?.user ? "member" : "guest",
			workspace_id: resolvedWorkspaceId,
		});
	}, [resolvedWorkspaceId, session?.user]);

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
