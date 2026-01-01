/**
 * Message and chat title encryption utilities
 * Encrypts message content and chat titles client-side before sending to server
 */

import { encryptData, decryptData, isEncrypted } from "./encryption";

/**
 * Encrypts a message content using user's ID as the encryption key
 */
export async function encryptMessage(
	content: string,
	userId: string
): Promise<string> {
	return encryptData(content, userId);
}

/**
 * Decrypts a message content using user's ID as the decryption key
 * Returns plaintext if content is not encrypted (backward compatibility)
 */
export async function decryptMessage(
	content: string,
	userId: string
): Promise<string> {
	return decryptData(content, userId);
}

/**
 * Encrypts a chat title using user's ID as the encryption key
 */
export async function encryptChatTitle(
	title: string,
	userId: string
): Promise<string> {
	return encryptData(title, userId);
}

/**
 * Decrypts a chat title using user's ID as the decryption key
 * Returns plaintext if title is not encrypted (backward compatibility)
 */
export async function decryptChatTitle(
	title: string,
	userId: string
): Promise<string> {
	return decryptData(title, userId);
}

/**
 * Checks if a message is encrypted
 */
export function isMessageEncrypted(content: string): boolean {
	return isEncrypted(content);
}

/**
 * Checks if a chat title is encrypted
 */
export function isChatTitleEncrypted(title: string): boolean {
	return isEncrypted(title);
}
