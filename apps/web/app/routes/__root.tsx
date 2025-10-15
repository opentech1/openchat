import { Outlet } from "@tanstack/react-router";
import { createRootRouteWithContext } from "@tanstack/react-router";

type RootContext = {
	dehydratedState?: unknown;
};

export const Route = createRootRouteWithContext<RootContext>()({
	component: RootComponent,
});

function RootComponent() {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>OpenChat — TanStack Start</title>
			</head>
			<body>
				<Outlet />
			</body>
		</html>
	);
}

