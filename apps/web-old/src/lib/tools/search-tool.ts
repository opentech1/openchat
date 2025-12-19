/**
 * Valyu Search Tool for AI SDK
 *
 * Provides web search capabilities using the Valyu API.
 * Integrates with Convex for search usage limit tracking.
 */

import { tool } from "ai";
import { z } from "zod";
import { Valyu } from "valyu-js";
import type { Id } from "@server/convex/_generated/dataModel";

/**
 * Extract domain from URL for deduplication
 */
function extractDomain(url: string): string {
	try {
		return new URL(url).hostname.replace("www.", "");
	} catch {
		return url;
	}
}

/**
 * Deduplicate search results by domain and URL to prevent spam
 */
function deduplicateResults<T extends { url: string }>(results: T[]): T[] {
	const seenDomains = new Set<string>();
	const seenUrls = new Set<string>();
	return results.filter((item) => {
		const domain = extractDomain(item.url);
		if (!seenUrls.has(item.url) && !seenDomains.has(domain)) {
			seenUrls.add(item.url);
			seenDomains.add(domain);
			return true;
		}
		return false;
	});
}

/**
 * Clean title by removing noise patterns
 */
function cleanTitle(title: string): string {
	return title
		.replace(/\s*[\[\(].*?[\]\)]\s*/g, "") // Remove [brackets] and (parens)
		.replace(/\s*\|.*$/g, "") // Remove | site name
		.replace(/\s*-\s*[^-]*$/g, "") // Remove - site name
		.trim();
}

export type SearchResult = {
	title: string;
	url: string;
	content: string;
	description?: string;
};

export type SearchToolResult = {
	results: SearchResult[];
	message?: string;
	limitReached?: boolean;
	remaining?: number;
};

export type SearchUsageChecker = (userId: Id<"users">) => Promise<{
	allowed: boolean;
	remaining: number;
	newCount?: number;
}>;

/**
 * Create a search tool with Valyu API integration
 *
 * @param apiKey - Valyu API key
 * @param options.checkAndIncrementUsage - Function to check and increment search usage (returns allowed/remaining)
 * @param options.userId - User ID for tracking search usage
 */
export function createSearchTool(
	apiKey: string,
	options?: {
		checkAndIncrementUsage?: SearchUsageChecker;
		userId?: Id<"users">;
	}
) {
	const valyu = new Valyu(apiKey);

	return tool({
		description:
			"Search the web for up-to-date information, news, documentation, or any online content. Use this when the user asks about current events, recent information, or when you need to verify facts.",
		inputSchema: z.object({
			query: z.string().describe("The search query to find relevant information"),
		}),
		execute: async ({ query }): Promise<SearchToolResult> => {
			// Check and increment search usage if tracking is enabled
			if (options?.checkAndIncrementUsage && options?.userId) {
				try {
					const usageResult = await options.checkAndIncrementUsage(options.userId);

					if (!usageResult.allowed) {
						return {
							results: [],
							message: "Daily search limit reached. Please try again tomorrow.",
							limitReached: true,
							remaining: 0,
						};
					}

					// Perform the search using Valyu's search method (v2 API)
					const response = await valyu.search(query, {
						searchType: "all",
						maxNumResults: 5,
						relevanceThreshold: 0.60,
					});

					if (!response.success) {
						console.error("[search-tool] Valyu API error:", response.error);
						return {
							results: [],
							message: response.error || "Search failed.",
							remaining: usageResult.remaining - 1,
						};
					}

					if (!response.results?.length) {
						return {
							results: [],
							message: "No results found for the query.",
							remaining: usageResult.remaining - 1,
						};
					}

					return {
						results: deduplicateResults(
							response.results.map((r) => ({
								title: cleanTitle(r.title),
								url: r.url,
								content: typeof r.content === "string" ? r.content : JSON.stringify(r.content),
								description: r.description,
							}))
						),
						remaining: usageResult.remaining - 1,
					};
				} catch (error) {
					// If usage check fails, log error and return gracefully
					console.error("[search-tool] Usage check or search failed:", error);
					return {
						results: [],
						message: error instanceof Error ? error.message : "Search failed",
					};
				}
			}

			// Perform search without usage tracking
			try {
				const response = await valyu.search(query, {
					searchType: "all",
					maxNumResults: 5,
					relevanceThreshold: 0.60,
				});

				if (!response.success) {
					console.error("[search-tool] Valyu API error:", response.error);
					return {
						results: [],
						message: response.error || "Search failed.",
					};
				}

				if (!response.results?.length) {
					return {
						results: [],
						message: "No results found for the query.",
					};
				}

				return {
					results: deduplicateResults(
						response.results.map((r) => ({
							title: cleanTitle(r.title),
							url: r.url,
							content: typeof r.content === "string" ? r.content : JSON.stringify(r.content),
							description: r.description,
						}))
					),
				};
			} catch (error) {
				console.error("[search-tool] Search failed:", error);
				return {
					results: [],
					message: error instanceof Error ? error.message : "Search failed",
				};
			}
		},
	});
}
