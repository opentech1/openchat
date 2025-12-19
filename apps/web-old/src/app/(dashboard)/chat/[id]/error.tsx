"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { logError } from "@/lib/logger";
import {
	categorizeError,
	formatErrorForLogging,
	getUserFriendlyErrorMessage,
	getErrorTitle,
	isRecoverableError,
	shouldReportError,
	getErrorCategory,
} from "@/lib/error-utils";

export default function ChatError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const router = useRouter();

	useEffect(() => {
		const errorLog = formatErrorForLogging(error, {
			context: "chat-page",
		});

		logError("Chat page error", error, errorLog);

		// Report to error tracking if appropriate
		if (shouldReportError(error)) {
			if (typeof window !== "undefined" && (window as any).Sentry) {
				const Sentry = (window as any).Sentry;
				Sentry.captureException(error, {
					contexts: {
						error: errorLog,
					},
					tags: {
						page: "chat",
					},
				});
			}
		}
	}, [error]);

	const errorTitle = getErrorTitle(error);
	const errorMessage = getUserFriendlyErrorMessage(error);
	const isRecoverable = isRecoverableError(error);
	const category = getErrorCategory(error);
	const categorized = categorizeError(error);
	const isDev = process.env.NODE_ENV === "development";

	// Determine if this is a chat-specific error
	const isChatLoadError = category === "not_found" || category === "authorization";

	return (
		<div className="flex h-full flex-col items-center justify-center gap-4 p-6">
			<div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
				<AlertCircle className="size-6 text-destructive" aria-hidden="true" />
			</div>
			<div className="space-y-2 text-center">
				<h2 className="text-2xl font-semibold">{errorTitle}</h2>
				<p className="max-w-md text-sm text-muted-foreground">
					{errorMessage}
				</p>
				{isChatLoadError && (
					<p className="max-w-md text-sm text-muted-foreground">
						This chat may have been deleted or you may not have access to it.
					</p>
				)}
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
			<div className="flex gap-2">
				{isRecoverable && !isChatLoadError && (
					<Button onClick={reset} className="gap-2" aria-label="Try again">
						<RefreshCw className="size-4" aria-hidden="true" />
						Try Again
					</Button>
				)}
				<Button
					variant="outline"
					onClick={() => router.push("/")}
					className="gap-2"
					aria-label="Return to dashboard"
				>
					<Home className="size-4" aria-hidden="true" />
					Return to Dashboard
				</Button>
			</div>
		</div>
	);
}
