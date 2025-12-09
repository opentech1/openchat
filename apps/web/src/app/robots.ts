import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	// Use environment variables to determine the site URL dynamically
	// This prevents hardcoding production URLs that break in other environments
	const baseUrl =
		process.env.NEXT_PUBLIC_SITE_URL ||
		process.env.NEXT_PUBLIC_APP_URL ||
		process.env.SITE_URL ||
		"https://openchat.dev";

	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/api/", "/admin/", "/_next/", "/auth/"],
			},
			{
				userAgent: ["AhrefsBot", "SemrushBot"],
				crawlDelay: 10,
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
