"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/logger";
import {
	categorizeError,
	formatErrorForLogging,
	getUserFriendlyErrorMessage,
	getErrorTitle,
	isRecoverableError,
	shouldReportError,
} from "@/lib/error-utils";

export default function DashboardError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		const errorLog = formatErrorForLogging(error, {
			context: "dashboard",
		});

		logError("Dashboard error", error, errorLog);

		// Report to error tracking if appropriate
		if (shouldReportError(error)) {
			if (typeof window !== "undefined" && (window as any).Sentry) {
				const Sentry = (window as any).Sentry;
				Sentry.captureException(error, {
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
		<div className="flex h-full flex-col items-center justify-center gap-4 p-6">
			<div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
				<AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
			</div>
			<div className="space-y-2 text-center">
				<h2 className="text-2xl font-semibold">{errorTitle}</h2>
				<p className="max-w-md text-sm text-muted-foreground">
					{errorMessage}
				</p>
				{error.digest && (
					<p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
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
			{isRecoverable && (
				<Button onClick={reset} className="gap-2" aria-label="Try again">
					<RefreshCw className="size-4" aria-hidden="true" />
					Try Again
				</Button>
			)}
		</div>
	);
}
