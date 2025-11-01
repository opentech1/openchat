import type { Metadata, Viewport } from "next";
import "../index.css";
import Providers from "@/components/providers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

export const metadata: Metadata = {
	title: {
		default: "OpenChat — Open-source AI Chat Platform",
		template: "%s · OpenChat",
	},
	description:
		"Embed a fast, secure, and fully customizable AI chat into your product.",
	keywords: [
		"OpenChat",
		"AI chat",
		"open source",
		"chatbot",
		"customer support",
		"TypeScript",
		"Next.js",
	],
	metadataBase: new URL(siteUrl),
	applicationName: "OpenChat",
	authors: [{ name: "OpenChat" }],
	creator: "OpenChat",
	openGraph: {
		title: "OpenChat — Open-source AI Chat Platform",
		description:
			"Embed a fast, secure, and fully customizable AI chat into your product.",
		type: "website",
		url: siteUrl,
		siteName: "OpenChat",
		locale: "en_US",
	},
	twitter: {
		card: "summary_large_image",
		title: "OpenChat — Open-source AI Chat Platform",
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
					{children}
				</Providers>
			</body>
		</html>
	);
}
