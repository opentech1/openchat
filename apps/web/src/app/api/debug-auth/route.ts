import { NextResponse } from "next/server";

export async function GET() {
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
	
	// Derive site URL like the auth handler does
	let derivedSiteUrl: string | null = null;
	if (convexSiteUrl) {
		derivedSiteUrl = convexSiteUrl;
	} else if (convexUrl && convexUrl.includes('.convex.cloud')) {
		derivedSiteUrl = convexUrl.replace('.convex.cloud', '.convex.site');
	}
	
	return NextResponse.json({
		NEXT_PUBLIC_CONVEX_URL: convexUrl ?? "NOT SET",
		NEXT_PUBLIC_CONVEX_SITE_URL: convexSiteUrl ?? "NOT SET",
		derivedSiteUrl: derivedSiteUrl ?? "COULD NOT DERIVE",
		NODE_ENV: process.env.NODE_ENV,
		VERCEL_ENV: process.env.VERCEL_ENV ?? "NOT SET",
	});
}
