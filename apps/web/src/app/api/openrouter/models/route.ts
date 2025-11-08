import { NextResponse } from "next/server";
import { z } from "zod";
import { logError } from "@/lib/logger-server";
import { apiKeySchema, createValidationErrorResponse } from "@/lib/validation";

const OPENROUTER_BASE_URL = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");

// Validation schema for the request body
const modelsRequestSchema = z.object({
	apiKey: apiKeySchema,
});

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

const parseNumericField = (candidate: unknown): number | null => {
	if (typeof candidate === "number" && Number.isFinite(candidate)) {
		return candidate;
	}
	if (typeof candidate === "string") {
		const sanitized = candidate.trim().replace(/^\$/, "");
		if (!sanitized) return null;
		const parsed = Number(sanitized);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

export async function POST(request: Request) {
	try {
		// Parse and validate request body
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json(
				{ ok: false, error: "Invalid JSON payload" },
				{ status: 400 }
			);
		}

		// Validate input using Zod schema
		const validation = modelsRequestSchema.safeParse(body);
		if (!validation.success) {
			return createValidationErrorResponse(validation.error);
		}

		const { apiKey } = validation.data;

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
				const contextLengthCandidate = candidate?.context_length;
				const contextLength =
					typeof contextLengthCandidate === "number"
						? contextLengthCandidate
						: parseNumericField(contextLengthCandidate);
				const pricingCandidate = candidate?.pricing as Record<string, unknown> | undefined;
				let pricing: OpenRouterModelOption["pricing"] | undefined;
				if (pricingCandidate && typeof pricingCandidate === "object") {
					const promptCost = parseNumericField(pricingCandidate?.prompt);
					const completionCost = parseNumericField(pricingCandidate?.completion);
					if (promptCost !== null || completionCost !== null) {
						pricing = { prompt: promptCost, completion: completionCost };
					}
				}
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
		logError("Failed to fetch OpenRouter models", error);
		return NextResponse.json({ ok: false, error: "Failed to fetch models" }, { status: 500 });
	}
}
