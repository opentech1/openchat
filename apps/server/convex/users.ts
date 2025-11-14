import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// User document validator with all fields including fileUploadCount
const userDoc = v.object({
	_id: v.id("users"),
	_creationTime: v.number(),
	externalId: v.string(),
	email: v.optional(v.string()),
	name: v.optional(v.string()),
	avatarUrl: v.optional(v.string()),
	encryptedOpenRouterKey: v.optional(v.string()),
	displayName: v.optional(v.string()),
	preferredTone: v.optional(v.string()),
	customInstructions: v.optional(v.string()),
	onboardingCompletedAt: v.optional(v.number()),
	fileUploadCount: v.optional(v.number()),
	createdAt: v.number(),
	updatedAt: v.number(),
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
		const existing = await ctx.db
			.query("users")
			.withIndex("by_external_id", (q) => q.eq("externalId", args.externalId))
			.unique();
		const now = Date.now();
		if (existing) {
			const needsUpdate =
				existing.email !== args.email ||
				existing.name !== args.name ||
				existing.avatarUrl !== args.avatarUrl;
			if (needsUpdate) {
				await ctx.db.patch(existing._id, {
					email: args.email ?? undefined,
					name: args.name ?? undefined,
					avatarUrl: args.avatarUrl ?? undefined,
					updatedAt: now,
				});
			}
			return { userId: existing._id };
		}
		const userId = await ctx.db.insert("users", {
			externalId: args.externalId,
			email: args.email ?? undefined,
			name: args.name ?? undefined,
			avatarUrl: args.avatarUrl ?? undefined,
			createdAt: now,
			updatedAt: now,
		});
		return { userId };
	},
});

export const getByExternalId = query({
	args: {
		externalId: v.string(),
	},
	returns: v.union(userDoc, v.null()),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("users")
			.withIndex("by_external_id", (q) => q.eq("externalId", args.externalId))
			.unique();
		return existing ?? null;
	},
});

export const getById = query({
	args: {
		userId: v.id("users"),
	},
	returns: v.union(userDoc, v.null()),
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId);
		return user ?? null;
	},
});

export const saveOpenRouterKey = mutation({
	args: {
		userId: v.id("users"),
		encryptedKey: v.string(),
	},
	returns: v.object({ success: v.boolean() }),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.userId, {
			encryptedOpenRouterKey: args.encryptedKey,
			updatedAt: Date.now(),
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
		await ctx.db.patch(args.userId, {
			encryptedOpenRouterKey: undefined,
			updatedAt: Date.now(),
		});
		return { success: true };
	},
});

export const completeOnboarding = mutation({
	args: {
		userId: v.id("users"),
		displayName: v.optional(v.string()),
		preferredTone: v.optional(v.string()),
		customInstructions: v.optional(v.string()),
	},
	returns: v.object({ success: v.boolean() }),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.userId, {
			displayName: args.displayName,
			preferredTone: args.preferredTone,
			customInstructions: args.customInstructions,
			onboardingCompletedAt: Date.now(),
			updatedAt: Date.now(),
		});
		return { success: true };
	},
});
