import { Outlet } from "@tanstack/react-router";
import { createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import Providers from "@/components/providers";
import "@/index.css";

const SITE_URL =
	(typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
	process.env.VITE_SITE_URL ||
	process.env.NEXT_PUBLIC_SITE_URL ||
	"http://localhost:3001";

type RootContext = {
	dehydratedState?: unknown;
};

export const Route = createRootRouteWithContext<RootContext>()({
	component: RootComponent,
});

function RootComponent() {
	return (
		<html lang="en" suppressHydrationWarning data-brand-theme="blue">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" href="/favicon.ico" />
				<title>OpenChat — Open-source AI Chat Platform</title>
				<meta
					name="description"
					content="Embed a fast, secure, and fully customizable AI chat into your product."
				/>
				<meta property="og:title" content="OpenChat — Open-source AI Chat Platform" />
				<meta
					property="og:description"
					content="Embed a fast, secure, and fully customizable AI chat into your product."
				/>
				<meta property="og:type" content="website" />
				<meta property="og:url" content={SITE_URL} />
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:title" content="OpenChat — Open-source AI Chat Platform" />
				<meta
					name="twitter:description"
					content="Embed a fast, secure, and fully customizable AI chat into your product."
				/>
			</head>
			<body className="font-sans">
				<div id="root">
					<Providers>
						<Outlet />
					</Providers>
				</div>
				{import.meta.env.DEV ? <TanStackRouterDevtools /> : null}
			</body>
		</html>
	);
}
