import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
	enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		externalDir: true,
	},
	serverExternalPackages: ["better-sqlite3"],
	// SECURITY: Only expose non-sensitive variables to client
	// Secrets (GITHUB_CLIENT_SECRET, BETTER_AUTH_SECRET, etc.) should NOT be in env block
	// They are automatically available server-side via process.env
	env: {
		GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID, // Safe to expose (OAuth public client ID)
	},
	typedRoutes: true,
	// REMOVED: output: "standalone"
	// Vercel has its own runtime and doesn't need standalone mode
	// Keeping this enabled adds 150MB+ to builds and increases build time
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "ik.imagekit.io" },
			{ protocol: "https", hostname: "github.com" },
		],
	},
	/**
	 * SECURITY: Request body size limits
	 *
	 * Note: Next.js 15 does not support the 'api' config key.
	 * Body size limits are enforced via:
	 * 1. Next.js default (~1MB for API routes)
	 * 2. Zod validation with max length constraints (see lib/validation.ts)
	 * 3. Request validation in route handlers (try/catch on request.json())
	 *
	 * For custom limits, implement in individual route handlers or middleware.
	 */
	async rewrites() {
		const server = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
		return [
			{
				source: "/rpc/:path*",
				destination: `${server}/rpc/:path*`,
			},
			// Note: /api/auth routes are handled by this Next.js app directly
			// at src/app/api/auth/[...all]/route.ts - no proxy needed
		];
	},
	async headers() {
		const isProd = process.env.NODE_ENV === "production";
		const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
		const electricUrl = process.env.NEXT_PUBLIC_ELECTRIC_URL || "http://localhost:3010";
		const authUrl = process.env.BETTER_AUTH_URL;
		const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
		const posthogAssetsHost = "https://us-assets.i.posthog.com";
		const sentryIngest = "https://*.ingest.sentry.io";
		const additionalConnectSet = new Set(
			[serverUrl, electricUrl, authUrl, posthogHost]
			.filter(Boolean)
			.map((url) => {
				try {
					return new URL(url).origin;
				} catch {
					return null;
				}
			})
			.filter(Boolean),
		);
		additionalConnectSet.add(posthogAssetsHost);
		additionalConnectSet.add(sentryIngest);
		const additionalConnect = Array.from(additionalConnectSet);
		const scriptSrcSet = new Set(["'self'", "'unsafe-inline'", "'unsafe-eval'"]);
		for (const origin of additionalConnect) {
			if (origin) {
				scriptSrcSet.add(origin);
			}
		}
		const scriptSrc = Array.from(scriptSrcSet);
		const connectSrc = ["'self'", ...additionalConnect, "ws:", "wss:"];
		const imgSrc = ["'self'", "data:", "blob:", "https://ik.imagekit.io", "https://github.com"];
		const frameSrc = ["'self'"];
		const csp = [
			"default-src 'self'",
			`script-src ${scriptSrc.join(' ')}`,
			"style-src 'self' 'unsafe-inline'",
			`img-src ${imgSrc.join(' ')}`,
			"font-src 'self' data:",
			`connect-src ${connectSrc.join(' ')}`,
			`frame-src ${frameSrc.join(' ')}`,
			"worker-src 'self' blob:",
			"base-uri 'self'",
			"form-action 'self'",
		].join("; ");
		const baseHeaders = [
			{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
			{ key: "X-Content-Type-Options", value: "nosniff" },
			{ key: "X-Frame-Options", value: "SAMEORIGIN" },
			{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
		];
		const prodHeaders = isProd
			? [
				{ key: "Content-Security-Policy", value: csp },
				{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
			]
			: [];
		return [
			{
				source: "/(.*)",
				headers: [...baseHeaders, ...prodHeaders],
			},
		];
	},
	webpack(config, { dev, isServer }) {
		if (dev) {
			config.cache = { type: "memory" };
		}
		// Reduce memory usage in production builds
		if (!dev) {
			config.optimization = {
				...config.optimization,
				moduleIds: 'deterministic',
				// Use less memory-intensive minimizer settings
				minimize: true,
				// Enhanced code splitting for better caching
				splitChunks: !isServer ? {
					chunks: 'all',
					cacheGroups: {
						default: false,
						vendors: false,
						// Framework bundle (React, Next.js core)
						framework: {
							name: 'framework',
							test: /[\\/]node_modules[\\/](react|react-dom|scheduler|next[\\/])[\\/]/,
							priority: 40,
							enforce: true,
							reuseExistingChunk: true,
						},
						// Large UI libraries
						ui: {
							name: 'ui-libs',
							test: /[\\/]node_modules[\\/](@radix-ui|cmdk|sonner)[\\/]/,
							priority: 35,
							enforce: true,
							reuseExistingChunk: true,
						},
						// Data fetching and state management
						data: {
							name: 'data-libs',
							test: /[\\/]node_modules[\\/](@tanstack|@electric-sql)[\\/]/,
							priority: 30,
							enforce: true,
							reuseExistingChunk: true,
						},
						// AI SDK and related packages
						ai: {
							name: 'ai-libs',
							test: /[\\/]node_modules[\\/](ai|@ai-sdk|@openrouter)[\\/]/,
							priority: 30,
							enforce: true,
							reuseExistingChunk: true,
						},
						// Other node_modules
						lib: {
							test: /[\\/]node_modules[\\/]/,
							name(module) {
								const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1];
								return packageName ? `npm.${packageName.replace('@', '')}` : 'npm.other';
							},
							priority: 20,
							minChunks: 1,
							reuseExistingChunk: true,
						},
						// Common application code
						commons: {
							name: 'commons',
							minChunks: 2,
							priority: 10,
							reuseExistingChunk: true,
						},
					},
				} : undefined,
			};
			// Disable source maps if GENERATE_SOURCEMAP is false
			if (process.env.GENERATE_SOURCEMAP === 'false') {
				config.devtool = false;
			}
		}

		// Suppress warnings from Sentry and OpenTelemetry dynamic requires
		config.ignoreWarnings = [
			...(config.ignoreWarnings || []),
			/Critical dependency:/,
			/@opentelemetry/,
			/require-in-the-middle/,
		];

		// Suppress infrastructure logging warnings
		config.infrastructureLogging = {
			...config.infrastructureLogging,
			level: 'error',
		};

		return config;
	},
};

// Skip Sentry entirely if DSN is not configured OR in Vercel environment (saves build memory)
// Sentry adds 500MB+ to webpack cache and significantly increases build time
// Disable in Vercel to speed up deployments (can enable later if needed)
const shouldUseSentry =
	!process.env.VERCEL && // Skip Sentry in Vercel builds
	process.env.NEXT_PUBLIC_SENTRY_DSN &&
	process.env.NEXT_PUBLIC_SENTRY_DSN.length > 0;

// Apply bundle analyzer wrapper first, then Sentry
const configWithAnalyzer = withBundleAnalyzer(nextConfig);

const finalConfig = shouldUseSentry ? withSentryConfig(configWithAnalyzer, {
	// For all available options, see:
	// https://github.com/getsentry/sentry-webpack-plugin#options

	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,

	// Only print logs for uploading source maps in CI
	silent: !process.env.CI,

	// For all available options, see:
	// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

	// Upload a larger set of source maps for prettier stack traces (increases build time)
	widenClientFileUpload: true,

	// Automatically annotate React components to show their full name in breadcrumbs and session replay
	// DISABLED: This scans all React components during build and causes 5-10 minute hangs on Vercel
	// Re-enable only on faster CI (Blacksmith) or when debugging specific component issues
	reactComponentAnnotation: {
		enabled: false,
	},

	// Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
	// This can increase your server load as well as your hosting bill.
	// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
	// side errors will fail.
	tunnelRoute: "/monitoring",

	// Hides source maps from generated client bundles
	hideSourceMaps: true,

	// Automatically tree-shake Sentry logger statements to reduce bundle size
	disableLogger: true,

	// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
	// See the following for more information:
	// https://docs.sentry.io/product/crons/
	// https://vercel.com/docs/cron-jobs
	automaticVercelMonitors: true,
}) : configWithAnalyzer;

export default finalConfig;
