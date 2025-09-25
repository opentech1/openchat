import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
  },
  typedRoutes: true,
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ik.imagekit.io" },
    ],
  },
  async rewrites() {
    const server = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
    return [
      {
        source: "/rpc/:path*",
        destination: `${server}/rpc/:path*`,
      },
    ];
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    // Build CSP; in dev we omit CSP to avoid blocking Clerk scripts/workers
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.services",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://ik.imagekit.io",
      "font-src 'self' data:",
      "connect-src 'self' "+(process.env.NEXT_PUBLIC_SERVER_URL||"http://localhost:3000")+" https://*.clerk.com https://*.clerk.services ws: wss:",
      "frame-ancestors 'self'",
      "frame-src https://*.clerk.com",
      "worker-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    const base = [
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    const prodOnly = isProd
      ? [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        ]
      : [];
    return [
      {
        source: "/(.*)",
        headers: [...base, ...prodOnly],
      },
    ];
  },
  webpack(config, { dev }) {
    // Avoid filesystem cache serialization of very large strings in dev.
    // Using in-memory cache eliminates PackFileCacheStrategy warnings
    // and speeds up HMR for our setup.
    if (dev) {
      config.cache = { type: "memory" };
    }
    // In test, stub Clerk modules to avoid requiring real keys
		const hasClerkKeys = Boolean(
			process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
			process.env.CLERK_PUBLISHABLE_KEY ||
			process.env.CLERK_SECRET_KEY,
		);
		const isProdBuild = process.env.NODE_ENV === "production";
		const skipBuildCheck = false;
		const allowStubs = !isProdBuild;
		const forceStubs = process.env.NODE_ENV === "test";
		if (!hasClerkKeys && isProdBuild && !forceStubs && !skipBuildCheck) {
			throw new Error(
				"Clerk environment variables are required in production builds. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.",
			);
		}
		const useClerkStubs =
			forceStubs ||
			(!hasClerkKeys && (allowStubs || skipBuildCheck)) ||
			(!isProdBuild && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1");
		if (useClerkStubs) {
			const STUB_CLIENT = path.resolve(__dirname, "src/lib/clerk-stubs-client");
			const STUB_SERVER = path.resolve(__dirname, "src/lib/clerk-stubs-server");
			config.resolve = config.resolve || {};
			config.resolve.alias = {
				...config.resolve.alias,
				"@clerk/nextjs$": STUB_CLIENT,
				"@clerk/nextjs/server$": STUB_SERVER,
				"@clerk/clerk-react$": STUB_CLIENT,
			};
    }
    return config;
  },
};

export default nextConfig;
