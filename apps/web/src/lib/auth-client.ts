import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

// The convexClient plugin handles routing automatically
export const authClient = createAuthClient({
	plugins: [convexClient()],
});
