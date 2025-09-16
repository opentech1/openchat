"use client";

import { Check } from "lucide-react";

import { useBrandTheme } from "@/components/brand-theme-provider";
import { cn } from "@/lib/utils";

export default function ThemeSelector({ className }: { className?: string }) {
	const { theme, setTheme, themes } = useBrandTheme();

	return (
		<div
			role="radiogroup"
			aria-label="Select accent theme"
			className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
		>
			{themes.map((item) => {
				const isActive = item.id === theme;
				return (
					<button
						type="button"
						role="radio"
						aria-checked={isActive}
						onClick={() => setTheme(item.id)}
						key={item.id}
						className={cn(
							"group relative flex h-32 flex-col justify-between rounded-2xl border bg-card/80 p-4 text-left transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
							isActive
								? "border-ring shadow-lg shadow-ring/15"
								: "border-border/60 hover:-translate-y-1 hover:border-ring/70 hover:shadow-lg/20",
						)}
					>
						<div className="flex items-start justify-between">
							<div>
								<p className="text-base font-semibold tracking-tight">{item.label}</p>
							</div>
							<span
								className={cn(
									"absolute right-3 top-3 flex size-7 items-center justify-center rounded-full transition-all duration-200 ease-out",
									isActive
										? "opacity-100 scale-100 shadow-md"
										: "opacity-0 scale-75 border border-border/60 bg-background/80 text-muted-foreground group-hover:opacity-100 group-hover:scale-100",
								)}
								style={isActive ? { background: item.previewColor, color: item.previewForeground } : undefined}
							>
								<Check className="size-4" />
							</span>
						</div>
						<div
							className="mt-auto h-16 w-full rounded-xl transition-transform duration-200 ease-out group-hover:scale-[1.015]"
							style={{ background: item.previewColor }}
						/>
					</button>
				);
			})}
		</div>
	);
}
