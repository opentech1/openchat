export { config } from "./_utils/handler";
import { handleApiRequest } from "./_utils/handler";

export default {
	async fetch(request: Request) {
		return handleApiRequest(request);
	},
};
