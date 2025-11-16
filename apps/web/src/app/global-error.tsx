"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "@/lib/icons";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import {
	categorizeError,
	formatErrorForLogging,
	getUserFriendlyErrorMessage,
	getErrorTitle,
	shouldReportError,
} from "@/lib/error-utils";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log error with enhanced context
		const errorLog = formatErrorForLogging(error, {
			level: "global",
			url: typeof window !== "undefined" ? window.location.href : undefined,
		});

		// Report to Sentry only if appropriate
		if (shouldReportError(error)) {
			Sentry.captureException(error, {
				level: "fatal",
				contexts: {
					error: errorLog,
				},
			});
		}
	}, [error]);

	const errorTitle = getErrorTitle(error);
	const errorMessage = getUserFriendlyErrorMessage(error);
	const categorized = categorizeError(error);
	const isDev = process.env.NODE_ENV === "development";

	return (
		<html
			lang="en"
			suppressHydrationWarning
			data-brand-theme="blue"
			className={`${GeistSans.variable} ${GeistMono.variable}`}>
			<body className={cn("font-sans antialiased", GeistSans.className)}>
				<div className="flex min-h-screen items-center justify-center p-6">
					<div className="w-full max-w-md space-y-6 text-center">
						<div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
							<AlertTriangle className="size-6 text-destructive" />
						</div>
						<div className="space-y-2">
							<h1 className="text-2xl font-semibold">{errorTitle}</h1>
							<p className="text-sm text-muted-foreground">
								{errorMessage}
							</p>
							{!isDev && (
								<p className="text-xs text-muted-foreground">
									Our team has been notified and is working on a fix.
								</p>
							)}
							{error.digest && (
								<p className="text-xs text-muted-foreground">
									Error ID: {error.digest}
								</p>
							)}
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
						<div className="flex flex-col gap-2">
							<button
								onClick={reset}
								className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
								aria-label="Try again"
							>
								<RefreshCw className="size-4" />
								Try Again
							</button>
							<Link
								href="/"
								className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
								aria-label="Go to home page"
							>
								<Home className="size-4" />
								Go Home
							</Link>
						</div>
					</div>
				</div>
			</body>
		</html>
	);
}
