"use client";

import { useState, useEffect, Suspense } from "react";
import { GalleryVerticalEnd, Github } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function LoginPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [error, setError] = useState("");
	const [loading, setLoading] = useState<string | null>(null);
	const [lastMethod, setLastMethod] = useState<string | null>(null);

	// Check if we're in the middle of an OAuth flow
	// Better Auth uses these params during OAuth callbacks
	const isOAuthFlow = searchParams.has("error") || searchParams.has("state") || searchParams.has("code");

	// Check if user is already signed in
	// Skip session check during OAuth flow to prevent race conditions
	const { data: session, isPending } = authClient.useSession();

	useEffect(() => {
		// Don't redirect during OAuth flow - let Better Auth handle it
		if (isOAuthFlow) {
			return;
		}

		// Redirect to dashboard if already signed in
		if (!isPending && session) {
			router.push("/dashboard");
		}
	}, [session, isPending, router, isOAuthFlow]);

	useEffect(() => {
		// Get last login method on mount
		const method = authClient.getLastUsedLoginMethod();
		setLastMethod(method);
	}, []);

	const handleGitHubSignIn = async () => {
		setError("");
		setLoading("github");
		try {
			await authClient.signIn.social({
				provider: "github",
				callbackURL: "/dashboard",
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to sign in with GitHub");
			setLoading(null);
		}
	};

	const handleGoogleSignIn = async () => {
		setError("");
		setLoading("google");
		try {
			await authClient.signIn.social({
				provider: "google",
				callbackURL: "/dashboard",
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to sign in with Google");
			setLoading(null);
		}
	};

	// Show loading state while checking session (but not during OAuth flow)
	if (isPending && !isOAuthFlow) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	// Don't render login page if already signed in (but allow OAuth flow to complete)
	if (session && !isOAuthFlow) {
		return null;
	}

	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<Link href="/" className="flex items-center gap-2 font-medium">
						<div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
							<GalleryVerticalEnd className="size-4" />
						</div>
						OpenChat
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs space-y-6">
						<div className="space-y-1 text-center">
							<h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
							<p className="text-muted-foreground text-sm">
								Sign in to access your workspace.
							</p>
							{lastMethod && (
								<p className="text-primary text-xs mt-2">
									You last signed in with {lastMethod === "github" ? "GitHub" : "Google"}
								</p>
							)}
						</div>

						<div className="space-y-3">
							{error && (
								<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
									{error}
								</div>
							)}

							{/* GitHub Sign In Button */}
							<button
								onClick={handleGitHubSignIn}
								disabled={loading !== null}
								className={`relative inline-flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
									lastMethod === "github"
										? "border-primary bg-primary/5 hover:bg-primary/10"
										: "border-input bg-background hover:bg-accent hover:text-accent-foreground"
								}`}
							>
								<Github className="size-4" />
								{loading === "github" ? "Signing in..." : "Continue with GitHub"}
								{lastMethod === "github" && (
									<span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
										Last used
									</span>
								)}
							</button>

							{/* Google Sign In Button */}
							<button
								onClick={handleGoogleSignIn}
								disabled={loading !== null}
								className={`relative inline-flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
									lastMethod === "google"
										? "border-primary bg-primary/5 hover:bg-primary/10"
										: "border-input bg-background hover:bg-accent hover:text-accent-foreground"
								}`}
							>
								<svg className="size-4" viewBox="0 0 24 24">
									<path
										fill="currentColor"
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									/>
									<path
										fill="currentColor"
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									/>
									<path
										fill="currentColor"
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									/>
									<path
										fill="currentColor"
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									/>
								</svg>
								{loading === "google" ? "Signing in..." : "Continue with Google"}
								{lastMethod === "google" && (
									<span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
										Last used
									</span>
								)}
							</button>
						</div>

						<p className="text-center text-xs text-muted-foreground">
							By continuing, you agree to our Terms of Service and Privacy Policy
						</p>
					</div>
				</div>
			</div>
			<div className="bg-muted relative hidden lg:block">
				<img
					src="/placeholder.svg"
					alt="OpenChat"
					className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
				/>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={
			<div className="flex min-h-svh items-center justify-center">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		}>
			<LoginPageContent />
		</Suspense>
	);
}
