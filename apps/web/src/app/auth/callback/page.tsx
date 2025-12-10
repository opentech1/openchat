"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NiceLoader } from "@/components/ui/nice-loader";
import { ClientOnly } from "@/components/client-only";
import { useAuth } from "@workos-inc/authkit-nextjs/components";

/**
 * Auth Callback Content Component
 *
 * Handles the OAuth callback. After successful OAuth login via WorkOS AuthKit,
 * this page checks if the user is authenticated and redirects to the dashboard.
 *
 * Note: The main callback is handled by /api/auth/callback via handleAuth()
 * This page is for the legacy /auth/callback route and can redirect users
 * who land here after authentication.
 */
function AuthCallbackContent() {
	const searchParams = useSearchParams();
	const { user, loading } = useAuth();
	const [error, setError] = useState<string | null>(null);

	// Extract params once to avoid dependency issues
	const from = searchParams.get("from");

	useEffect(() => {
		// Wait for auth to finish loading
		if (loading) return;

		// If user is authenticated, redirect to the dashboard
		if (user) {
			window.location.href = from || "/";
			return;
		}

		// If auth finished loading but no user, show error after a delay
		// (give time for session to be established)
		const timeout = setTimeout(() => {
			if (!user) {
				setError("Authentication session not found. Please try signing in again.");
			}
		}, 3000);

		return () => clearTimeout(timeout);
	}, [user, loading, from]);

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center space-y-4">
					<p className="text-red-500">{error}</p>
					<button
						onClick={() => (window.location.href = "/auth/sign-in")}
						className="text-primary hover:underline"
					>
						Return to Sign In
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center">
			<NiceLoader message={loading ? "Completing sign in..." : "Redirecting..."} size="lg" />
		</div>
	);
}

/**
 * Auth Callback Page
 *
 * Uses ClientOnly instead of Suspense to prevent hydration mismatches
 */
export default function AuthCallbackPage() {
	return (
		<ClientOnly
			fallback={
				<div className="min-h-screen flex items-center justify-center">
					<NiceLoader message="Loading..." size="lg" />
				</div>
			}
		>
			<AuthCallbackContent />
		</ClientOnly>
	);
}
