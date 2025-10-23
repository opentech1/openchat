import catchAll, { config } from "./[...path].js";

export { config };

export default {
	async fetch(request: Request) {
		return catchAll.fetch(request);
	},
};
