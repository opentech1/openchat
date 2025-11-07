"use client";

/**
 * Error Boundary for Chat Routes
 *
 * Catches and displays errors in individual chat sessions without
 * crashing the entire dashboard.
 *
 * CHAT-SPECIFIC ERROR HANDLING:
 * - Network errors (API failures, websocket disconnects)
 * - Invalid chat IDs (chat not found, access denied)
 * - Message sending failures
 * - Streaming interruptions
 *
 * RECOVERY STRATEGIES:
 * - Retry: For transient network errors
 * - Navigate back: For invalid/inaccessible chats
 * - Reload: For corrupted state
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, RefreshCw, MessageSquare } from "lucide-react";
import { logError } from "@/lib/logger";

/**
 * Chat Error Boundary Component
 *
 * @param error - The error that was thrown
 * @param reset - Function to attempt recovery by re-rendering the segment
 */
export default function ChatError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const router = useRouter();

	useEffect(() => {
		// Log error to monitoring service
		logError("Chat error", error);
	}, [error]);

	// Determine error type for better UX
	const errorMessage = error.message.toLowerCase();
	const isNotFound = errorMessage.includes("not found") || errorMessage.includes("404");
	const isAccessDenied = errorMessage.includes("access denied") || errorMessage.includes("unauthorized");
	const isNetworkError = errorMessage.includes("network") || errorMessage.includes("fetch");

	return (
		<div className="flex h-full flex-col items-center justify-center gap-6 p-6">
			{/* Error Icon */}
			<div className="flex justify-center">
				<div className="rounded-full bg-red-100 p-3 dark:bg-red-900/20">
					<AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
				</div>
			</div>

			{/* Error Message */}
			<div className="text-center space-y-2 max-w-md">
				<h2 className="text-2xl font-semibold">
					{isNotFound
						? "Chat not found"
						: isAccessDenied
							? "Access denied"
							: isNetworkError
								? "Connection error"
								: "Something went wrong"}
				</h2>
				<p className="text-sm text-muted-foreground">
					{isNotFound
						? "This chat doesn't exist or has been deleted."
						: isAccessDenied
							? "You don't have permission to view this chat."
							: isNetworkError
								? "We couldn't connect to the server. Please check your internet connection."
								: "An error occurred while loading the chat. This has been logged and we'll look into it."}
				</p>
				{error.digest && (
					<p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
				)}
			</div>

			{/* Error Details (Development Only) */}
			{process.env.NODE_ENV === "development" && (
				<div className="rounded-lg bg-muted p-4 text-left max-w-md w-full">
					<p className="mb-2 font-mono text-sm font-semibold">Error Details:</p>
					<p className="font-mono text-xs text-red-600 dark:text-red-400 break-all">
						{error.message}
					</p>
				</div>
			)}

			{/* Action Buttons */}
			<div className="flex flex-col gap-3 sm:flex-row">
				{/* Show retry button for network errors */}
				{isNetworkError && (
					<Button onClick={reset} className="gap-2">
						<RefreshCw className="h-4 w-4" />
						Retry
					</Button>
				)}

				{/* For not found or access denied, go back to dashboard */}
				{(isNotFound || isAccessDenied) ? (
					<Button onClick={() => router.push("/dashboard")} className="gap-2">
						<ArrowLeft className="h-4 w-4" />
						Back to Dashboard
					</Button>
				) : (
					<>
						<Button onClick={reset} variant="default" className="gap-2">
							<RefreshCw className="h-4 w-4" />
							Try Again
						</Button>
						<Button onClick={() => router.push("/dashboard")} variant="outline" className="gap-2">
							<ArrowLeft className="h-4 w-4" />
							Back to Dashboard
						</Button>
					</>
				)}

				{/* Create new chat option */}
				<Button onClick={() => router.push("/dashboard/new")} variant="outline" className="gap-2">
					<MessageSquare className="h-4 w-4" />
					New Chat
				</Button>
			</div>

			{/* Additional Help */}
			<div className="text-sm text-muted-foreground text-center max-w-md">
				<p>If this problem persists, try creating a new chat or contact support.</p>
			</div>
		</div>
	);
}
