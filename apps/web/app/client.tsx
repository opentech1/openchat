import { StartClient } from "@tanstack/react-start/client";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Root element #root not found");
}

hydrateRoot(
	rootElement,
	<StrictMode>
		<StartClient />
	</StrictMode>,
);

