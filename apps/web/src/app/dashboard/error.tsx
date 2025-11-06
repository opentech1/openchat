"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("Dashboard error:", error);
	}, [error]);

	return (
		<div className="flex h-full flex-col items-center justify-center gap-4 p-6">
			<div className="text-center space-y-2">
				<h2 className="text-2xl font-semibold">Something went wrong</h2>
				<p className="text-sm text-muted-foreground max-w-md">
					An error occurred while loading the dashboard. Please try again.
				</p>
				{error.digest && (
					<p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
				)}
			</div>
			<Button onClick={reset}>Try again</Button>
		</div>
	);
}
