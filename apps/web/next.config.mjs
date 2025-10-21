/** @type {import('next').NextConfig} */
const nextConfig = {
	experimental: {
		externalDir: true,
	},
	typedRoutes: true,
	output: "standalone",
	images: {
		remotePatterns: [{ protocol: "https", hostname: "ik.imagekit.io" }],
	},
	async rewrites() {
		const server = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
		return [
			{
				source: "/rpc/:path*",
				destination: `${server}/rpc/:path*`,
			},
			{
				source: "/api/auth/:path*",
				destination: `${server}/api/auth/:path*`,
			},
		];
	},
	async headers() {
		const isProd = process.env.NODE_ENV === "production";
		const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
		const electricUrl = process.env.NEXT_PUBLIC_ELECTRIC_URL || "http://localhost:3010";
		const authUrl = process.env.BETTER_AUTH_URL;
		const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
		const posthogAssetsHost = "https://us-assets.i.posthog.com";
		const additionalConnect = [serverUrl, electricUrl, authUrl, posthogHost]
			.filter(Boolean)
			.map((url) => {
				try {
					return new URL(url).origin;
				} catch {
					return null;
				}
			})
			.filter(Boolean);
		if (!additionalConnect.includes(posthogAssetsHost)) {
			additionalConnect.push(posthogAssetsHost);
		}
		const scriptSrc = ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
		if (additionalConnect.length > 0) {
			for (const origin of additionalConnect) {
				if (origin && !scriptSrc.includes(origin)) {
					scriptSrc.push(origin);
				}
			}
		}
		if (!scriptSrc.includes(posthogAssetsHost)) {
			scriptSrc.push(posthogAssetsHost);
		}
		const connectSrc = ["'self'", ...additionalConnect, "ws:", "wss:"];
		const imgSrc = ["'self'", "data:", "blob:", "https://ik.imagekit.io"];
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
	webpack(config, { dev }) {
		if (dev) {
			config.cache = { type: "memory" };
		}
		return config;
	},
};

export default nextConfig;
