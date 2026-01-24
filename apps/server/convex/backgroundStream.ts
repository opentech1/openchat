import { v } from "convex/values";
import { mutation, query, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const DAILY_AI_LIMIT_CENTS = 10;
const FALLBACK_INPUT_COST_PER_MILLION = 1;
const FALLBACK_OUTPUT_COST_PER_MILLION = 4;

type UsagePayload = {
	promptTokens?: number;
	completionTokens?: number;
	totalTokens?: number;
	totalCostUsd?: number;
};

function getCurrentDateKey(): string {
	return new Date().toISOString().split("T")[0];
}

function normalizeUsagePayload(usage: Record<string, unknown>): UsagePayload {
	const promptTokens =
		typeof usage.prompt_tokens === "number"
			? usage.prompt_tokens
			: typeof usage.promptTokens === "number"
				? usage.promptTokens
				: undefined;
	const completionTokens =
		typeof usage.completion_tokens === "number"
			? usage.completion_tokens
			: typeof usage.completionTokens === "number"
				? usage.completionTokens
				: undefined;
	const totalTokens =
		typeof usage.total_tokens === "number"
			? usage.total_tokens
			: typeof usage.totalTokens === "number"
				? usage.totalTokens
				: undefined;
	const totalCostUsd =
		typeof usage.total_cost === "number"
			? usage.total_cost
			: typeof usage.totalCost === "number"
				? usage.totalCost
				: typeof usage.cost === "number"
					? usage.cost
					: undefined;

	return { promptTokens, completionTokens, totalTokens, totalCostUsd };
}

function estimateTokensFromText(text: string): number {
	if (!text) return 0;
	// More accurate estimation: 1 token ≈ 0.75 words for English
	// For mixed/non-English content, this is still rough but better than char/4
	const wordCount = text.split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.ceil(wordCount * 1.33));
}

function estimatePromptTokens(messages: Array<{ role: string; content: string }>): number {
	const combined = messages.map((m) => m.content).join(" ");
	return estimateTokensFromText(combined);
}

function roundCents(cents: number): number {
	if (!Number.isFinite(cents)) return 0;
	return Math.max(0, Math.round(cents * 10000) / 10000);
}

function calculateUsageCents(
	usage: UsagePayload | null,
	messages: Array<{ role: string; content: string }>,
	outputText: string,
): number | null {
	if (usage?.totalCostUsd !== undefined) {
		return roundCents(usage.totalCostUsd * 100);
	}

	const promptTokens = usage?.promptTokens ?? estimatePromptTokens(messages);
	const completionTokens = usage?.completionTokens ?? estimateTokensFromText(outputText);

	if (promptTokens <= 0 && completionTokens <= 0) {
		return null;
	}

	const totalUsd =
		(promptTokens / 1_000_000) * FALLBACK_INPUT_COST_PER_MILLION +
		(completionTokens / 1_000_000) * FALLBACK_OUTPUT_COST_PER_MILLION;

	return roundCents(totalUsd * 100);
}

export const startStream = mutation({
	args: {
		chatId: v.id("chats"),
		userId: v.id("users"),
		messageId: v.string(),
		model: v.string(),
		provider: v.string(),
		apiKey: v.optional(v.string()),
		messages: v.array(v.object({
			role: v.string(),
			content: v.string(),
		})),
		options: v.optional(v.object({
			reasoningEffort: v.optional(v.string()),
			enableWebSearch: v.optional(v.boolean()),
			maxSteps: v.optional(v.number()),
		})),
	},
	returns: v.id("streamJobs"),
	handler: async (ctx, args) => {
		const chat = await ctx.db.get(args.chatId);
		if (!chat || chat.userId !== args.userId) {
			throw new Error("Chat not found or unauthorized");
		}

		if (args.provider === "osschat") {
			const user = await ctx.db.get(args.userId);
			if (!user) {
				throw new Error("User not found");
			}

			const currentDate = getCurrentDateKey();
			const usedCents =
				user.aiUsageDate === currentDate ? (user.aiUsageCents ?? 0) : 0;
			if (usedCents >= DAILY_AI_LIMIT_CENTS) {
				throw new Error("Daily usage limit reached. Connect your OpenRouter account to continue.");
			}
		}

		const existingActiveStream = await ctx.db
			.query("streamJobs")
			.withIndex("by_chat", (q) => 
				q.eq("chatId", args.chatId).eq("status", "running")
			)
			.first();
		
		if (existingActiveStream) {
			throw new Error("Stream already in progress for this chat");
		}

		const jobId = await ctx.db.insert("streamJobs", {
			chatId: args.chatId,
			userId: args.userId,
			messageId: args.messageId,
			status: "pending",
			model: args.model,
			provider: args.provider,
			messages: args.messages,
			options: args.options,
			content: "",
			createdAt: Date.now(),
		});

		await ctx.db.patch(args.chatId, {
			activeStreamId: `job-${jobId}`,
			status: "streaming",
			updatedAt: Date.now(),
		});

		await ctx.scheduler.runAfter(0, internal.backgroundStream.executeStream, {
			jobId,
			apiKey: args.apiKey,
		});

		return jobId;
	},
});

export const getStreamJob = query({
	args: {
		jobId: v.id("streamJobs"),
		userId: v.id("users"),
	},
	returns: v.union(
		v.object({
			_id: v.id("streamJobs"),
			status: v.string(),
			content: v.string(),
			reasoning: v.optional(v.string()),
			error: v.optional(v.string()),
			messageId: v.string(),
		}),
		v.null()
	),
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (!job || job.userId !== args.userId) return null;
		
		return {
			_id: job._id,
			status: job.status,
			content: job.content,
			reasoning: job.reasoning,
			error: job.error,
			messageId: job.messageId,
		};
	},
});

export const getActiveStreamJob = query({
	args: {
		chatId: v.id("chats"),
		userId: v.id("users"),
	},
	returns: v.union(
		v.object({
			_id: v.id("streamJobs"),
			status: v.string(),
			content: v.string(),
			reasoning: v.optional(v.string()),
			error: v.optional(v.string()),
			messageId: v.string(),
		}),
		v.null()
	),
	handler: async (ctx, args) => {
		const jobs = await ctx.db
			.query("streamJobs")
			.withIndex("by_chat", (q) => 
				q.eq("chatId", args.chatId).eq("status", "running")
			)
			.first();
		
		if (!jobs || jobs.userId !== args.userId) {
			const pending = await ctx.db
				.query("streamJobs")
				.withIndex("by_chat", (q) => 
					q.eq("chatId", args.chatId).eq("status", "pending")
				)
				.first();
			
			if (!pending || pending.userId !== args.userId) return null;
			
			return {
				_id: pending._id,
				status: pending.status,
				content: pending.content,
				reasoning: pending.reasoning,
				error: pending.error,
				messageId: pending.messageId,
			};
		}
		
		return {
			_id: jobs._id,
			status: jobs.status,
			content: jobs.content,
			reasoning: jobs.reasoning,
			error: jobs.error,
			messageId: jobs.messageId,
		};
	},
});

export const updateStreamContent = internalMutation({
	args: {
		jobId: v.id("streamJobs"),
		content: v.string(),
		reasoning: v.optional(v.string()),
		status: v.optional(v.union(
			v.literal("pending"),
			v.literal("running"),
			v.literal("completed"),
			v.literal("error")
		)),
		error: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (!job) return;

		const updates: Record<string, unknown> = {
			content: args.content,
		};

		if (args.reasoning !== undefined) {
			updates.reasoning = args.reasoning;
		}
		if (args.status !== undefined) {
			updates.status = args.status;
			if (args.status === "running" && !job.startedAt) {
				updates.startedAt = Date.now();
			}
			if (args.status === "completed" || args.status === "error") {
				updates.completedAt = Date.now();
			}
		}
		if (args.error !== undefined) {
			updates.error = args.error;
		}

		await ctx.db.patch(args.jobId, updates);
	},
});

export const completeStream = internalMutation({
	args: {
		jobId: v.id("streamJobs"),
		content: v.string(),
		reasoning: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (!job) return;

		await ctx.db.patch(args.jobId, {
			status: "completed",
			content: args.content,
			reasoning: args.reasoning,
			completedAt: Date.now(),
		});

		await ctx.db.patch(job.chatId, {
			activeStreamId: undefined,
			status: "idle",
			updatedAt: Date.now(),
		});

		const existingMessage = await ctx.db
			.query("messages")
			.withIndex("by_client_id", (q) => 
				q.eq("chatId", job.chatId).eq("clientMessageId", job.messageId)
			)
			.first();

		if (!existingMessage) {
			await ctx.db.insert("messages", {
				chatId: job.chatId,
				clientMessageId: job.messageId,
				role: "assistant",
				content: args.content,
				reasoning: args.reasoning,
				createdAt: Date.now(),
			});
		} else {
			await ctx.db.patch(existingMessage._id, {
				content: args.content,
				reasoning: args.reasoning,
			});
		}
	},
});

export const failStream = internalMutation({
	args: {
		jobId: v.id("streamJobs"),
		error: v.string(),
		partialContent: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (!job) return;

		await ctx.db.patch(args.jobId, {
			status: "error",
			error: args.error,
			content: args.partialContent || job.content,
			completedAt: Date.now(),
		});

		await ctx.db.patch(job.chatId, {
			activeStreamId: undefined,
			status: "idle",
			updatedAt: Date.now(),
		});
	},
});

export const executeStream = internalAction({
	args: {
		jobId: v.id("streamJobs"),
		apiKey: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const job = await ctx.runQuery(internal.backgroundStream.getJobInternal, { 
			jobId: args.jobId 
		});
		
		if (!job) {
			console.error("[BackgroundStream] Job not found:", args.jobId);
			return;
		}

		await ctx.runMutation(internal.backgroundStream.updateStreamContent, {
			jobId: args.jobId,
			content: "",
			status: "running",
		});

		const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
		const apiKey = job.provider === "osschat" ? OPENROUTER_API_KEY : args.apiKey;

		if (!apiKey) {
			await ctx.runMutation(internal.backgroundStream.failStream, {
				jobId: args.jobId,
				error: "No API key available",
			});
			return;
		}

		try {
			const timeoutMs = 5 * 60 * 1000; // 5 minutes
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

			const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${apiKey}`,
					"HTTP-Referer": process.env.CONVEX_SITE_URL || "https://osschat.io",
					"X-Title": "OSSChat",
				},
				body: JSON.stringify({
					model: job.model,
					messages: job.messages.map((m: { role: string; content: string }) => ({
						role: m.role,
						content: m.content,
					})),
					stream: true,
				}),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorText = await response.text();
				await ctx.runMutation(internal.backgroundStream.failStream, {
					jobId: args.jobId,
					error: `OpenRouter API error: ${response.status} - ${errorText}`,
				});
				return;
			}

			const reader = response.body?.getReader();
			if (!reader) {
				await ctx.runMutation(internal.backgroundStream.failStream, {
					jobId: args.jobId,
					error: "No response body",
				});
				return;
			}

			const decoder = new TextDecoder();
			let fullContent = "";
			let fullReasoning = "";
			let buffer = "";
			let updateCounter = 0;
			const UPDATE_INTERVAL = 5;
			let usageSummary: UsagePayload | null = null;

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (!line.startsWith("data: ")) continue;
					const data = line.slice(6).trim();
					if (data === "[DONE]") continue;

					try {
						const parsed = JSON.parse(data);
						const delta = parsed.choices?.[0]?.delta;
						if (parsed.usage && typeof parsed.usage === "object") {
							usageSummary = normalizeUsagePayload(parsed.usage as Record<string, unknown>);
						}
						
						if (delta?.content) {
							fullContent += delta.content;
							updateCounter++;
						}
						if (delta?.reasoning) {
							fullReasoning += delta.reasoning;
							updateCounter++;
						}

						if (updateCounter >= UPDATE_INTERVAL) {
							await ctx.runMutation(internal.backgroundStream.updateStreamContent, {
								jobId: args.jobId,
								content: fullContent,
								reasoning: fullReasoning || undefined,
							});
							updateCounter = 0;
						}
					} catch (parseError) {
						console.error("[BackgroundStream] Failed to parse SSE chunk:", data);
					}
				}
			}

			await ctx.runMutation(internal.backgroundStream.completeStream, {
				jobId: args.jobId,
				content: fullContent,
				reasoning: fullReasoning || undefined,
			});

			if (job.provider === "osschat") {
				const usageCents = calculateUsageCents(
					usageSummary,
					job.messages,
					fullContent,
				);
				if (usageCents && usageCents > 0) {
					await ctx.runMutation(internal.users.incrementAiUsage, {
						userId: job.userId,
						usageCents,
					});
				}
			}

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			await ctx.runMutation(internal.backgroundStream.failStream, {
				jobId: args.jobId,
				error: errorMessage,
			});
		}
	},
});

export const getJobInternal = internalQuery({
	args: {
		jobId: v.id("streamJobs"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.jobId);
	},
});

export const cleanupStaleJobs = mutation({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const staleJobs = await ctx.db
			.query("streamJobs")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.filter((q) => 
				q.or(
					q.eq(q.field("status"), "running"),
					q.eq(q.field("status"), "pending")
				)
			)
			.collect();

		const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
		let cleaned = 0;

		for (const job of staleJobs) {
			if (job.createdAt < fiveMinutesAgo) {
				await ctx.db.patch(job._id, {
					status: "error",
					error: "Cleaned up stale job",
					completedAt: Date.now(),
				});
				cleaned++;
			}
		}

		return { cleaned, total: staleJobs.length };
	},
});
