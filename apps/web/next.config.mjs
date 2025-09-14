/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
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
    return config;
  },
};

export default nextConfig;
