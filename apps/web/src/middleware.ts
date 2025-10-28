import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware({
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
