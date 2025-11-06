"use client";

import { useState } from "react";
import { GalleryVerticalEnd, Github } from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
	const [error, setError] = useState("");
	const [loading, setLoading] = useState<string | null>(null);

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
							<h1 className="text-xl font-semibold tracking-tight">Welcome to OpenChat</h1>
							<p className="text-muted-foreground text-sm">
								Sign in to access your workspace
							</p>
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
								className="relative inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<Github className="size-4" />
								{loading === "github" ? "Signing in..." : "Continue with GitHub"}
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
