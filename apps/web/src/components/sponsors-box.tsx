"use client";

import { memo, useState, useEffect } from "react";
import { HelpCircle, X } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";
import { getStorageItemSync, setStorageItemSync } from "@/lib/storage";
import { LOCAL_STORAGE_KEYS } from "@/config/storage-keys";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type Sponsor = {
	name: string;
	subtitle: string;
	href: string;
};

const SPONSORS: Sponsor[] = [
	{
		name: "Convex",
		subtitle: "Realtime backend",
		href: "https://convex.dev/referral/LEOPLA6358",
	},
	{
		name: "Greptile",
		subtitle: "AI code search",
		href: "https://app.greptile.com/signup?ref=NTE2NTItMzUzNTg=",
	},
	{
		name: "GitBook",
		subtitle: "Documentation platform",
		href: "https://www.gitbook.com",
	},
	{
		name: "Sentry",
		subtitle: "Error monitoring",
		href: "https://sentry.io",
	},
	{
		name: "Graphite",
		subtitle: "Stacked PRs",
		href: "https://graphite.dev",
	},
];

export const SponsorsBox = memo(function SponsorsBox() {
	const mounted = useMounted();
	const [isDismissed, setIsDismissed] = useState(false);

	// Check localStorage for dismissal state on mount
	useEffect(() => {
		const dismissed = getStorageItemSync(LOCAL_STORAGE_KEYS.FLAGS.SPONSORS_BOX_DISMISSED);
		if (dismissed === "true") {
			setIsDismissed(true);
		}
	}, []);

	const handleDismiss = () => {
		setIsDismissed(true);
		setStorageItemSync(LOCAL_STORAGE_KEYS.FLAGS.SPONSORS_BOX_DISMISSED, "true");
	};

	// Prevent hydration mismatch - render nothing until mounted
	// Also don't render if user has dismissed the box
	if (!mounted || isDismissed) {
		return null;
	}

	return (
		<div
			className={cn(
				"fixed bottom-6 right-6 z-50 hidden md:block",
				"bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
				"border border-border/60 rounded-lg shadow-lg",
				"px-3 py-2"
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between gap-4 mb-1.5">
				<span className="text-xs font-medium text-muted-foreground">
					Powered by
				</span>
				<div className="flex items-center gap-0.5">
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								className={cn(
									"p-1 rounded-md cursor-help",
									"text-muted-foreground"
								)}
								aria-label="Sponsor information"
							>
								<HelpCircle className="size-3.5" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="top">
							<p>We're grateful for our sponsors who support this project</p>
						</TooltipContent>
					</Tooltip>
					<button
						onClick={handleDismiss}
						className={cn(
							"p-1 rounded-md",
							"text-muted-foreground hover:text-foreground",
							"hover:bg-accent/50 transition-colors duration-150",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						)}
						aria-label="Dismiss sponsors box"
						type="button"
					>
						<X className="size-3.5" />
					</button>
				</div>
			</div>

			{/* Sponsor Links */}
			<div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs">
				{SPONSORS.map((sponsor, index) => (
					<span key={sponsor.name} className="flex items-center">
						<Tooltip>
							<TooltipTrigger asChild>
								<a
									href={sponsor.href}
									target="_blank"
									rel="noopener noreferrer"
									className={cn(
										"text-muted-foreground hover:text-foreground",
										"hover:underline underline-offset-2",
										"transition-colors duration-150",
										"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
									)}
								>
									{sponsor.name}
								</a>
							</TooltipTrigger>
							<TooltipContent side="top">
								<p>{sponsor.subtitle}</p>
							</TooltipContent>
						</Tooltip>
						{index < SPONSORS.length - 1 && (
							<span className="text-muted-foreground/50 mx-1" aria-hidden="true">
								·
							</span>
						)}
					</span>
				))}
			</div>
		</div>
	);
});
