import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: IndexRoute,
});

function IndexRoute() {
	return (
		<main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
			<h1>TanStack Start scaffold</h1>
			<p>This route tree will replace the existing Next.js pages during migration.</p>
		</main>
	);
}

