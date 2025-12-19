"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { useMounted } from "@/hooks/use-mounted";

export function ClientAnalytics() {
	const mounted = useMounted();

	if (!mounted) return null;

	return (
		<>
			<SpeedInsights />
			<Analytics mode="production" />
		</>
	);
}
