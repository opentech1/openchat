/**
 * AI Models - OpenRouter Model Management
 *
 * Provides:
 * - Daily sync from OpenRouter API (200+ models)
 * - Featured models curation (15-20 hand-picked)
 * - Search across all models
 * - User favorites management
 */

import { v } from "convex/values";
import {
	query,
	mutation,
	internalMutation,
	internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================================================
// Constants
// ============================================================================

/**
 * Featured models - manually curated list of high-quality, popular models
 * These appear in the default model selector view
 * Order determines display order (lower = higher priority)
 */
const FEATURED_MODELS = [
	// Anthropic (top-tier)
	"anthropic/claude-sonnet-4",
	"anthropic/claude-3.5-sonnet",
	"anthropic/claude-3.5-haiku",
	"anthropic/claude-3-opus",
	// OpenAI
	"openai/gpt-4o",
	"openai/gpt-4o-mini",
	"openai/o1",
	"openai/o3-mini",
	// Google
	"google/gemini-2.0-flash-exp",
	"google/gemini-1.5-pro",
	// DeepSeek (reasoning)
	"deepseek/deepseek-r1",
	"deepseek/deepseek-chat",
	// Meta (open source)
	"meta-llama/llama-3.3-70b-instruct",
	// xAI
	"x-ai/grok-2-1212",
	// Mistral
	"mistralai/mistral-large-2411",
];

/**
 * Patterns to identify legacy/deprecated models
 * These are hidden by default but searchable
 */
const LEGACY_PATTERNS = [
	/-preview$/i,
	/-0[0-9]{3}$/i, // Date suffixes like -0301
	/deprecated/i,
	/beta$/i,
	/-instruct-\d/i, // Old instruct versions
];

// ============================================================================
// Internal Actions (for cron jobs)
// ============================================================================

/**
 * Sync models from OpenRouter API
 * Called by daily cron job
 */
export const syncModelsFromOpenRouter = internalAction({
	args: {},
	handler: async (ctx) => {
		console.log("[Models] Starting sync from OpenRouter API...");

		try {
			const response = await fetch("https://openrouter.ai/api/v1/models", {
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				throw new Error(
					`OpenRouter API error: ${response.status} ${response.statusText}`
				);
			}

			const data = await response.json();
			const models = data.data || [];

			console.log(`[Models] Fetched ${models.length} models from OpenRouter`);

			let synced = 0;
			let featured = 0;
			let legacy = 0;

			for (const model of models) {
				// Skip models without an ID
				if (!model.id) continue;

				// Determine if legacy
				const isLegacy = LEGACY_PATTERNS.some((pattern) =>
					pattern.test(model.id)
				);

				// Determine if featured (and not legacy)
				const featuredIndex = FEATURED_MODELS.indexOf(model.id);
				const isFeatured = featuredIndex !== -1 && !isLegacy;

				// Extract provider from model ID (e.g., "anthropic/claude-sonnet-4" -> "anthropic")
				const provider = model.id.split("/")[0] || "unknown";

				// Upsert model (convert null to undefined for optional fields)
				await ctx.runMutation(internal.models.upsertModel, {
					openRouterId: model.id,
					name: model.name || model.id,
					provider,
					contextLength: model.context_length || 4096,
					maxOutputLength: model.top_provider?.max_completion_tokens ?? undefined,
					inputModalities: model.architecture?.modality?.split("+") || ["text"],
					outputModalities: ["text"], // Most models output text
					supportedFeatures: extractFeatures(model),
					pricingPrompt: model.pricing?.prompt?.toString() ?? undefined,
					pricingCompletion: model.pricing?.completion?.toString() ?? undefined,
					isFeatured,
					isLegacy,
					featuredOrder: isFeatured ? featuredIndex : undefined,
					description: model.description ?? undefined,
				});

				synced++;
				if (isFeatured) featured++;
				if (isLegacy) legacy++;
			}

			console.log(
				`[Models] Sync complete: ${synced} models synced (${featured} featured, ${legacy} legacy)`
			);

			return { success: true, synced, featured, legacy };
		} catch (error) {
			console.error("[Models] Sync failed:", error);
			throw error;
		}
	},
});

/**
 * Extract supported features from OpenRouter model data
 */
function extractFeatures(model: any): string[] {
	const features: string[] = [];

	// Check for vision/image support
	if (
		model.architecture?.modality?.includes("image") ||
		model.architecture?.input_modalities?.includes("image")
	) {
		features.push("vision");
	}

	// Check for tool/function calling
	if (model.supported_parameters?.includes("tools")) {
		features.push("tools");
	}

	// Check for reasoning (Claude, o1, DeepSeek R1)
	if (
		model.id.includes("claude") ||
		model.id.includes("o1") ||
		model.id.includes("o3") ||
		model.id.includes("deepseek-r1")
	) {
		features.push("reasoning");
	}

	// Check for JSON mode
	if (model.supported_parameters?.includes("response_format")) {
		features.push("json_mode");
	}

	return features;
}

/**
 * Upsert a single model (called from sync action)
 */
export const upsertModel = internalMutation({
	args: {
		openRouterId: v.string(),
		name: v.string(),
		provider: v.string(),
		contextLength: v.number(),
		maxOutputLength: v.optional(v.number()),
		inputModalities: v.array(v.string()),
		outputModalities: v.array(v.string()),
		supportedFeatures: v.array(v.string()),
		pricingPrompt: v.optional(v.string()),
		pricingCompletion: v.optional(v.string()),
		isFeatured: v.boolean(),
		isLegacy: v.boolean(),
		featuredOrder: v.optional(v.number()),
		description: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		// Check if model exists
		const existing = await ctx.db
			.query("aiModels")
			.withIndex("by_openrouter_id", (q) =>
				q.eq("openRouterId", args.openRouterId)
			)
			.unique();

		if (existing) {
			// Update existing model
			await ctx.db.patch(existing._id, {
				name: args.name,
				provider: args.provider,
				contextLength: args.contextLength,
				maxOutputLength: args.maxOutputLength,
				inputModalities: args.inputModalities,
				outputModalities: args.outputModalities,
				supportedFeatures: args.supportedFeatures,
				pricingPrompt: args.pricingPrompt,
				pricingCompletion: args.pricingCompletion,
				isFeatured: args.isFeatured,
				isLegacy: args.isLegacy,
				featuredOrder: args.featuredOrder,
				description: args.description,
				lastSyncedAt: now,
				updatedAt: now,
			});
		} else {
			// Create new model
			await ctx.db.insert("aiModels", {
				openRouterId: args.openRouterId,
				name: args.name,
				provider: args.provider,
				contextLength: args.contextLength,
				maxOutputLength: args.maxOutputLength,
				inputModalities: args.inputModalities,
				outputModalities: args.outputModalities,
				supportedFeatures: args.supportedFeatures,
				pricingPrompt: args.pricingPrompt,
				pricingCompletion: args.pricingCompletion,
				isFeatured: args.isFeatured,
				isLegacy: args.isLegacy,
				featuredOrder: args.featuredOrder,
				description: args.description,
				lastSyncedAt: now,
				createdAt: now,
				updatedAt: now,
			});
		}
	},
});

// ============================================================================
// Public Queries
// ============================================================================

/**
 * List featured models (default view in model selector)
 * Returns ~15-20 curated models sorted by featured order
 */
export const listFeatured = query({
	args: {
		userId: v.optional(v.id("users")),
	},
	handler: async (ctx, args) => {
		// Get featured models
		const models = await ctx.db
			.query("aiModels")
			.withIndex("by_featured", (q) => q.eq("isFeatured", true))
			.collect();

		// Get user favorites if authenticated
		let favoriteIds = new Set<string>();
		const userId = args.userId;
		if (userId) {
			const favorites = await ctx.db
				.query("userModelFavorites")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.collect();
			favoriteIds = new Set(favorites.map((f) => f.modelId));
		}

		// Sort by featured order and add favorite flag
		return models
			.sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999))
			.map((m) => ({
				...m,
				isFavorite: favoriteIds.has(m.openRouterId),
			}));
	},
});

/**
 * Search models by name
 * Returns all matching models (including legacy when searched)
 */
export const search = query({
	args: {
		query: v.string(),
		userId: v.optional(v.id("users")),
		includeLegacy: v.optional(v.boolean()),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const searchLimit = args.limit ?? 50;

		// Use search index for name matching
		let results = await ctx.db
			.query("aiModels")
			.withSearchIndex("search_models", (q) => q.search("name", args.query))
			.take(searchLimit);

		// Filter out legacy unless requested
		if (!args.includeLegacy) {
			results = results.filter((m) => !m.isLegacy);
		}

		// Get user favorites if authenticated
		let favoriteIds = new Set<string>();
		const userId = args.userId;
		if (userId) {
			const favorites = await ctx.db
				.query("userModelFavorites")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.collect();
			favoriteIds = new Set(favorites.map((f) => f.modelId));
		}

		return results.map((m) => ({
			...m,
			isFavorite: favoriteIds.has(m.openRouterId),
		}));
	},
});

/**
 * Get user's favorite models
 */
export const listFavorites = query({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		// Get favorite model IDs
		const favorites = await ctx.db
			.query("userModelFavorites")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();

		// Fetch full model data for each favorite
		const models = await Promise.all(
			favorites.map(async (fav) => {
				const model = await ctx.db
					.query("aiModels")
					.withIndex("by_openrouter_id", (q) =>
						q.eq("openRouterId", fav.modelId)
					)
					.unique();
				return model ? { ...model, isFavorite: true, addedAt: fav.addedAt } : null;
			})
		);

		// Filter out nulls and sort by when added (most recent first)
		return models
			.filter((m): m is NonNullable<typeof m> => m !== null)
			.sort((a, b) => b.addedAt - a.addedAt);
	},
});

/**
 * Get a single model by OpenRouter ID
 */
export const getByOpenRouterId = query({
	args: {
		openRouterId: v.string(),
		userId: v.optional(v.id("users")),
	},
	handler: async (ctx, args) => {
		const model = await ctx.db
			.query("aiModels")
			.withIndex("by_openrouter_id", (q) =>
				q.eq("openRouterId", args.openRouterId)
			)
			.unique();

		if (!model) return null;

		// Check if favorited
		let isFavorite = false;
		const userId = args.userId;
		if (userId) {
			const favorite = await ctx.db
				.query("userModelFavorites")
				.withIndex("by_user_model", (q) =>
					q.eq("userId", userId).eq("modelId", args.openRouterId)
				)
				.unique();
			isFavorite = favorite !== null;
		}

		return { ...model, isFavorite };
	},
});

// ============================================================================
// Public Mutations (Favorites)
// ============================================================================

/**
 * Add a model to favorites
 */
export const addFavorite = mutation({
	args: {
		userId: v.id("users"),
		modelId: v.string(),
	},
	handler: async (ctx, args) => {
		// Check if already favorited
		const existing = await ctx.db
			.query("userModelFavorites")
			.withIndex("by_user_model", (q) =>
				q.eq("userId", args.userId).eq("modelId", args.modelId)
			)
			.unique();

		if (existing) {
			return { success: true, alreadyExists: true };
		}

		// Add favorite
		await ctx.db.insert("userModelFavorites", {
			userId: args.userId,
			modelId: args.modelId,
			addedAt: Date.now(),
		});

		return { success: true, alreadyExists: false };
	},
});

/**
 * Remove a model from favorites
 */
export const removeFavorite = mutation({
	args: {
		userId: v.id("users"),
		modelId: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("userModelFavorites")
			.withIndex("by_user_model", (q) =>
				q.eq("userId", args.userId).eq("modelId", args.modelId)
			)
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
			return { success: true, wasRemoved: true };
		}

		return { success: true, wasRemoved: false };
	},
});

/**
 * Toggle a model's favorite status
 */
export const toggleFavorite = mutation({
	args: {
		userId: v.id("users"),
		modelId: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("userModelFavorites")
			.withIndex("by_user_model", (q) =>
				q.eq("userId", args.userId).eq("modelId", args.modelId)
			)
			.unique();

		if (existing) {
			await ctx.db.delete(existing._id);
			return { isFavorite: false };
		} else {
			await ctx.db.insert("userModelFavorites", {
				userId: args.userId,
				modelId: args.modelId,
				addedAt: Date.now(),
			});
			return { isFavorite: true };
		}
	},
});
