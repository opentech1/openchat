import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logError } from "@/lib/logger-server";
import { apiKeySchema, createValidationErrorResponse } from "@/lib/validation";
import {
	hasReasoningCapability,
	hasImageCapability,
	hasAudioCapability,
	hasVideoCapability,
	hasMandatoryReasoning,
} from "@/lib/model-capabilities";
import { modelsCache, isRedisCacheAvailable } from "@/lib/cache";
import type { CachedModelOption } from "@/lib/cache";

// Get base URL with fallback - using env var directly to avoid build-time validation
const OPENROUTER_BASE_URL = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");

// Cache configuration constants
const L1_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const L1_CACHE_MAX_SIZE = 100; // Maximum entries in L1 cache
const L2_CACHE_TTL_SECONDS = 1800; // 30 minutes
const CACHE_CONTROL_MAX_AGE = 300; // 5 minutes for HTTP Cache-Control

// L1 Cache: In-memory cache for same-instance hits (fastest)
// Uses proper LRU: on cache hit, entry is re-inserted to mark as recently used
// Eviction removes the oldest key (first in Map iteration order)
type L1CacheEntry = {
	data: OpenRouterModelOption[];
	timestamp: number;
};
const modelMemoryCache = new Map<string, L1CacheEntry>();

// Inflight request deduplication to prevent thundering herd
// When multiple concurrent requests arrive with the same API key and cache is cold,
// only one request hits OpenRouter API; others wait for the same promise
const inflightRequests = new Map<string, Promise<OpenRouterModelOption[]>>();

/**
 * Creates a secure cache key from an API key using SHA-256 hash.
 * Using only a prefix of the API key would allow cache collisions between
 * users with similar API keys, leaking cached data across accounts.
 */
function createCacheKey(apiKey: string): string {
	return createHash("sha256").update(apiKey).digest("hex").substring(0, 32);
}

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
		image?: boolean;
		audio?: boolean;
		video?: boolean;
		mandatoryReasoning?: boolean;
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

/**
 * Fetches models from OpenRouter API and transforms them into our format.
 * This is extracted into a helper function to support request deduplication.
 * @throws Error if the API request fails
 */
async function fetchModelsFromOpenRouter(apiKey: string): Promise<OpenRouterModelOption[]> {
	const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	});

	if (!response.ok) {
		const message = await response.text().catch(() => "");
		throw new Error(`OpenRouter API error: ${response.status} ${message}`);
	}

	const payload = (await response.json().catch(() => ({}))) as { data?: unknown };
	const data = Array.isArray(payload?.data) ? payload.data : [];

	return (data as unknown[])
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

			// HYBRID: Try OpenRouter API data first, fallback to static detection
			// This ensures we always show capabilities even if OpenRouter doesn't provide the flags
			const hasReasoning = candidate?.supports_reasoning === true || hasReasoningCapability(id);
			const hasImage = candidate?.supports_images === true || hasImageCapability(id);
			const hasAudio = candidate?.supports_audio === true || hasAudioCapability(id);
			const hasVideo = candidate?.supports_video === true || hasVideoCapability(id);
			const isMandatoryReasoning = candidate?.is_mandatory_reasoning === true || hasMandatoryReasoning(id);

			// Remove provider prefix (e.g., "Google: Gemini 2.5 Pro" -> "Gemini 2.5 Pro")
			const cleanName = name.includes(":") ? name.split(":").slice(1).join(":").trim() : name;

			// Don't add "(free)" if the name already contains it
			const displayLabel = isFree && !cleanName.toLowerCase().includes("(free)") ? `${cleanName} (free)` : cleanName;

			// Build capabilities object only if there are any capabilities
			const capabilities: OpenRouterModelOption["capabilities"] = {};
			if (hasReasoning) capabilities.reasoning = true;
			if (hasImage) capabilities.image = true;
			if (hasAudio) capabilities.audio = true;
			if (hasVideo) capabilities.video = true;
			if (isMandatoryReasoning) capabilities.mandatoryReasoning = true;

			return {
				value: id,
				label: displayLabel,
				description,
				context: contextLength ?? null,
				pricing,
				popular: isPopular,
				free: isFree,
				capabilities: Object.keys(capabilities).length > 0 ? capabilities : undefined,
			};
		})
		.filter((model): model is OpenRouterModelOption => Boolean(model))
		.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

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

		// Create secure cache key using SHA-256 hash of full API key
		// Using only a prefix would allow cache collisions between similar keys
		const apiKeyHash = createCacheKey(apiKey);
		const now = Date.now();

		// L1: Check in-memory cache first (fastest, same-instance)
		const l1Cached = modelMemoryCache.get(apiKeyHash);
		if (l1Cached && (now - l1Cached.timestamp) < L1_CACHE_TTL_MS) {
			// Re-insert to mark as recently used (proper LRU behavior)
			// JavaScript Map maintains insertion order, so this moves the entry to the end
			modelMemoryCache.delete(apiKeyHash);
			modelMemoryCache.set(apiKeyHash, l1Cached);

			return NextResponse.json(
				{ ok: true, models: l1Cached.data },
				{
					headers: {
						'Cache-Control': `private, max-age=${CACHE_CONTROL_MAX_AGE}`,
						'X-Cache': 'HIT-L1',
					},
				}
			);
		}

		// L2: Check Redis cache (shared across instances)
		if (isRedisCacheAvailable()) {
			try {
				const l2Cached = await modelsCache.get(apiKeyHash);
				if (l2Cached && l2Cached.models.length > 0) {
					// Evict oldest entry if at capacity (proper LRU: oldest is first in iteration order)
					if (modelMemoryCache.size >= L1_CACHE_MAX_SIZE) {
						const oldestKey = modelMemoryCache.keys().next().value;
						if (oldestKey) modelMemoryCache.delete(oldestKey);
					}

					// Update L1 cache with L2 data, using original cachedAt timestamp
					// This ensures TTL consistency across cache tiers
					modelMemoryCache.set(apiKeyHash, {
						data: l2Cached.models as OpenRouterModelOption[],
						timestamp: l2Cached.cachedAt,
					});

					return NextResponse.json(
						{ ok: true, models: l2Cached.models },
						{
							headers: {
								'Cache-Control': `private, max-age=${CACHE_CONTROL_MAX_AGE}`,
								'X-Cache': 'HIT-L2',
							},
						}
					);
				}
			} catch (error) {
				// Redis error - continue to fetch from OpenRouter
				logError("Redis cache read failed, falling back to API", error);
			}
		}

		// Thundering herd prevention: check if there's already an inflight request for this key
		// Multiple concurrent requests with the same API key will share the same promise
		const existingRequest = inflightRequests.get(apiKeyHash);
		if (existingRequest) {
			try {
				const models = await existingRequest;
				return NextResponse.json(
					{ ok: true, models },
					{
						headers: {
							'Cache-Control': `private, max-age=${CACHE_CONTROL_MAX_AGE}`,
							'X-Cache': 'DEDUP',
						},
					}
				);
			} catch {
				// Inflight request failed, continue to make our own request
			}
		}

		// Create the fetch promise and store it for deduplication
		const fetchPromise = fetchModelsFromOpenRouter(apiKey);
		inflightRequests.set(apiKeyHash, fetchPromise);

		try {
			const models = await fetchPromise;

			const cacheTimestamp = Date.now();

			// Evict oldest entry if at capacity before inserting new one
			if (modelMemoryCache.size >= L1_CACHE_MAX_SIZE) {
				const oldestKey = modelMemoryCache.keys().next().value;
				if (oldestKey) modelMemoryCache.delete(oldestKey);
			}

			// Update L1 cache (in-memory)
			modelMemoryCache.set(apiKeyHash, {
				data: models,
				timestamp: cacheTimestamp,
			});

			// Update L2 cache (Redis) - async, don't block response
			if (isRedisCacheAvailable()) {
				modelsCache.set(apiKeyHash, {
					models: models as CachedModelOption[],
					cachedAt: cacheTimestamp,
				}, L2_CACHE_TTL_SECONDS).catch((error) => {
					logError("Redis cache write failed", error);
				});
			}

			return NextResponse.json(
				{ ok: true, models },
				{
					headers: {
						'Cache-Control': `private, max-age=${CACHE_CONTROL_MAX_AGE}`,
						'X-Cache': 'MISS',
					},
				}
			);
		} finally {
			// Always clean up the inflight request, whether it succeeded or failed
			inflightRequests.delete(apiKeyHash);
		}
	} catch (error) {
		logError("Failed to fetch OpenRouter models", error);
		return NextResponse.json({ ok: false, error: "Failed to fetch models" }, { status: 500 });
	}
}
