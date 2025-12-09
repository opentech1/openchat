"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClientOnly } from "@/components/client-only";
import { useMounted } from "@/hooks/use-mounted";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { ThemeProvider } from "./theme-provider";
import { BrandThemeProvider } from "./brand-theme-provider";
import { Toaster } from "sonner";
import { initPosthog } from "@/lib/posthog";
import { PosthogBootstrap } from "@/components/posthog-bootstrap";
import { ConvexUserProvider } from "@/contexts/convex-user-context";
import { ChatListProvider } from "@/contexts/chat-list-context";

// Client-only Toaster to prevent hydration mismatch
function ClientToaster() {
	const mounted = useMounted();
	if (!mounted) return null;
	return (
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
	);
}

// Create singleton clients at module scope to prevent recreation on re-renders
// This follows Convex recommended pattern for Next.js: https://docs.convex.dev/quickstart/nextjs
const queryClient = new QueryClient();
const posthogClient = initPosthog();

// Create Convex client at module scope - only in browser environment
// During SSR/SSG (static generation), convexClient will be null and we render a fallback tree
// This is required because:
// 1. Next.js prerenders pages on the server during build
// 2. The "use client" directive doesn't prevent module-level code from running on server
// 3. Convex client requires browser APIs that don't exist on server
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexClient = typeof window !== "undefined" && convexUrl
	? new ConvexReactClient(convexUrl)
	: null;

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
	// During SSR/SSG, render without Convex providers
	// This prevents "Could not find Convex client" errors during static generation
	if (!convexClient) {
		return (
			<AuthKitProvider>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<BrandThemeProvider>
						<QueryClientProvider client={queryClient}>
							{children}
						</QueryClientProvider>
					</BrandThemeProvider>
				</ThemeProvider>
			</AuthKitProvider>
		);
	}

	const appTree = (
		<AuthKitProvider>
			<ConvexBetterAuthProvider client={convexClient} authClient={authClient}>
				<ConvexUserProvider>
					<ChatListProvider>
						<ThemeProvider
							attribute="class"
							defaultTheme="system"
							enableSystem
							disableTransitionOnChange
						>
							<BrandThemeProvider>
								<QueryClientProvider client={queryClient}>
									<PosthogBootstrap />
									<ClientOnly>
										<PosthogPageViewTracker />
									</ClientOnly>
									{children}
									<ClientToaster />
								</QueryClientProvider>
							</BrandThemeProvider>
						</ThemeProvider>
					</ChatListProvider>
				</ConvexUserProvider>
			</ConvexBetterAuthProvider>
		</AuthKitProvider>
	);

	if (posthogClient) {
		return <PostHogProvider client={posthogClient}>{appTree}</PostHogProvider>;
	}

	return appTree;
}
