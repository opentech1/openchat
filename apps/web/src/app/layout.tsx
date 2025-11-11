import type { Metadata, Viewport } from "next";
import "../index.css";
import Providers from "@/components/providers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import { RouteFocusManager } from "@/components/route-focus-manager";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
			<body className={cn("font-sans antialiased", GeistSans.className)}>
				<Providers>
					<RouteFocusManager />
					{children}
				</Providers>
				<SpeedInsights />
			</body>
		</html>
	);
}
