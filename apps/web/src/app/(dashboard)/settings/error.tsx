"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { logError } from "@/lib/logger";

export default function SettingsError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	const router = useRouter();

	useEffect(() => {
		logError("Settings error", error);
	}, [error]);

	return (
		<div className="flex h-full flex-col items-center justify-center gap-4 p-6">
			<div className="text-center space-y-2">
				<h2 className="text-2xl font-semibold">Failed to load settings</h2>
				<p className="text-sm text-muted-foreground max-w-md">
					An error occurred while loading settings. Please try again.
				</p>
				{error.digest && (
					<p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
				)}
			</div>
			<div className="flex gap-2">
				<Button onClick={reset}>Try again</Button>
				<Button variant="outline" onClick={() => router.push("/")}>
					Return to dashboard
				</Button>
			</div>
		</div>
	);
}
