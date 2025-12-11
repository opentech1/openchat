/**
 * Profile Helper Functions
 *
 * Utility functions for working with the profiles table.
 * Part of the Auth/Profile Separation pattern (T3Chat pattern).
 *
 * The profiles table stores app-specific user data, keeping the users table
 * lean for authentication-only data.
 */

import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";

/**
 * Get a profile by user ID
 *
 * @param ctx - Query or mutation context
 * @param userId - The user ID to look up
 * @returns The profile document or null if not found
 */
export async function getProfileByUserId(
	ctx: QueryCtx,
	userId: Id<"users">
): Promise<Doc<"profiles"> | null> {
	return ctx.db
		.query("profiles")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.first();
}

/**
 * Get or create a profile for a user
 *
 * If a profile already exists, returns it. Otherwise, creates a new profile
 * by copying data from the user record (for backwards compatibility during migration).
 *
 * @param ctx - Mutation context (needs write access)
 * @param userId - The user ID to get or create profile for
 * @returns The profile document (existing or newly created)
 * @throws Error if the user does not exist
 */
export async function getOrCreateProfile(
	ctx: MutationCtx,
	userId: Id<"users">
): Promise<Doc<"profiles">> {
	// Check for existing profile
	const existing = await getProfileByUserId(ctx, userId);
	if (existing) return existing;

	// Get user data to populate profile
	const user = await ctx.db.get(userId);
	if (!user) {
		throw new Error(`User not found: ${userId}`);
	}

	// Create new profile with user data
	const now = Date.now();
	const profileId = await ctx.db.insert("profiles", {
		userId,
		name: user.name,
		avatarUrl: user.avatarUrl,
		encryptedOpenRouterKey: user.encryptedOpenRouterKey,
		fileUploadCount: user.fileUploadCount ?? 0,
		createdAt: now,
		updatedAt: now,
	});

	const profile = await ctx.db.get(profileId);
	if (!profile) {
		throw new Error(`Failed to create profile for user: ${userId}`);
	}

	return profile;
}

/**
 * Update profile fields
 *
 * @param ctx - Mutation context (needs write access)
 * @param userId - The user ID whose profile to update
 * @param updates - Partial object of fields to update
 * @throws Error if the profile does not exist
 */
export async function updateProfile(
	ctx: MutationCtx,
	userId: Id<"users">,
	updates: Partial<{
		name: string;
		avatarUrl: string;
		encryptedOpenRouterKey: string;
		fileUploadCount: number;
		preferences: {
			theme?: string;
		};
	}>
): Promise<void> {
	const profile = await getProfileByUserId(ctx, userId);
	if (!profile) {
		throw new Error(`Profile not found for user: ${userId}`);
	}

	await ctx.db.patch(profile._id, {
		...updates,
		updatedAt: Date.now(),
	});
}

/**
 * Increment the file upload count for a user's profile
 *
 * @param ctx - Mutation context (needs write access)
 * @param userId - The user ID whose profile to update
 * @param increment - Amount to increment by (default: 1)
 */
export async function incrementFileUploadCount(
	ctx: MutationCtx,
	userId: Id<"users">,
	increment: number = 1
): Promise<void> {
	const profile = await getProfileByUserId(ctx, userId);
	if (!profile) {
		throw new Error(`Profile not found for user: ${userId}`);
	}

	await ctx.db.patch(profile._id, {
		fileUploadCount: (profile.fileUploadCount ?? 0) + increment,
		updatedAt: Date.now(),
	});
}

/**
 * Get user with their profile data
 *
 * Convenience function to fetch both user and profile in one call.
 * During migration, falls back to user data if profile doesn't exist.
 *
 * @param ctx - Query context
 * @param userId - The user ID to look up
 * @returns Combined user and profile data
 */
export async function getUserWithProfile(
	ctx: QueryCtx,
	userId: Id<"users">
): Promise<{
	user: Doc<"users">;
	profile: Doc<"profiles"> | null;
	// Merged profile data (prefers profile over user for migration compatibility)
	name: string | undefined;
	avatarUrl: string | undefined;
	encryptedOpenRouterKey: string | undefined;
	fileUploadCount: number;
} | null> {
	const user = await ctx.db.get(userId);
	if (!user) return null;

	const profile = await getProfileByUserId(ctx, userId);

	return {
		user,
		profile,
		// During migration, prefer profile data but fall back to user data
		name: profile?.name ?? user.name,
		avatarUrl: profile?.avatarUrl ?? user.avatarUrl,
		encryptedOpenRouterKey:
			profile?.encryptedOpenRouterKey ?? user.encryptedOpenRouterKey,
		fileUploadCount: profile?.fileUploadCount ?? user.fileUploadCount ?? 0,
	};
}
