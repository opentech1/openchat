import { createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30000,
    defaultPendingMs: 150,
    defaultPendingMinMs: 200,
  });

  return router;
};
