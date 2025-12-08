"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

/**
 * Client-side authentication guard
 *
 * HYDRATION FIX: Always render children on first render to prevent hydration mismatch.
 * The useSession hook can return different values on server vs client:
 * - Server: { isPending: false, data: null } (no session available)
 * - Client: { isPending: true, data: null } (loading from localStorage)
 *
 * This caused hydration errors because server rendered null while client rendered children.
 * Now we always render children and only redirect via useEffect after confirming no session.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
	const router = useRouter();
	const { data: session, isPending } = useSession();
	const [shouldRedirect, setShouldRedirect] = useState(false);

	useEffect(() => {
		// Only redirect when we're certain there's no session
		// isPending = true means we're still checking
		// session = null AND isPending = false means definitely not authenticated
		if (!isPending && !session?.user) {
			setShouldRedirect(true);
			router.replace("/auth/sign-in");
		}
	}, [isPending, session, router]);

	// HYDRATION FIX: Always render children on initial render to match server
	// The redirect happens via useEffect, not conditional rendering
	// Only hide content after we've confirmed redirect is needed (client-side only)
	if (shouldRedirect) {
		return null;
	}

	return <>{children}</>;
}
