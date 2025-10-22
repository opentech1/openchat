import catchAll, { config } from "./[...path]";

export { config };

export default {
	async fetch(request: Request) {
		return catchAll.fetch(request);
	},
};
