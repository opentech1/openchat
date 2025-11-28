"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { NiceLoader } from "@/components/ui/nice-loader";

/**
 * Auth Callback Content Component
 *
 * Handles the OAuth callback. After successful OAuth login, better-auth
 * redirects here. We poll for the session and redirect to the dashboard.
 */
function AuthCallbackContent() {
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);
	const [checking, setChecking] = useState(true);

	// Extract params once to avoid dependency issues
	const from = searchParams.get("from");

	useEffect(() => {
		let cancelled = false;

		const checkSession = async () => {
			if (cancelled) return;

			let attempts = 0;
			const maxAttempts = 15;

			const poll = async () => {
				if (cancelled) return;

				try {
					const session = await authClient.getSession();

					if (session?.data?.user) {
						window.location.href = from || "/dashboard";
						return;
					}

					attempts++;
					if (attempts < maxAttempts) {
						setTimeout(poll, 500);
					} else {
						console.error("[Auth Callback] Session not established after waiting");
						setError("Authentication is taking longer than expected. Please try signing in again.");
						setChecking(false);
					}
				} catch (err) {
					console.error("[Auth Callback] Error checking session:", err);
					if (!cancelled) {
						setError("An error occurred during authentication.");
						setChecking(false);
					}
				}
			};

			await poll();
		};

		checkSession();

		return () => {
			cancelled = true;
		};
	}, [from]);

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
			<NiceLoader message={checking ? "Completing sign in..." : "Redirecting..."} size="lg" />
		</div>
	);
}

/**
 * Auth Callback Page
 *
 * Wrapped in Suspense as required by Next.js for useSearchParams
 */
export default function AuthCallbackPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center">
					<NiceLoader message="Loading..." size="lg" />
				</div>
			}
		>
			<AuthCallbackContent />
		</Suspense>
	);
}
