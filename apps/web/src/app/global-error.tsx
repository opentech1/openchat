"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { GalleryVerticalEnd } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log error to Sentry
		Sentry.captureException(error);
	}, [error]);

	return (
		<html>
			<body>
				<div className="flex min-h-screen items-center justify-center p-6">
					<div className="w-full max-w-md space-y-6 text-center">
						<div className="mx-auto flex size-12 items-center justify-center rounded-md bg-destructive/10">
							<GalleryVerticalEnd className="size-6 text-destructive" />
						</div>
						<div className="space-y-2">
							<h1 className="text-2xl font-semibold">Something went wrong!</h1>
							<p className="text-muted-foreground text-sm">
								An unexpected error occurred. Our team has been notified.
							</p>
							{error.digest && (
								<p className="text-xs text-muted-foreground">
									Error ID: {error.digest}
								</p>
							)}
						</div>
						<div className="flex flex-col gap-2">
							<button
								onClick={reset}
								className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition"
							>
								Try again
							</button>
							<Link
								href="/"
								className="text-muted-foreground hover:text-foreground inline-flex w-full items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium transition"
							>
								Go home
							</Link>
						</div>
					</div>
				</div>
			</body>
		</html>
	);
}
