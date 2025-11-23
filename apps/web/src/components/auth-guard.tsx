"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { NiceLoader } from "@/components/ui/nice-loader";

/**
 * Client-side authentication guard
 *
 * This component checks authentication client-side and redirects to sign-in
 * if not authenticated. This is a workaround for issues where server-side
 * cookies() doesn't receive cookies even though they exist in the browser.
 *
 * The auth check uses fetch() with credentials: 'include' which properly
 * sends HttpOnly cookies.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(true);
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	useEffect(() => {
		let cancelled = false;

		const checkAuth = async () => {
			try {
				const session = await authClient.getSession();

				if (cancelled) return;

				if (session?.data?.user) {
					setIsAuthenticated(true);
				} else {
					// No session, redirect to sign-in
					router.replace("/auth/sign-in");
				}
			} catch (error) {
				console.error("[AuthGuard] Failed to check session:", error);
				if (!cancelled) {
					router.replace("/auth/sign-in");
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		};

		checkAuth();

		return () => {
			cancelled = true;
		};
	}, [router]);

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<NiceLoader message="Checking authentication..." size="lg" />
			</div>
		);
	}

	if (!isAuthenticated) {
		return null; // Will redirect
	}

	return <>{children}</>;
}
