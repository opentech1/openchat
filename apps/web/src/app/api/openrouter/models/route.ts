import { NextResponse } from "next/server";

const OPENROUTER_BASE_URL = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");

export async function POST(request: Request) {
	try {
		const body = await request.json().catch(() => ({}) as any);
		const apiKey = typeof body?.apiKey === "string" && body.apiKey.trim().length > 0 ? body.apiKey.trim() : null;
		if (!apiKey) {
			return NextResponse.json({ ok: false, error: "Missing apiKey" }, { status: 400 });
		}

		const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		});

		if (!response.ok) {
			const message = await response.text().catch(() => "");
			return NextResponse.json({ ok: false, status: response.status, message }, { status: response.status });
		}

		const payload = await response.json().catch(() => ({})) as any;
		const data = Array.isArray(payload?.data) ? payload.data : [];
		const models = data
			.map((entry: any) => {
				const id = typeof entry?.id === "string" ? entry.id : typeof entry?.name === "string" ? entry.name : "";
				if (!id) return null;
				const pricing = entry?.pricing && typeof entry.pricing === "object"
					? {
						prompt: typeof entry.pricing?.prompt === "number" ? entry.pricing.prompt : null,
						completion: typeof entry.pricing?.completion === "number" ? entry.pricing.completion : null,
					}
					: undefined;
				return {
					value: id,
					label: typeof entry?.name === "string" ? entry.name : id,
					pricing,
				};
			})
			.filter((model): model is { value: string; label: string; pricing?: { prompt: number | null; completion: number | null } } => Boolean(model));

		return NextResponse.json({ ok: true, models });
	} catch (error) {
		console.error("/api/openrouter/models", error);
		return NextResponse.json({ ok: false, error: "Failed to fetch models" }, { status: 500 });
	}
}
