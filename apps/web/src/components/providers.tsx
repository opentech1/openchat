"use client";

import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { queryClient } from "@/utils/orpc";
import { ThemeProvider } from "./theme-provider";
import { BrandThemeProvider } from "./brand-theme-provider";
import { Toaster } from "sonner";
import { initPosthog } from "@/lib/posthog";

export default function Providers({ children }: { children: React.ReactNode }) {
	const [posthogClient, setPosthogClient] = useState<ReturnType<typeof initPosthog>>(null);

	useEffect(() => {
		const client = initPosthog();
		if (client) {
			setPosthogClient(client);
			client.capture("$pageview");
		}
	}, []);

	return (
		<PostHogProvider client={posthogClient ?? undefined}>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange
			>
				<BrandThemeProvider>
					<QueryClientProvider client={queryClient}>
						{children}
						<Toaster richColors position="bottom-right" />
					</QueryClientProvider>
				</BrandThemeProvider>
			</ThemeProvider>
		</PostHogProvider>
	);
}
