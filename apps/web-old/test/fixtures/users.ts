/**
 * Mock user fixtures for testing
 *
 * This module provides realistic mock user objects that match the Convex schema.
 * Use these fixtures in your tests to ensure consistent test data.
 *
 * @module fixtures/users
 */

import type { Id, Doc } from "@server/convex/_generated/dataModel";

/**
 * Base timestamp for all mock fixtures (2024-01-01)
 * All created/updated timestamps are based on this for consistency
 */
export const MOCK_BASE_TIMESTAMP = new Date("2024-01-01T00:00:00.000Z").getTime();

/**
 * Mock authenticated user (regular user with API key)
 * This represents a typical logged-in user with full access
 */
export const mockAuthenticatedUser: Doc<"users"> = {
  _id: "jd7abc123def456ghi789jkl" as Id<"users">,
  _creationTime: MOCK_BASE_TIMESTAMP,
  externalId: "auth0|user123456789",
  email: "alice@example.com",
  name: "Alice Johnson",
  avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice",
  encryptedOpenRouterKey: "enc_v1:mockencryptedkey123456789abcdef",
  fileUploadCount: 5,
  banned: false,
  createdAt: MOCK_BASE_TIMESTAMP,
  updatedAt: MOCK_BASE_TIMESTAMP,
};

/**
 * Mock guest user (no API key configured)
 * This represents a user who hasn't set up their OpenRouter API key yet
 */
export const mockGuestUser: Doc<"users"> = {
  _id: "jd7xyz987fed654cba321mlk" as Id<"users">,
  _creationTime: MOCK_BASE_TIMESTAMP + 1000,
  externalId: "auth0|guest987654321",
  email: "bob@example.com",
  name: "Bob Smith",
  avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob",
  // No encryptedOpenRouterKey - guest user
  fileUploadCount: 0,
  banned: false,
  createdAt: MOCK_BASE_TIMESTAMP + 1000,
  updatedAt: MOCK_BASE_TIMESTAMP + 1000,
};

/**
 * Mock admin user (privileged user)
 * This represents a user with administrative privileges
 */
export const mockAdminUser: Doc<"users"> = {
  _id: "jd7admin111222333444555" as Id<"users">,
  _creationTime: MOCK_BASE_TIMESTAMP - 86400000, // Created 1 day earlier
  externalId: "auth0|admin111222333",
  email: "admin@openchat.com",
  name: "Admin User",
  avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
  encryptedOpenRouterKey: "enc_v1:adminkey999888777666555444333",
  fileUploadCount: 150,
  banned: false,
  createdAt: MOCK_BASE_TIMESTAMP - 86400000,
  updatedAt: MOCK_BASE_TIMESTAMP,
};

/**
 * Mock banned user
 * This represents a user who has been banned from the platform
 */
export const mockBannedUser: Doc<"users"> = {
  _id: "jd7banned666777888999aaa" as Id<"users">,
  _creationTime: MOCK_BASE_TIMESTAMP + 2000,
  externalId: "auth0|banned666777888",
  email: "banned@example.com",
  name: "Banned User",
  avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=banned",
  encryptedOpenRouterKey: "enc_v1:bannedkey111222333444555",
  fileUploadCount: 2,
  banned: true,
  bannedAt: MOCK_BASE_TIMESTAMP + 3600000, // Banned 1 hour later
  banReason: "Terms of service violation",
  banExpiresAt: MOCK_BASE_TIMESTAMP + 86400000 * 30, // 30 day ban
  createdAt: MOCK_BASE_TIMESTAMP + 2000,
  updatedAt: MOCK_BASE_TIMESTAMP + 3600000,
};

/**
 * Mock new user (just created, minimal data)
 * This represents a user who just signed up
 */
export const mockNewUser: Doc<"users"> = {
  _id: "jd7newuser123abc456def78" as Id<"users">,
  _creationTime: MOCK_BASE_TIMESTAMP + 5000,
  externalId: "auth0|newuser123456",
  email: "newuser@example.com",
  name: "New User",
  // No avatar URL set yet
  // No API key configured yet
  fileUploadCount: 0,
  createdAt: MOCK_BASE_TIMESTAMP + 5000,
  updatedAt: MOCK_BASE_TIMESTAMP + 5000,
};

/**
 * Mock power user (heavy usage)
 * This represents a user with high activity and usage
 */
export const mockPowerUser: Doc<"users"> = {
  _id: "jd7power999888777666555" as Id<"users">,
  _creationTime: MOCK_BASE_TIMESTAMP - 86400000 * 90, // Created 90 days ago
  externalId: "auth0|power999888777",
  email: "poweruser@example.com",
  name: "Power User Pro",
  avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=power",
  encryptedOpenRouterKey: "enc_v1:powerkey777888999000111222",
  fileUploadCount: 450,
  banned: false,
  createdAt: MOCK_BASE_TIMESTAMP - 86400000 * 90,
  updatedAt: MOCK_BASE_TIMESTAMP,
};

/**
 * All mock users as an array for easy iteration in tests
 */
export const mockUsers = [
  mockAuthenticatedUser,
  mockGuestUser,
  mockAdminUser,
  mockBannedUser,
  mockNewUser,
  mockPowerUser,
];

/**
 * Helper to create a custom mock user with overrides
 *
 * @param overrides - Fields to override from the default authenticated user
 * @returns Custom mock user
 *
 * @example
 * ```typescript
 * const customUser = createMockUser({
 *   name: "Custom Name",
 *   email: "custom@example.com"
 * });
 * ```
 */
export function createMockUser(overrides: Partial<Doc<"users">> = {}): Doc<"users"> {
  const baseId = `jd7custom${Math.random().toString(36).substring(2, 15)}` as Id<"users">;
  const now = Date.now();

  return {
    _id: baseId,
    _creationTime: now,
    externalId: `auth0|custom${Math.random().toString(36).substring(2, 15)}`,
    email: `user${Math.random().toString(36).substring(2, 8)}@example.com`,
    name: "Test User",
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`,
    fileUploadCount: 0,
    banned: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Helper to get a user by email
 *
 * @param email - Email to search for
 * @returns Mock user or undefined
 *
 * @example
 * ```typescript
 * const user = getUserByEmail("alice@example.com");
 * ```
 */
export function getUserByEmail(email: string): Doc<"users"> | undefined {
  return mockUsers.find(user => user.email === email);
}

/**
 * Helper to get a user by external ID
 *
 * @param externalId - External ID to search for
 * @returns Mock user or undefined
 *
 * @example
 * ```typescript
 * const user = getUserByExternalId("auth0|user123456789");
 * ```
 */
export function getUserByExternalId(externalId: string): Doc<"users"> | undefined {
  return mockUsers.find(user => user.externalId === externalId);
}
