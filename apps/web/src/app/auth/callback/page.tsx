"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { NiceLoader } from "@/components/ui/nice-loader";

/**
 * Auth Callback Content Component
 *
 * Handles the OAuth callback for cross-domain authentication.
 *
 * IMPORTANT: We MUST manually verify the OTT with `credentials: "include"` BEFORE
 * the crossDomainClient does (which uses credentials: "omit"). This ensures the
 * Set-Cookie headers from our route handler are actually stored by the browser.
 * Without this, cookies only go to localStorage and middleware can't see them.
 */
function AuthCallbackContent() {
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);
	const [checking, setChecking] = useState(true);
	const verifyingRef = useRef(false);

	useEffect(() => {
		let cancelled = false;

		const verifyOTTAndCheckSession = async () => {
			// Prevent double verification
			if (verifyingRef.current) return;
			verifyingRef.current = true;

			try {
				const ott = searchParams.get("ott");

				if (ott) {
					console.log("[Auth Callback] Found OTT, verifying with credentials: include...");

					// CRITICAL: Verify OTT with credentials: "include" to actually store cookies!
					// crossDomainClient uses credentials: "omit" which prevents cookie storage.
					// By doing this FIRST, we ensure Set-Cookie headers from our route handler
					// are stored by the browser as actual cookies (not just localStorage).
					const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
					const verifyResponse = await fetch(`${baseUrl}/api/auth/cross-domain/one-time-token/verify`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ token: ott }),
						credentials: "include", // THIS IS THE KEY - stores Set-Cookie headers!
					});

					if (!verifyResponse.ok) {
						const errorData = await verifyResponse.json().catch(() => ({}));
						console.error("[Auth Callback] OTT verification failed:", verifyResponse.status, errorData);
						// Don't show error yet - might be already used, check session below
					} else {
						console.log("[Auth Callback] OTT verified successfully, cookies should be set");
					}

					// Clean up URL to remove OTT
					const newUrl = new URL(window.location.href);
					newUrl.searchParams.delete("ott");
					window.history.replaceState({}, "", newUrl.toString());
				}

				// Now poll for session
				let attempts = 0;
				const maxAttempts = 10;

				const checkSession = async () => {
					if (cancelled) return;

					try {
						const session = await authClient.getSession();

						if (session?.data?.user) {
							console.log("[Auth Callback] Session established, redirecting...");
							const from = searchParams.get("from") || "/dashboard";
							window.location.href = from;
							return;
						}

						attempts++;
						if (attempts < maxAttempts) {
							console.log(`[Auth Callback] Waiting for session... (attempt ${attempts}/${maxAttempts})`);
							setTimeout(checkSession, 500);
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

				// Start checking session
				await checkSession();
			} catch (err) {
				console.error("[Auth Callback] Error in auth flow:", err);
				if (!cancelled) {
					setError("An error occurred during authentication.");
					setChecking(false);
				}
			}
		};

		// Start immediately
		verifyOTTAndCheckSession();

		return () => {
			cancelled = true;
		};
	}, [searchParams]);

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
