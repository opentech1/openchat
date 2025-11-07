"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { focusMainContent } from "@/lib/focus-management";

/**
 * Manages focus restoration after route changes for accessibility
 */
export function RouteFocusManager() {
	const pathname = usePathname();
	const previousPathRef = useRef<string | null>(null);

	useEffect(() => {
		// Skip on initial render
		if (previousPathRef.current === null) {
			previousPathRef.current = pathname;
			return;
		}

		// Only handle focus if route actually changed
		if (previousPathRef.current !== pathname) {
			previousPathRef.current = pathname;

			// Use RAF to ensure content is rendered before focusing
			const rafId = requestAnimationFrame(() => {
				focusMainContent();
			});

			return () => cancelAnimationFrame(rafId);
		}
	}, [pathname]);

	return null;
}
