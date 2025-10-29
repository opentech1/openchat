"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { ThemeProvider } from "./theme-provider";
import { BrandThemeProvider } from "./brand-theme-provider";
import { Toaster } from "sonner";
import { initPosthog } from "@/lib/posthog";
import { PosthogBootstrap } from "@/components/posthog-bootstrap";

function PosthogPageViewTracker() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const posthogClient = useMemo(() => initPosthog(), []);
	const entryReferrer = useMemo(() => {
		if (typeof document === "undefined") return "direct";
		return document.referrer && document.referrer.length > 0 ? document.referrer : "direct";
	}, []);
	const previousPathRef = useRef<string | null>(null);

	useEffect(() => {
		if (!posthogClient) return;
		if (typeof window === "undefined") return;
		const currentPath = pathname ?? window.location.pathname;
		const search = searchParams?.toString() ?? window.location.search.replace(/^\?/, "");
		const referrerUrl =
			previousPathRef.current != null
				? `${window.location.origin}${previousPathRef.current}`
				: entryReferrer;
		let referrerDomain = "direct";
		if (referrerUrl !== "direct") {
			try {
				referrerDomain = new URL(referrerUrl).hostname;
			} catch {
				referrerDomain = "direct";
			}
		}
		posthogClient.capture("$pageview", {
			referrer_url: referrerUrl,
			referrer_domain: referrerDomain,
			entry_path: currentPath || "/",
			entry_query: search.length > 0 ? `?${search}` : "",
		});
		previousPathRef.current = `${currentPath || "/"}${search.length > 0 ? `?${search}` : ""}`;
	}, [entryReferrer, pathname, posthogClient, searchParams]);

	return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
	const queryClient = useMemo(() => new QueryClient(), []);
	const posthogClient = useMemo(() => initPosthog(), []);

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
					<Suspense fallback={null}>
						<PosthogPageViewTracker />
					</Suspense>
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
