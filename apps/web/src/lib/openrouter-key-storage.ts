/**
 * Server-side encrypted OpenRouter API key storage.
 * Keys are encrypted client-side before being sent to the server.
 *
 * IMPORTANT: These are low-level functions. Use the useOpenRouterKey hook in React components instead.
 */

import { api } from "@server/convex/_generated/api";
import type { Id } from "@server/convex/_generated/dataModel";
import { encryptApiKey, decryptApiKey } from "./encryption";
import { logError } from "./logger";

type ConvexClient = {
	mutation: (api: any, args?: any) => Promise<any>;
	query: (api: any, args?: any) => Promise<any>;
};

/**
 * Saves an OpenRouter API key to the server (encrypted)
 */
export async function saveOpenRouterKey(
	apiKey: string,
	userId: Id<"users">,
	externalUserId: string,
	convexClient: ConvexClient
): Promise<void> {
	try {
		// Encrypt the API key client-side using user's external ID
		const encryptedKey = await encryptApiKey(apiKey, externalUserId);

		// Save to server
		await convexClient.mutation(api.users.saveOpenRouterKey, {
			userId,
			encryptedKey,
		});
	} catch (error) {
		logError("Failed to save OpenRouter key", error);
		throw new Error("Failed to save OpenRouter key");
	}
}

/**
 * Loads the OpenRouter API key from the server (decrypted)
 */
export async function loadOpenRouterKey(
	userId: Id<"users">,
	externalUserId: string,
	convexClient: ConvexClient
): Promise<string | null> {
	try {
		// Fetch encrypted key from server
		const encryptedKey = (await convexClient.query(api.users.getOpenRouterKey, {
			userId,
		})) as string | null;

		if (!encryptedKey) return null;

		// Decrypt client-side using user's external ID
		return await decryptApiKey(encryptedKey, externalUserId);
	} catch (error) {
		logError("Failed to load OpenRouter key", error);
		return null;
	}
}

/**
 * Removes the OpenRouter API key from the server
 */
export async function removeOpenRouterKey(
	userId: Id<"users">,
	convexClient: ConvexClient
): Promise<void> {
	try {
		await convexClient.mutation(api.users.removeOpenRouterKey, {
			userId,
		});
	} catch (error) {
		logError("Failed to remove OpenRouter key", error);
		throw new Error("Failed to remove OpenRouter key");
	}
}
