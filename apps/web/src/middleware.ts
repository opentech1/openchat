import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
	// better-auth handles authentication via API routes
	// No middleware authentication needed - sessions are cookie-based
	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/|_static/|favicon\\.ico|.*\\.(?:png|jpg|svg|ico)).*)"],
};
