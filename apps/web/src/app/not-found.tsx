import Link from "next/link";

/**
 * Simple 404 Not Found page.
 *
 * This page is statically generated and must NOT use any client-side
 * providers (Convex, Auth, etc.) to avoid build-time errors.
 */
export default function NotFound() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
			<h1 className="mb-4 text-6xl font-bold">404</h1>
			<p className="mb-8 text-xl text-muted-foreground">Page not found</p>
			<Link
				href="/"
				className="rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-primary/90"
			>
				Go Home
			</Link>
		</div>
	);
}
