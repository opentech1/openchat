import { useState, useEffect } from "react";

/**
 * Hook to detect if component has mounted on the client.
 *
 * Use this to prevent hydration mismatches in client components.
 * Server and initial client render will have mounted=false,
 * then after hydration completes, mounted becomes true.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const mounted = useMounted();
 *   if (!mounted) return <LoadingSkeleton />;
 *   return <ActualContent />;
 * }
 * ```
 */
export function useMounted(): boolean {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return mounted;
}
