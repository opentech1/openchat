import { NextResponse } from "next/server";
import { serverClient } from "@/utils/orpc-server";
import { resolveServerBaseUrls } from "@/utils/server-url";

const { primary: SERVER_BASE_URL } = resolveServerBaseUrls();

function sanitizeString(value: unknown) {
	return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
	const payload = await request.json().catch(() => ({}));
	const name = sanitizeString(payload?.name);
	const email = sanitizeString(payload?.email).toLowerCase();
	const password = sanitizeString(payload?.password);
	const inviteCode = sanitizeString(payload?.inviteCode);
	const rememberMe = payload?.rememberMe === false ? false : true;

	if (!name || !email || !password || !inviteCode) {
		return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
	}

	const reserveResult = await serverClient.invite.reserve({ code: inviteCode, email });
	if (!reserveResult.ok || !reserveResult.reservationToken) {
		return NextResponse.json({ ok: false, error: "Invalid or already used invite code" }, { status: 400 });
	}

	const reservationToken = reserveResult.reservationToken;
	try {
		const signUpResponse = await fetch(`${SERVER_BASE_URL}/api/auth/sign-up/email`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				cookie: request.headers.get("cookie") ?? "",
				"user-agent": request.headers.get("user-agent") ?? "",
				"x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
			},
			body: JSON.stringify({ name, email, password, callbackURL: "/dashboard", rememberMe }),
			credentials: "include",
		});

		const responseBody = await signUpResponse.json().catch(() => ({}));
		if (!signUpResponse.ok || !responseBody?.user?.id) {
			await serverClient.invite.release({ reservationToken });
			const message = typeof responseBody?.message === "string" && responseBody.message.length > 0
				? responseBody.message
				: "Unable to create account";
			return NextResponse.json({ ok: false, error: message }, { status: signUpResponse.status });
		}

		const finalize = await serverClient.invite.consume({
			reservationToken,
			userId: responseBody.user.id as string,
			email,
		});
		if (!finalize.ok) {
			await serverClient.invite.release({ reservationToken });
			return NextResponse.json({ ok: false, error: "Failed to finalize invite" }, { status: 500 });
		}

		const nextResponse = NextResponse.json(responseBody, { status: 200 });
		const getSetCookie = (signUpResponse.headers as any).getSetCookie?.();
		if (Array.isArray(getSetCookie) && getSetCookie.length > 0) {
			for (const cookie of getSetCookie) {
				nextResponse.headers.append("set-cookie", cookie);
			}
		} else {
			const singleCookie = signUpResponse.headers.get("set-cookie");
			if (singleCookie) {
				nextResponse.headers.set("set-cookie", singleCookie);
			}
		}
		return nextResponse;
	} catch (error) {
		await serverClient.invite.release({ reservationToken });
		console.error("invite-sign-up", error);
		return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
	}
}
