"use client";

import * as React from "react";
import { Moon, Sun } from "@/lib/icons";
import { useTheme } from "next-themes";
import { borderRadius, iconSize } from "@/styles/design-tokens";

export default function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => {
		setMounted(true);
	}, []);
	const isDark = mounted && resolvedTheme === "dark";
	return (
		<button
			type="button"
			aria-label="Toggle theme"
			onClick={() => setTheme(isDark ? "light" : "dark")}
			className={`hover:bg-accent text-muted-foreground hover:text-accent-foreground inline-flex size-9 items-center justify-center ${borderRadius.sm} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
		>
			{mounted ? (isDark ? <Sun className={iconSize.sm} /> : <Moon className={iconSize.sm} />) : <Moon className={iconSize.sm} />}
		</button>
	);
}
