import type { Metadata, Viewport } from "next";
import "../index.css";
import Providers from "@/components/providers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import { RouteFocusManager } from "@/components/route-focus-manager";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
	title: {
		default: "osschat — Open-source AI Chat Platform",
		template: "%s · osschat",
	},
	description:
		"Embed a fast, secure, and fully customizable AI chat into your product.",
	keywords: [
		"osschat",
		"OpenChat",
		"AI chat",
		"open source",
		"chatbot",
		"customer support",
		"TypeScript",
		"Next.js",
	],
	metadataBase: new URL(siteUrl),
	applicationName: "osschat",
	authors: [{ name: "osschat" }],
	creator: "osschat",
	openGraph: {
		title: "osschat — Open-source AI Chat Platform",
		description:
			"Embed a fast, secure, and fully customizable AI chat into your product.",
		type: "website",
		url: siteUrl,
		siteName: "osschat",
		locale: "en_US",
	},
	twitter: {
		card: "summary_large_image",
		title: "osschat — Open-source AI Chat Platform",
		description:
			"Embed a fast, secure, and fully customizable AI chat into your product.",
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
	return (
		<html
			lang="en"
			suppressHydrationWarning
			data-brand-theme="blue"
			className={`${GeistSans.variable} ${GeistMono.variable}`}>
			<head>
				<Script id="posthog" strategy="afterInteractive">
					{`!function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init Rr Mr fi Or Ar ci Tr Cr capture Mi calculateEventProperties Lr register register_once register_for_session unregister unregister_for_session Hr getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Ur jr createPersonProfile zr kr Br opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Dr debug M Nr getPageViewId captureTraceFeedback captureTraceMetric $r".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('phc_hWOxd18YQVTr0cSQ8X5OC3mfZY29cAthAXkxAPxiuqy', {
    api_host: 'https://us.i.posthog.com',
    defaults: '2025-05-24',
    person_profiles: 'identified_only',
})`}
				</Script>
			</head>
			<body className={cn("font-sans antialiased", GeistSans.className)}>
				<Providers>
					<RouteFocusManager />
					{children}
				</Providers>
				<SpeedInsights />
				<Analytics mode="production" />
			</body>
		</html>
	);
}
