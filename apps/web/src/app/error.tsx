"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
	categorizeError,
	formatErrorForLogging,
	getUserFriendlyErrorMessage,
	getErrorTitle,
	isRecoverableError,
	shouldReportError,
} from "@/lib/error-utils";
import { logError } from "@/lib/logger";

/**
 * Root-level error page for the application
 *
 * This catches errors at the root app level (below global-error.tsx)
 * Provides user-friendly error messages and recovery options
 */
export default function RootError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const router = useRouter();

	useEffect(() => {
		// Log error with context
		const errorLog = formatErrorForLogging(error, {
			level: "root",
			url: typeof window !== "undefined" ? window.location.href : undefined,
		});

		logError("Root error page", error, errorLog);

		// Report to error tracking if appropriate
		if (shouldReportError(error)) {
			// Sentry auto-captures errors, but we can add extra context
			if (typeof window !== "undefined" && (window as any).Sentry) {
				const Sentry = (window as any).Sentry;
				Sentry.captureException(error, {
					level: "error",
					contexts: {
						error: errorLog,
					},
				});
			}
		}
	}, [error]);

	const errorTitle = getErrorTitle(error);
	const errorMessage = getUserFriendlyErrorMessage(error);
	const isRecoverable = isRecoverableError(error);
	const categorized = categorizeError(error);
	const isDev = process.env.NODE_ENV === "development";

	return (
		<div className="flex min-h-screen items-center justify-center p-6">
			<div className="w-full max-w-md space-y-6 text-center">
				{/* Error Icon */}
				<div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
					<AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
				</div>

				{/* Error Content */}
				<div className="space-y-2">
					<h1 className="text-2xl font-semibold">{errorTitle}</h1>
					<p className="text-sm text-muted-foreground">
						{errorMessage}
					</p>

					{/* Error digest */}
					{error.digest && (
						<p className="text-xs text-muted-foreground">
							Error ID: {error.digest}
						</p>
					)}

					{/* Development details */}
					{isDev && (
						<details className="mt-4 text-left">
							<summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
								Technical Details (Development Only)
							</summary>
							<div className="mt-2 rounded-md bg-muted p-3 text-xs">
								<div className="space-y-1">
									<div>
										<strong>Category:</strong> {categorized.category}
									</div>
									<div>
										<strong>Message:</strong> {error.message}
									</div>
									{categorized.statusCode && (
										<div>
											<strong>Status Code:</strong> {categorized.statusCode}
										</div>
									)}
									{error.stack && (
										<div className="mt-2">
											<strong>Stack Trace:</strong>
											<pre className="mt-1 overflow-auto whitespace-pre-wrap text-[10px]">
												{error.stack}
											</pre>
										</div>
									)}
								</div>
							</div>
						</details>
					)}
				</div>

				{/* Action Buttons */}
				<div className="flex flex-col gap-2">
					{isRecoverable && (
						<Button
							onClick={reset}
							className="w-full gap-2"
							aria-label="Try again"
						>
							<RefreshCw className="size-4" aria-hidden="true" />
							Try Again
						</Button>
					)}
					<Button
						variant="outline"
						onClick={() => router.push("/")}
						className="w-full gap-2"
						aria-label="Go to home page"
					>
						<Home className="size-4" aria-hidden="true" />
						Go Home
					</Button>
				</div>
			</div>
		</div>
	);
}
