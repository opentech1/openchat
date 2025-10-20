import { createApp } from "../src/app";

const app = (() => {
	try {
		return createApp();
	} catch (error) {
		console.error("[server] Failed to initialise Elysia app", error);
		throw error;
	}
})();

export const config = {
	runtime: "nodejs20.x",
};

const fetchHandler = app.fetch.bind(app);

export default fetchHandler;
