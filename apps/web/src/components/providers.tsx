"use client";

import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { queryClient } from "@/utils/orpc";
import { ThemeProvider } from "./theme-provider";
import { BrandThemeProvider } from "./brand-theme-provider";
import { Toaster } from "sonner";
import { initPosthog } from "@/lib/posthog";
import { PosthogBootstrap } from "@/components/posthog-bootstrap";

export default function Providers({ children }: { children: React.ReactNode }) {
	const [posthogClient, setPosthogClient] = useState<ReturnType<typeof initPosthog>>(null);

	useEffect(() => {
		const client = initPosthog();
		if (client) {
			setPosthogClient(client);
			const referrerUrl = document.referrer && document.referrer.length > 0 ? document.referrer : "direct";
			let referrerDomain = "direct";
			if (referrerUrl !== "direct") {
				try {
					referrerDomain = new URL(referrerUrl).hostname;
				} catch {
					referrerDomain = "direct";
				}
			}
			const entryPath = window.location.pathname || "/";
			const entryQuery = window.location.search || "";
			client.capture("$pageview", {
				referrer_url: referrerUrl,
				referrer_domain: referrerDomain,
				entry_path: entryPath,
				entry_query: entryQuery,
			});
		}
	}, []);

	const appTree = (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
		>
			<BrandThemeProvider>
				<QueryClientProvider client={queryClient}>
					<PosthogBootstrap />
					{children}
					<Toaster richColors position="bottom-right" />
				</QueryClientProvider>
			</BrandThemeProvider>
		</ThemeProvider>
	);

	if (posthogClient) {
		return <PostHogProvider client={posthogClient}>{appTree}</PostHogProvider>;
	}

	return appTree;
}
