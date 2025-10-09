import { NextResponse } from "next/server";

const OPENROUTER_BASE_URL = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");

type OpenRouterModelOption = {
	value: string;
	label: string;
	description?: string;
	context?: number | null;
	pricing?: {
		prompt: number | null;
		completion: number | null;
	};
};

export async function POST(request: Request) {
	try {
		const body = (await request.json().catch(() => ({}))) as { apiKey?: unknown };
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

		const payload = (await response.json().catch(() => ({}))) as { data?: unknown };
		const data = Array.isArray(payload?.data) ? payload.data : [];
		const models = (data as unknown[])
			.map((entry: unknown): OpenRouterModelOption | null => {
				const candidate = entry as Record<string, unknown> | undefined | null;
				const id = typeof candidate?.id === "string"
					? candidate.id
					: typeof candidate?.name === "string"
						? candidate.name
						: "";
				if (!id) return null;
				const name = typeof candidate?.name === "string" && candidate.name.length > 0 ? candidate.name : id;
				const description = typeof candidate?.description === "string" && candidate.description.length > 0
					? candidate.description
					: undefined;
				const contextLength = typeof candidate?.context_length === "number" ? candidate.context_length : undefined;
				const pricingCandidate = candidate?.pricing as Record<string, unknown> | undefined;
				const pricing = pricingCandidate && typeof pricingCandidate === "object"
					? {
						prompt: typeof pricingCandidate?.prompt === "number" ? pricingCandidate.prompt : null,
						completion: typeof pricingCandidate?.completion === "number" ? pricingCandidate.completion : null,
					}
					: undefined;
				return {
					value: id,
					label: name,
					description,
					context: contextLength ?? null,
					pricing,
				};
			})
			.filter((model): model is OpenRouterModelOption => Boolean(model))
			.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

		return NextResponse.json({ ok: true, models });
	} catch (error) {
		console.error("/api/openrouter/models", error);
		return NextResponse.json({ ok: false, error: "Failed to fetch models" }, { status: 500 });
	}
}
