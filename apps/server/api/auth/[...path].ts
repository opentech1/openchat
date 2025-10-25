export { config } from "../_utils/handler.js";
import { handleApiRequest } from "../_utils/handler.js";

export default {
	async fetch(request: Request) {
		return handleApiRequest(request);
	},
};
