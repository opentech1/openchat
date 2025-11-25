import type { Metadata, Viewport } from "next";
import "../index.css";
import Providers from "@/components/providers";
import { Oxanium, Fira_Code } from "next/font/google";
import { cn } from "@/lib/utils";
import { RouteFocusManager } from "@/components/route-focus-manager";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { ErrorBoundary } from "@/components/error-boundary";
import { generateCombinedStructuredData, stringifyStructuredData } from "@/lib/structured-data";

const oxanium = Oxanium({
	subsets: ['latin'],
	variable: '--font-oxanium',
	display: 'swap',
	weight: ['300', '400', '500', '600', '700'],
});

const firaCode = Fira_Code({
	subsets: ['latin'],
	variable: '--font-fira-code',
	display: 'swap',
	weight: ['400', '500'],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
	title: {
		default: "OpenChat - Fast AI Chat",
		template: "%s · OpenChat",
	},
	description:
		"Fast, open source AI chat with 100+ models. ChatGPT alternative with GPT-4, Claude, Gemini & more. Free, customizable, self-hostable.",
	keywords: [
		"open source AI chat",
		"ChatGPT alternative",
		"self-hosted AI chat",
		"free AI chat",
		"AI models",
		"multi-model AI chat",
		"Claude alternative",
		"OpenChat",
		"GPT-4",
		"Claude",
		"Gemini",
		"AI chatbot",
		"open source chatbot",
		"TypeScript",
		"Next.js",
	],
	metadataBase: new URL(siteUrl),
	applicationName: "OpenChat",
	authors: [{ name: "OpenChat" }],
	creator: "OpenChat",
	openGraph: {
		title: "OpenChat - Fast AI Chat",
		description:
			"Fast, open source AI chat with 100+ models. ChatGPT alternative with GPT-4, Claude, Gemini & more. Free, customizable, self-hostable.",
		type: "website",
		url: siteUrl,
		siteName: "OpenChat",
		locale: "en_US",
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: "OpenChat - Fast AI Chat",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "OpenChat - Fast AI Chat",
		description:
			"Fast, open source AI chat with 100+ models. ChatGPT alternative with GPT-4, Claude, Gemini & more. Free, customizable, self-hostable.",
		images: ["/og-image.png"],
	},
	icons: {
		icon: "/favicon.ico",
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-snippet": -1,
			"max-image-preview": "large",
			"max-video-preview": -1,
		},
	},
	alternates: {
		canonical: "/",
	},
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#121212" },
	],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	const convexDomain = convexUrl ? new URL(convexUrl).hostname : null;

	// Generate structured data for SEO
	const structuredData = generateCombinedStructuredData({
		siteUrl,
		siteName: "OpenChat",
		description:
			"Fast, open source AI chat with 100+ models. ChatGPT alternative with GPT-4, Claude, Gemini & more. Free, customizable, self-hostable.",
	});

	return (
		<html
			lang="en"
			suppressHydrationWarning
			data-brand-theme="blue"
			className={`${oxanium.variable} ${firaCode.variable}`}>
			<head>
				{/* Resource hints for faster DNS resolution and connections */}
				{convexDomain && (
					<>
						{/* DNS prefetch for Convex domain */}
						<link rel="dns-prefetch" href={`https://${convexDomain}`} />
						{/* Preconnect for critical Convex endpoints */}
						<link rel="preconnect" href={`https://${convexDomain}`} crossOrigin="anonymous" />
					</>
				)}
				{/* DNS prefetch for PostHog analytics */}
				<link rel="dns-prefetch" href="https://us.i.posthog.com" />
				<link rel="dns-prefetch" href="https://us-assets.i.posthog.com" />
				{/* JSON-LD Structured Data for SEO */}
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: stringifyStructuredData(structuredData),
					}}
				/>
				{/* React Grab - Developer tool for element inspection */}
				{process.env.NODE_ENV === "development" && (
					<Script
						src="https://unpkg.com/react-grab/dist/index.global.js"
						crossOrigin="anonymous"
						strategy="beforeInteractive"
						data-enabled="true"
					/>
				)}
			</head>
			<body className={cn("font-sans antialiased", oxanium.className)}>
				<ErrorBoundary level="app">
					<Providers>
						<RouteFocusManager />
						{children}
					</Providers>
				</ErrorBoundary>
				<SpeedInsights />
				<Analytics mode="production" />
				{/* PostHog analytics - loaded after interactive to prevent blocking render */}
				<Script id="posthog" strategy="afterInteractive">
					{`!function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init Rr Mr fi Or Ar ci Tr Cr capture Mi calculateEventProperties Lr register register_once register_for_session unregister unregister_for_session Hr getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Ur jr createPersonProfile zr kr Br opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Dr debug M Nr getPageViewId captureTraceFeedback captureTraceMetric $r".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('phc_hWOxd18YQVTr0cSQ8X5OC3mfZY29cAthAXkxAPxiuqy', {
    api_host: 'https://us.i.posthog.com',
    defaults: '2025-05-24',
    person_profiles: 'identified_only',
})`}
				</Script>
			</body>
		</html>
	);
}
