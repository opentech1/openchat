import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { incrementStat, STAT_KEYS } from "./lib/dbStats";
import { rateLimiter } from "./lib/rateLimiter";
import { throwRateLimitError } from "./lib/rateLimitUtils";
import { getProfileByUserId, getOrCreateProfile } from "./lib/profiles";
import { authComponent } from "./auth";

// User document validator with all fields including fileUploadCount
// Note: Kept for potential future use (e.g., admin queries that need raw user data)
const _userDoc = v.object({
	_id: v.id("users"),
	_creationTime: v.number(),
	externalId: v.string(),
	email: v.optional(v.string()),
	name: v.optional(v.string()),
	avatarUrl: v.optional(v.string()),
	encryptedOpenRouterKey: v.optional(v.string()),
	fileUploadCount: v.optional(v.number()),
	// Ban fields
	banned: v.optional(v.boolean()),
	bannedAt: v.optional(v.number()),
	banReason: v.optional(v.string()),
	banExpiresAt: v.optional(v.number()),
	createdAt: v.number(),
	updatedAt: v.number(),
});

// User with profile data (for backwards-compatible responses)
// Includes merged profile data that prefers profile over user during migration
const userWithProfileDoc = v.object({
	_id: v.id("users"),
	_creationTime: v.number(),
	externalId: v.string(),
	email: v.optional(v.string()),
	// Profile fields (merged from profile or user for migration compatibility)
	name: v.optional(v.string()),
	avatarUrl: v.optional(v.string()),
	encryptedOpenRouterKey: v.optional(v.string()),
	fileUploadCount: v.number(),
	// Ban fields
	banned: v.optional(v.boolean()),
	bannedAt: v.optional(v.number()),
	banReason: v.optional(v.string()),
	banExpiresAt: v.optional(v.number()),
	createdAt: v.number(),
	updatedAt: v.number(),
	// Flag to indicate if profile exists (useful for debugging migration)
	hasProfile: v.boolean(),
});

export const ensure = mutation({
	args: {
		externalId: v.string(),
		email: v.optional(v.string()),
		name: v.optional(v.string()),
		avatarUrl: v.optional(v.string()),
	},
	returns: v.object({ userId: v.id("users") }),
	handler: async (ctx, args) => {
		// Rate limit user authentication/creation per external ID
		// NOTE: Using externalId (from Better Auth) is safe because:
		// 1. Better Auth already handles brute-force protection at the auth layer
		// 2. Using a global key causes write conflicts under load (all users
		//    compete for the same rate limit row, causing OCC failures)
		// 3. The externalId is verified by Better Auth before reaching this function
		const { ok, retryAfter } = await rateLimiter.limit(ctx, "userEnsure", {
			key: args.externalId,
		});

		if (!ok) {
			throwRateLimitError("authentication attempts", retryAfter);
		}

		// First, check if user exists by externalId (Better Auth user ID)
		let existing = await ctx.db
			.query("users")
			.withIndex("by_external_id", (q) => q.eq("externalId", args.externalId))
			.unique();

		// MIGRATION: If not found by externalId but email exists, try to link by email
		// This handles users who previously logged in with WorkOS
		if (!existing && args.email) {
			const existingByEmail = await ctx.db
				.query("users")
				.withIndex("by_email", (q) => q.eq("email", args.email))
				.unique();

			if (existingByEmail) {
				// Update externalId to Better Auth user ID (migration from WorkOS)
				await ctx.db.patch(existingByEmail._id, {
					externalId: args.externalId,
					updatedAt: Date.now(),
				});
				existing = existingByEmail;
				console.log(`[Auth Migration] Linked user ${args.email} from WorkOS to Better Auth`);
			}
		}

		const now = Date.now();
		if (existing) {
			// Update user email (auth data stays in users table)
			const needsEmailUpdate = existing.email !== args.email;
			if (needsEmailUpdate) {
				await ctx.db.patch(existing._id, {
					email: args.email ?? undefined,
					updatedAt: now,
				});
			}

			// Ensure profile exists and update profile data (name, avatar)
			const profile = await getProfileByUserId(ctx, existing._id);
			if (profile) {
				// Update existing profile if name/avatar changed
				const needsProfileUpdate =
					profile.name !== args.name || profile.avatarUrl !== args.avatarUrl;
				if (needsProfileUpdate) {
					await ctx.db.patch(profile._id, {
						name: args.name ?? undefined,
						avatarUrl: args.avatarUrl ?? undefined,
						updatedAt: now,
					});
				}
			} else {
				// Create profile for existing user (migration path)
				await ctx.db.insert("profiles", {
					userId: existing._id,
					name: args.name ?? undefined,
					avatarUrl: args.avatarUrl ?? undefined,
					encryptedOpenRouterKey: existing.encryptedOpenRouterKey,
					fileUploadCount: existing.fileUploadCount ?? 0,
					createdAt: now,
					updatedAt: now,
				});
			}

			// Also update user table for backwards compatibility during migration
			const needsUserProfileUpdate =
				existing.name !== args.name || existing.avatarUrl !== args.avatarUrl;
			if (needsUserProfileUpdate) {
				await ctx.db.patch(existing._id, {
					name: args.name ?? undefined,
					avatarUrl: args.avatarUrl ?? undefined,
					updatedAt: now,
				});
			}

			return { userId: existing._id };
		}

		// Create new user
		const userId = await ctx.db.insert("users", {
			externalId: args.externalId,
			email: args.email ?? undefined,
			// Keep profile fields in users table for backwards compatibility
			name: args.name ?? undefined,
			avatarUrl: args.avatarUrl ?? undefined,
			createdAt: now,
			updatedAt: now,
		});

		// Create profile for new user
		await ctx.db.insert("profiles", {
			userId,
			name: args.name ?? undefined,
			avatarUrl: args.avatarUrl ?? undefined,
			fileUploadCount: 0,
			createdAt: now,
			updatedAt: now,
		});

		// PERFORMANCE OPTIMIZATION: Update stats counter when creating user
		await incrementStat(ctx, STAT_KEYS.USERS_TOTAL);

		return { userId };
	},
});

/**
 * Get the current authenticated user from Better Auth.
 * This is the primary way to get the current user in the app.
 */
export const getCurrentAuthUser = query({
	args: {},
	handler: async (ctx) => {
		return authComponent.getAuthUser(ctx);
	},
});

export const getByExternalId = query({
	args: {
		externalId: v.string(),
	},
	returns: v.union(userWithProfileDoc, v.null()),
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_external_id", (q) => q.eq("externalId", args.externalId))
			.unique();

		if (!user) return null;

		// Get profile data (may not exist during migration)
		const profile = await getProfileByUserId(ctx, user._id);

		// Return merged data with migration fallback
		return {
			_id: user._id,
			_creationTime: user._creationTime,
			externalId: user.externalId,
			email: user.email,
			// Profile fields: prefer profile data, fall back to user data for migration
			name: profile?.name ?? user.name,
			avatarUrl: profile?.avatarUrl ?? user.avatarUrl,
			encryptedOpenRouterKey:
				profile?.encryptedOpenRouterKey ?? user.encryptedOpenRouterKey,
			fileUploadCount: profile?.fileUploadCount ?? user.fileUploadCount ?? 0,
			// Ban fields (always from user)
			banned: user.banned,
			bannedAt: user.bannedAt,
			banReason: user.banReason,
			banExpiresAt: user.banExpiresAt,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			hasProfile: profile !== null,
		};
	},
});

export const getById = query({
	args: {
		userId: v.id("users"),
	},
	returns: v.union(userWithProfileDoc, v.null()),
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId);
		if (!user) return null;

		// Get profile data (may not exist during migration)
		const profile = await getProfileByUserId(ctx, user._id);

		// Return merged data with migration fallback
		return {
			_id: user._id,
			_creationTime: user._creationTime,
			externalId: user.externalId,
			email: user.email,
			// Profile fields: prefer profile data, fall back to user data for migration
			name: profile?.name ?? user.name,
			avatarUrl: profile?.avatarUrl ?? user.avatarUrl,
			encryptedOpenRouterKey:
				profile?.encryptedOpenRouterKey ?? user.encryptedOpenRouterKey,
			fileUploadCount: profile?.fileUploadCount ?? user.fileUploadCount ?? 0,
			// Ban fields (always from user)
			banned: user.banned,
			bannedAt: user.bannedAt,
			banReason: user.banReason,
			banExpiresAt: user.banExpiresAt,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			hasProfile: profile !== null,
		};
	},
});

export const saveOpenRouterKey = mutation({
	args: {
		userId: v.id("users"),
		encryptedKey: v.string(),
	},
	returns: v.object({ success: v.boolean() }),
	handler: async (ctx, args) => {
		// Rate limit API key saves
		const { ok, retryAfter } = await rateLimiter.limit(ctx, "userSaveApiKey", {
			key: args.userId,
		});

		if (!ok) {
			throwRateLimitError("API key updates", retryAfter);
		}

		const now = Date.now();

		// Update profile (primary location for API key)
		const profile = await getOrCreateProfile(ctx, args.userId);
		await ctx.db.patch(profile._id, {
			encryptedOpenRouterKey: args.encryptedKey,
			updatedAt: now,
		});

		// Also update user table for backwards compatibility during migration
		await ctx.db.patch(args.userId, {
			encryptedOpenRouterKey: args.encryptedKey,
			updatedAt: now,
		});

		return { success: true };
	},
});

export const getOpenRouterKey = query({
	args: {
		userId: v.id("users"),
	},
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, args) => {
		// Try profile first (primary location)
		const profile = await getProfileByUserId(ctx, args.userId);
		if (profile?.encryptedOpenRouterKey) {
			return profile.encryptedOpenRouterKey;
		}

		// Fall back to user table during migration
		const user = await ctx.db.get(args.userId);
		return user?.encryptedOpenRouterKey ?? null;
	},
});

export const removeOpenRouterKey = mutation({
	args: {
		userId: v.id("users"),
	},
	returns: v.object({ success: v.boolean() }),
	handler: async (ctx, args) => {
		// Rate limit API key removals
		const { ok, retryAfter } = await rateLimiter.limit(ctx, "userRemoveApiKey", {
			key: args.userId,
		});

		if (!ok) {
			throwRateLimitError("API key removals", retryAfter);
		}

		const now = Date.now();

		// Remove from profile (primary location)
		const profile = await getProfileByUserId(ctx, args.userId);
		if (profile) {
			await ctx.db.patch(profile._id, {
				encryptedOpenRouterKey: undefined,
				updatedAt: now,
			});
		}

		// Also remove from user table for backwards compatibility during migration
		await ctx.db.patch(args.userId, {
			encryptedOpenRouterKey: undefined,
			updatedAt: now,
		});

		return { success: true };
	},
});

export const getFavoriteModels = query({
	args: {
		userId: v.id("users"),
	},
	returns: v.union(v.array(v.string()), v.null()),
	handler: async (ctx, args) => {
		const profile = await getProfileByUserId(ctx, args.userId);
		// Return null if favorites have never been set (allows frontend to apply defaults)
		// Return [] if user explicitly cleared all favorites
		if (!profile) return null;
		return profile.favoriteModels ?? null;
	},
});

export const toggleFavoriteModel = mutation({
	args: {
		userId: v.id("users"),
		modelId: v.string(),
	},
	returns: v.object({ isFavorite: v.boolean(), favorites: v.array(v.string()) }),
	handler: async (ctx, args) => {
		const profile = await getOrCreateProfile(ctx, args.userId);
		const currentFavorites = profile.favoriteModels ?? [];
		const isFavorite = currentFavorites.includes(args.modelId);
		
		const newFavorites = isFavorite
			? currentFavorites.filter((id) => id !== args.modelId)
			: [...currentFavorites, args.modelId];

		await ctx.db.patch(profile._id, {
			favoriteModels: newFavorites,
			updatedAt: Date.now(),
		});

		return { isFavorite: !isFavorite, favorites: newFavorites };
	},
});

export const setFavoriteModels = mutation({
	args: {
		userId: v.id("users"),
		modelIds: v.array(v.string()),
	},
	returns: v.object({ success: v.boolean() }),
	handler: async (ctx, args) => {
		const profile = await getOrCreateProfile(ctx, args.userId);
		
		await ctx.db.patch(profile._id, {
			favoriteModels: args.modelIds,
			updatedAt: Date.now(),
		});

		return { success: true };
	},
});
