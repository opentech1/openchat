"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import { ThemeProvider } from "./theme-provider";
import { BrandThemeProvider } from "./brand-theme-provider";
import { Toaster } from "sonner";
import { initPosthog } from "@/lib/posthog";
import { PosthogBootstrap } from "@/components/posthog-bootstrap";

// Create singleton clients at module scope to prevent recreation on re-renders
const queryClient = new QueryClient();
const posthogClient = initPosthog();

function getConvexClient() {
	const url = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!url) {
		// During build time, use a placeholder URL
		if (typeof window === "undefined") {
			return new ConvexReactClient("http://localhost:3210");
		}
		throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
	}
	return new ConvexReactClient(url);
}

const convexClient = getConvexClient();

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
	// Use module-scoped singleton clients instead of creating new instances on each render

	const appTree = (
		<ConvexBetterAuthProvider client={convexClient} authClient={authClient}>
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
		</ConvexBetterAuthProvider>
	);

	if (posthogClient) {
		return <PostHogProvider client={posthogClient}>{appTree}</PostHogProvider>;
	}

	return appTree;
}
