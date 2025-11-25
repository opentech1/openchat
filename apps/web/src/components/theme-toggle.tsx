"use client";

import * as React from "react";
import { Moon, Sun } from "@/lib/icons";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export default function ThemeToggle({
	fullWidth = false,
	asIcon = false,
	className,
}: {
	fullWidth?: boolean;
	asIcon?: boolean;
	className?: string;
}) {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => {
		setMounted(true);
	}, []);
	const isDark = mounted && resolvedTheme === "dark";

	// Just return the icon when used as an icon inside a parent button
	if (asIcon) {
		return mounted ? (isDark ? <Sun className="size-4" /> : <Moon className="size-4" />) : <Moon className="size-4" />;
	}

	if (fullWidth) {
		return (
			<button
				type="button"
				aria-label="Toggle theme"
				onClick={() => setTheme(isDark ? "light" : "dark")}
				className={cn(
					"flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors duration-100 ease-out hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					className
				)}
			>
				{mounted ? (
					isDark ? (
						<>
							<Sun className="size-4" />
							<span>Light Mode</span>
						</>
					) : (
						<>
							<Moon className="size-4" />
							<span>Dark Mode</span>
						</>
					)
				) : (
					<>
						<Moon className="size-4" />
						<span>Dark Mode</span>
					</>
				)}
			</button>
		);
	}

	return (
		<button
			type="button"
			aria-label="Toggle theme"
			onClick={() => setTheme(isDark ? "light" : "dark")}
			className={cn(
				"hover:bg-accent text-muted-foreground hover:text-accent-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				className
			)}
		>
			{mounted ? (isDark ? <Sun className="size-4" /> : <Moon className="size-4" />) : <Moon className="size-4" />}
		</button>
	);
}
