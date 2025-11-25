"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/**
 * Client-side authentication guard
 *
 * Uses the better-auth useSession hook for optimized session checking with caching.
 * Shows content immediately while auth check happens in background.
 * Only redirects to sign-in if definitively not authenticated.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();

	useEffect(() => {
		// Only redirect when we're certain there's no session
		// isPending = true means we're still checking
		// session = null AND isPending = false means definitely not authenticated
		if (!isPending && !session?.user) {
			router.replace("/auth/sign-in");
		}
	}, [isPending, session, router]);

	// Show content immediately while checking
	// This provides a much faster perceived load time
	// The redirect will happen in background if not authenticated
	if (!isPending && !session?.user) {
		return null; // Will redirect
	}

	return <>{children}</>;
}
