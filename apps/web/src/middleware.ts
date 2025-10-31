import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware({
	redirectUri: process.env.NEXT_PUBLIC_APP_URL
		? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
		: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001"}/auth/callback`,
	middlewareAuth: {
		enabled: true,
		unauthenticatedPaths: ["/", "/auth/:path*", "/api/public/:path*"],
	},
	signUpPaths: ["/auth/sign-up"],
	debug: process.env.NODE_ENV !== "production",
});

export const config = {
	matcher: ["/((?!_next/|_static/|favicon\\.ico|.*\\.(?:png|jpg|svg|ico)).*)"],
};
