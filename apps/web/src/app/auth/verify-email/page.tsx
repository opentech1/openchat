"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { useMounted } from "@/hooks/use-mounted";

export default function VerifyEmailPage() {
	const mounted = useMounted();
	const router = useRouter();

	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [email, setEmail] = useState<string | null>(null);
	const [token, setToken] = useState<string | null>(null);

	// Parse search params after mount to avoid hydration issues
	useEffect(() => {
		if (mounted && typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			setEmail(params.get("email"));
			setToken(params.get("token"));
		}
	}, [mounted]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!code || !token) return;

		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/auth/verify-email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code, token }),
			});

			const data = await response.json();

			if (!response.ok) {
				setError(data.error || "Verification failed. Please try again.");
				setIsLoading(false);
				return;
			}

			// Success - redirect to home
			router.push("/");
		} catch {
			setError("Something went wrong. Please try again.");
			setIsLoading(false);
		}
	};

	const handleResend = async () => {
		if (!email) return;

		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/auth/resend-verification", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});

			if (!response.ok) {
				const data = await response.json();
				setError(data.error || "Failed to resend code. Please try again.");
			}
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	if (!mounted) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<div className="animate-pulse text-muted-foreground">Loading...</div>
			</div>
		);
	}

	if (!token) {
		return (
			<div className="flex min-h-svh flex-col items-center justify-center p-6">
				<div className="w-full max-w-sm space-y-6 text-center">
					<Logo size="small" className="mx-auto" />
					<div className="space-y-2">
						<h1 className="text-xl font-semibold">Invalid verification link</h1>
						<p className="text-sm text-muted-foreground">
							This verification link is invalid or has expired.
						</p>
					</div>
					<Link
						href="/auth/sign-in"
						className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
					>
						Back to Sign In
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-svh flex-col items-center justify-center p-6">
			<div className="w-full max-w-sm space-y-6">
				<div className="flex justify-center">
					<Link href="/" className="transition-opacity hover:opacity-80">
						<Logo size="small" />
					</Link>
				</div>

				<div className="space-y-2 text-center">
					<h1 className="text-xl font-semibold tracking-tight">Verify your email</h1>
					<p className="text-sm text-muted-foreground">
						We sent a verification code to{" "}
						<span className="font-medium text-foreground">{email}</span>
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="code" className="text-sm font-medium">
							Verification code
						</label>
						<input
							id="code"
							type="text"
							inputMode="numeric"
							pattern="[0-9]*"
							maxLength={6}
							value={code}
							onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
							placeholder="Enter 6-digit code"
							className="w-full rounded-md border border-input bg-background px-3 py-2 text-center text-lg tracking-widest placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							autoComplete="one-time-code"
							autoFocus
						/>
					</div>

					{error && (
						<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							{error}
						</div>
					)}

					<button
						type="submit"
						disabled={code.length !== 6 || isLoading}
						className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isLoading ? "Verifying..." : "Verify Email"}
					</button>
				</form>

				<div className="text-center text-sm text-muted-foreground">
					Didn't receive the code?{" "}
					<button
						onClick={handleResend}
						disabled={isLoading}
						className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
					>
						Resend
					</button>
				</div>

				<div className="text-center">
					<Link
						href="/auth/sign-in"
						className="text-sm text-muted-foreground hover:text-foreground"
					>
						← Back to Sign In
					</Link>
				</div>
			</div>
		</div>
	);
}
