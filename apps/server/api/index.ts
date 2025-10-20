import { createApp } from "../src/app";

const app = createApp();

export const config = {
	runtime: "nodejs18.x",
};

export default app.fetch;
