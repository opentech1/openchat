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
        source: "/api/auth/:path*",
        destination: `${server}/api/auth/:path*`,
      },
      {
        source: "/rpc/:path*",
        destination: `${server}/rpc/:path*`,
      },
    ];
  },
};

export default nextConfig;
