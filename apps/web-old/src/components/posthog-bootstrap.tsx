"use client";

import { useMounted } from "@/hooks/use-mounted";
import { PosthogBootstrapClient } from "@/components/posthog-bootstrap-client";

export function PosthogBootstrap() {
	const mounted = useMounted();

	// Only render on client to avoid SSR hydration issues
	if (!mounted) return null;

	return <PosthogBootstrapClient />;
}
