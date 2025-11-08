import "./polyfills";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Register better-auth routes
// CORS is required for Next.js client-side auth requests
authComponent.registerRoutes(http, createAuth, { cors: true });

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({ ok: true, ts: new Date().toISOString() }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      },
    );
  }),
});

export default http;

