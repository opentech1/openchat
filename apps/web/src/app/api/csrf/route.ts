import { NextResponse } from "next/server";
import { generateCsrfToken, createCsrfCookie } from "@/lib/csrf";

/**
 * CSRF Token Endpoint
 *
 * GET /api/csrf - Returns a CSRF token in both cookie and response header
 * Clients should call this on initial load to get a CSRF token for subsequent requests
 */
export async function GET() {
	const token = generateCsrfToken();
	const isProduction = process.env.NODE_ENV === "production";

	const response = NextResponse.json({
		token,
		message: "CSRF token generated",
	});

	// Set CSRF token in cookie
	response.headers.set("Set-Cookie", createCsrfCookie(token, isProduction));

	// Also return token in header for client to read
	response.headers.set("X-CSRF-Token", token);

	return response;
}
