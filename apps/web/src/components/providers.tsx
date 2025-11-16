"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { ConvexUserProvider } from "@/contexts/convex-user-context";

// Create singleton clients at module scope to prevent recreation on re-renders
const queryClient = new QueryClient();
const posthogClient = initPosthog();

function PosthogPageViewTracker() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	// Use module-scoped singleton instead of creating new instance
	const localPosthogClient = posthogClient;
	const entryReferrer = useMemo(() => {
		if (typeof document === "undefined") return "direct";
		return document.referrer && document.referrer.length > 0 ? document.referrer : "direct";
	}, []);
	const previousPathRef = useRef<string | null>(null);

	useEffect(() => {
		if (!localPosthogClient) return;
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
		localPosthogClient.capture("$pageview", {
			referrer_url: referrerUrl,
			referrer_domain: referrerDomain,
			entry_path: currentPath || "/",
			entry_query: search.length > 0 ? `?${search}` : "",
		});
		previousPathRef.current = `${currentPath || "/"}${search.length > 0 ? `?${search}` : ""}`;
	}, [entryReferrer, pathname, localPosthogClient, searchParams]);

	return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
	// Lazy initialize Convex client inside component to avoid module-level errors
	// This follows the pattern from Convex docs: https://docs.convex.dev/quickstart/remix
	const [convexClient] = useState(() => {
		const url = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (!url) {
			// During build time or SSR, use a placeholder URL
			if (typeof window === "undefined") {
				return new ConvexReactClient("http://localhost:3210");
			}
			// Provide a helpful error message for client-side
			throw new Error(
				"NEXT_PUBLIC_CONVEX_URL is not configured. Please add it to your .env.local file and restart the dev server with: bun run dev"
			);
		}
		return new ConvexReactClient(url);
	});

	const appTree = (
		<ConvexBetterAuthProvider client={convexClient} authClient={authClient}>
			<ConvexUserProvider>
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
							<Toaster
								richColors
								position="bottom-right"
								closeButton
								theme="system"
								toastOptions={{
									classNames: {
										toast: 'backdrop-blur-xl bg-background/95 border-border shadow-lg',
										title: 'text-foreground font-medium',
										description: 'text-muted-foreground',
										actionButton: 'bg-primary text-primary-foreground hover:bg-primary/90',
										cancelButton: 'bg-muted text-muted-foreground hover:bg-muted/80',
										closeButton: 'bg-background border-border hover:bg-muted',
									},
								}}
							/>
						</QueryClientProvider>
					</BrandThemeProvider>
				</ThemeProvider>
			</ConvexUserProvider>
		</ConvexBetterAuthProvider>
	);

	if (posthogClient) {
		return <PostHogProvider client={posthogClient}>{appTree}</PostHogProvider>;
	}

	return appTree;
}
