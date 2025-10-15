import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { getRouterManifest } from "@tanstack/react-start/router-manifest";
import { createRouter } from "./router";

export type RequestContext = {
	request: Request;
};

export default createStartHandler({
	createRouter,
	getRouterManifest,
	createRequestContext: async ({ request }) => ({
		request,
	}),
})(defaultStreamHandler);

declare module "@tanstack/react-start" {
	// eslint-disable-next-line @typescript-eslint/no-empty-interface
	interface Register {
		server: {
			requestContext: RequestContext;
		};
	}
}

