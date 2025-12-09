"use client";

import { type ReactNode } from "react";
import { useMounted } from "@/hooks/use-mounted";

interface ClientOnlyProps {
	children: ReactNode;
	/**
	 * Fallback to show during SSR and initial hydration.
	 * Must be the same on server and client to prevent mismatch.
	 * Defaults to null (renders nothing).
	 */
	fallback?: ReactNode;
}

/**
 * Renders children only after client-side hydration is complete.
 *
 * This is a **drop-in replacement for Suspense** in client components
 * that prevents hydration mismatches caused by script injection
 * (from dev tools, analytics, theme providers, etc.).
 *
 * ## Why use this instead of Suspense?
 *
 * In client components, `<Suspense>` can cause hydration errors because:
 * 1. Server renders the Suspense boundary
 * 2. Scripts get injected into DOM (analytics, dev tools, etc.)
 * 3. Client hydration finds scripts where it expected Suspense
 * 4. React throws hydration mismatch error
 *
 * `<ClientOnly>` avoids this by:
 * 1. Server renders the fallback (or null)
 * 2. Client initial render also renders fallback (matches server!)
 * 3. After hydration, useEffect triggers and children render
 *
 * ## Usage
 *
 * ```tsx
 * // Instead of:
 * <Suspense fallback={<Loading />}>
 *   <MyComponent />
 * </Suspense>
 *
 * // Use:
 * <ClientOnly fallback={<Loading />}>
 *   <MyComponent />
 * </ClientOnly>
 * ```
 *
 * ## When to use
 *
 * - Components that use browser-only APIs
 * - Components with useSearchParams (Next.js requirement)
 * - Any client component that previously used Suspense
 * - Components that cause hydration mismatches
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
	const mounted = useMounted();

	if (!mounted) {
		return <>{fallback}</>;
	}

	return <>{children}</>;
}
