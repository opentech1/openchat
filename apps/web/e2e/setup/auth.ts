import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Authentication helper functions for E2E tests
 */

export interface TestUser {
	email?: string;
	username?: string;
	githubToken?: string;
}

/**
 * Login helper - Handles GitHub OAuth authentication flow
 *
 * NOTE: This is a mock implementation. In a real scenario, you would:
 * 1. Use GitHub test credentials or OAuth mock server
 * 2. Store auth state in Playwright's storageState
 * 3. Reuse auth state across tests to speed up execution
 */
export async function login(page: Page, user?: TestUser): Promise<void> {
	// Navigate to sign-in page
	await page.goto("/auth/sign-in");

	// Wait for the page to load
	await expect(page.getByRole("heading", { name: /welcome to osschat/i })).toBeVisible();

	// For E2E testing, we need to either:
	// 1. Mock the GitHub OAuth flow
	// 2. Use a real test GitHub account
	// 3. Set up auth state directly via API/cookies

	// Mock implementation - click GitHub button
	// In production tests, this would complete the actual OAuth flow
	const githubButton = page.getByRole("button", { name: /continue with github/i });
	await expect(githubButton).toBeVisible();

	// TODO: Complete OAuth flow or set auth cookies directly
	// For now, we'll assume auth is handled via test environment variables
	// and the app redirects to /dashboard after successful auth

	// Example of setting auth state directly (if you have the session token):
	// await page.context().addCookies([{
	//   name: 'better_auth.session_token',
	//   value: 'your-test-session-token',
	//   domain: 'localhost',
	//   path: '/',
	// }]);

	// Click GitHub button (in test env, this should be mocked)
	await githubButton.click();

	// Wait for redirect to dashboard after successful login
	await page.waitForURL("/dashboard", { timeout: 10000 });

	// Verify we're logged in
	await expect(page).toHaveURL(/\/dashboard/);
}

/**
 * Logout helper - Signs out the current user
 */
export async function logout(page: Page): Promise<void> {
	// Navigate to settings or find logout button
	// This depends on your app's UI structure

	// Option 1: Clear cookies/localStorage
	await page.context().clearCookies();
	await page.evaluate(() => {
		localStorage.clear();
		sessionStorage.clear();
	});

	// Option 2: Click logout button in UI
	// await page.getByRole('button', { name: /sign out|logout/i }).click();

	// Verify logout
	await page.goto("/");

	// Should redirect to sign-in page when trying to access protected routes
	await page.goto("/dashboard");
	await page.waitForURL(/\/auth\/sign-in/, { timeout: 5000 });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
	const cookies = await page.context().cookies();
	return cookies.some(cookie =>
		cookie.name.includes("session") ||
		cookie.name.includes("auth")
	);
}

/**
 * Setup authenticated state for tests
 * This is useful for tests.beforeEach() to ensure user is logged in
 */
export async function setupAuth(page: Page): Promise<void> {
	const authenticated = await isAuthenticated(page);

	if (!authenticated) {
		await login(page);
	} else {
		// Just navigate to dashboard to verify auth still works
		await page.goto("/dashboard");

		// If redirected to login, auth expired - login again
		if (page.url().includes("/auth/sign-in")) {
			await login(page);
		}
	}
}

/**
 * Save authentication state to reuse across tests
 * Call this after successful login to save auth state
 */
export async function saveAuthState(page: Page, path: string): Promise<void> {
	await page.context().storageState({ path });
}

/**
 * Helper to create a new chat and navigate to it
 */
export async function createNewChat(page: Page): Promise<string> {
	// Navigate to dashboard first
	await page.goto("/dashboard");

	// Click new chat button (adjust selector based on your UI)
	const newChatButton = page.getByRole("link", { name: /new chat/i }).first();
	await newChatButton.click();

	// Wait for navigation to new chat page
	await page.waitForURL(/\/dashboard\/chat\/.+/, { timeout: 5000 });

	// Extract chat ID from URL
	const url = page.url();
	const match = url.match(/\/dashboard\/chat\/(.+)/);

	if (!match || !match[1]) {
		throw new Error("Failed to extract chat ID from URL");
	}

	return match[1];
}

/**
 * Helper to wait for chat to be ready
 */
export async function waitForChatReady(page: Page): Promise<void> {
	// Wait for composer to be visible
	await expect(page.getByPlaceholder(/type your message/i)).toBeVisible();

	// Wait for model selector to be visible
	await expect(page.getByRole("button", { name: /select.*model/i }).first()).toBeVisible();
}
