"use client";

import dynamicImport from "next/dynamic";
import { NiceLoader } from "@/components/ui/nice-loader";

// Dynamically import TemplatesPageClient with ssr: false
// This is necessary because it uses Convex hooks which require ConvexProvider
const TemplatesPageClient = dynamicImport(
	() => import("@/components/templates/templates-page-client"),
	{
		ssr: false,
		loading: () => (
			<div className="w-full h-screen flex items-center justify-center">
				<NiceLoader message="Loading templates..." size="sm" />
			</div>
		),
	}
);

export default function TemplatesPage() {
	return <TemplatesPageClient />;
}
