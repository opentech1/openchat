import { getAppInstance } from "./load-app";

export const config = {
	runtime: "nodejs",
};

export default async function handler(request: Request) {
	const app = await getAppInstance();
	return app.fetch(request);
}
