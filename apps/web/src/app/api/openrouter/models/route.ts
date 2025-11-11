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
	popular?: boolean;
	free?: boolean;
	capabilities?: {
		reasoning?: boolean;
	};
};

// Popular models to feature at the top
const POPULAR_MODELS = new Set([
	"openai/gpt-5",
	"x-ai/grok-4-fast",
	"anthropic/claude-sonnet-4.5",
	"anthropic/claude-haiku-4.5",
	"google/gemini-2.5-pro",
	"google/gemini-2.5-flash-preview-0925",
	"z-ai/glm-4.6",
	"deepseek/deepseek-r1-0528:free",
	"openrouter/polaris-alpha",
]);

// Free models to highlight
const FREE_MODELS = new Set([
	"deepseek/deepseek-r1-0528:free",
	"openrouter/polaris-alpha",
	"google/gemini-2.0-flash-exp:free",
	"meta-llama/llama-3.2-3b-instruct:free",
	"meta-llama/llama-3.2-1b-instruct:free",
	"mistralai/mistral-7b-instruct:free",
	"mistralai/mistral-nemo:free",
	"qwen/qwen-2.5-7b-instruct:free",
]);

// Models with reasoning capabilities
// Based on AI SDK docs: Claude 4, GPT-5, DeepSeek R1, Gemini 2.5, o1/o3, Cohere reasoning, Mistral magistral
function hasReasoningCapability(modelId: string): boolean {
	const lowerModelId = modelId.toLowerCase();
	return (
		lowerModelId.includes("claude-3-7-sonnet") ||
		lowerModelId.includes("claude-opus-4") ||
		lowerModelId.includes("claude-sonnet-4") ||
		lowerModelId.includes("gpt-5") ||
		lowerModelId.includes("deepseek-r1") ||
		lowerModelId.includes("deepseek-reasoner") ||
		lowerModelId.includes("gemini-2.5") ||
		lowerModelId.includes("gemini-2.0-flash-thinking") ||
		lowerModelId.includes("/o1") ||
		lowerModelId.includes("/o3") ||
		lowerModelId.includes("magistral") ||
		lowerModelId.includes("command-a-reasoning") ||
		lowerModelId.includes("qwen3") && lowerModelId.includes("thinking")
	);
}

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
				const isFree = FREE_MODELS.has(id);
				const isPopular = POPULAR_MODELS.has(id);
				const hasReasoning = hasReasoningCapability(id);

				// Remove provider prefix (e.g., "Google: Gemini 2.5 Pro" -> "Gemini 2.5 Pro")
				const cleanName = name.includes(":") ? name.split(":").slice(1).join(":").trim() : name;

				// Don't add "(free)" if the name already contains it
				const displayLabel = isFree && !cleanName.toLowerCase().includes("(free)") ? `${cleanName} (free)` : cleanName;

				return {
					value: id,
					label: displayLabel,
					description,
					context: contextLength ?? null,
					pricing,
					popular: isPopular,
					free: isFree,
					capabilities: hasReasoning ? { reasoning: true } : undefined,
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
