"use client";

import dynamic from "next/dynamic";

// Import with ssr: false to avoid calling Convex hooks during SSR
const PosthogBootstrapClient = dynamic(
	() =>
		import("@/components/posthog-bootstrap-client").then(
			(mod) => mod.PosthogBootstrapClient
		),
	{ ssr: false }
);

export function PosthogBootstrap() {
	return <PosthogBootstrapClient />;
}
