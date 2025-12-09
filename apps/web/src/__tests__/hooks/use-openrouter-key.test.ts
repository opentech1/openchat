/**
 * Comprehensive Unit Tests for useOpenRouterKey Hook
 *
 * Tests the React hook for managing OpenRouter API keys with
 * encrypted storage, cross-device sync, and session management.
 *
 * Coverage:
 * - Key loading and decryption
 * - Key saving and encryption
 * - Key deletion
 * - Error handling
 * - State management
 * - Event synchronization
 * - Authentication states
 * - Convex client readiness
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useOpenRouterKey } from "@/hooks/use-openrouter-key";
import * as authClient from "@/lib/auth-client";
import * as convexUserContext from "@/contexts/convex-user-context";
import * as keyStorage from "@/lib/openrouter-key-storage";
import * as logger from "@/lib/logger";

// Mock dependencies
vi.mock("convex/react", () => ({
  useConvex: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/contexts/convex-user-context", () => ({
  useConvexUser: vi.fn(),
}));

vi.mock("@/lib/openrouter-key-storage", () => ({
  loadOpenRouterKey: vi.fn(),
  saveOpenRouterKey: vi.fn(),
  removeOpenRouterKey: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

// Import mocked convex hook
import { useConvex } from "convex/react";

const mockUseConvex = useConvex as ReturnType<typeof vi.fn>;
const mockUseSession = (authClient as unknown as { useSession: ReturnType<typeof vi.fn> }).useSession;
const mockUseConvexUser = convexUserContext.useConvexUser as ReturnType<
  typeof vi.fn
>;
const mockLoadKey = keyStorage.loadOpenRouterKey as ReturnType<typeof vi.fn>;
const mockSaveKey = keyStorage.saveOpenRouterKey as ReturnType<typeof vi.fn>;
const mockRemoveKey = keyStorage.removeOpenRouterKey as ReturnType<
  typeof vi.fn
>;
const mockLogError = logger.logError as ReturnType<typeof vi.fn>;

describe("useOpenRouterKey Hook", () => {
  // Mock Convex client
  const mockConvex = {
    mutation: vi.fn(),
    query: vi.fn(),
  };

  // Mock user data
  const mockUser = {
    id: "user_123",
    email: "test@example.com",
  };

  const mockConvexUser = {
    _id: "convex_user_123" as any,
    externalId: "user_123",
  };

  // Reset all mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseConvex.mockReturnValue(mockConvex);
    mockUseSession.mockReturnValue({ data: { user: mockUser } });
    mockUseConvexUser.mockReturnValue({ convexUser: mockConvexUser });
    mockLoadKey.mockResolvedValue(null);
    mockSaveKey.mockResolvedValue(undefined);
    mockRemoveKey.mockResolvedValue(undefined);
  });

  // Clean up event listeners after each test
  afterEach(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener(
        "openrouter-key-changed",
        () => {},
        true
      );
    }
  });

  describe("Initial State", () => {
    test("should initialize with loading state", () => {
      const { result } = renderHook(() => useOpenRouterKey());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.apiKey).toBe(null);
      expect(result.current.error).toBe(null);
      expect(result.current.hasKey).toBe(false);
    });

    test("should provide saveKey function", () => {
      const { result } = renderHook(() => useOpenRouterKey());

      expect(typeof result.current.saveKey).toBe("function");
    });

    test("should provide removeKey function", () => {
      const { result } = renderHook(() => useOpenRouterKey());

      expect(typeof result.current.removeKey).toBe("function");
    });
  });

  describe("Load Key on Mount", () => {
    test("should load key successfully when authenticated", async () => {
      const testKey = "sk-test-key-123";
      mockLoadKey.mockResolvedValue(testKey);

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.apiKey).toBe(testKey);
      expect(result.current.hasKey).toBe(true);
      expect(result.current.error).toBe(null);
      expect(mockLoadKey).toHaveBeenCalledWith(
        mockConvexUser._id,
        mockUser.id,
        mockConvex
      );
    });

    test("should handle missing key gracefully", async () => {
      mockLoadKey.mockResolvedValue(null);

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.apiKey).toBe(null);
      expect(result.current.hasKey).toBe(false);
      expect(result.current.error).toBe(null);
    });

    test("should handle load error", async () => {
      const testError = new Error("Failed to decrypt key");
      mockLoadKey.mockRejectedValue(testError);

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.apiKey).toBe(null);
      expect(result.current.error).toBeTruthy();
      expect(mockLogError).toHaveBeenCalledWith(
        "Failed to load OpenRouter key",
        testError
      );
    });

    test("should convert non-Error exceptions to Error objects", async () => {
      mockLoadKey.mockRejectedValue("String error");

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("String error");
    });

    test("should not load key when user is not authenticated", async () => {
      mockUseSession.mockReturnValue({ data: null });

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockLoadKey).not.toHaveBeenCalled();
      expect(result.current.apiKey).toBe(null);
    });

    test("should not load key when convexUser is missing", async () => {
      mockUseConvexUser.mockReturnValue({ convexUser: null });

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockLoadKey).not.toHaveBeenCalled();
      expect(result.current.apiKey).toBe(null);
    });

    test("should not load key when Convex client is not ready", async () => {
      mockUseConvex.mockReturnValue(null);

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockLoadKey).not.toHaveBeenCalled();
    });
  });

  describe("Save Key", () => {
    test("should save key successfully", async () => {
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newKey = "sk-new-test-key";
      await result.current.saveKey(newKey);

      expect(mockSaveKey).toHaveBeenCalledWith(
        newKey,
        mockConvexUser._id,
        mockUser.id,
        mockConvex
      );
      expect(result.current.apiKey).toBe(newKey);
      expect(result.current.hasKey).toBe(true);
      expect(result.current.error).toBe(null);
    });

    test("should update existing key", async () => {
      mockLoadKey.mockResolvedValue("sk-old-key");
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.apiKey).toBe("sk-old-key");
      });

      const newKey = "sk-updated-key";
      await result.current.saveKey(newKey);

      expect(result.current.apiKey).toBe(newKey);
    });

    test("should throw error when Convex client is not ready", async () => {
      mockUseConvex.mockReturnValue(null);
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.saveKey("sk-test")).rejects.toThrow(
        "Convex client not ready"
      );
    });

    test("should throw error when user is not authenticated", async () => {
      mockUseSession.mockReturnValue({ data: null });
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.saveKey("sk-test")).rejects.toThrow(
        "User not authenticated"
      );
    });

    test("should throw error when convexUser is missing", async () => {
      mockUseConvexUser.mockReturnValue({ convexUser: null });
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.saveKey("sk-test")).rejects.toThrow(
        "User not authenticated"
      );
    });

    test("should handle save error and log it", async () => {
      const testError = new Error("Encryption failed");
      mockSaveKey.mockRejectedValue(testError);

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.saveKey("sk-test")).rejects.toThrow(
        testError
      );

      expect(mockLogError).toHaveBeenCalledWith(
        "Failed to save OpenRouter key",
        testError
      );
      expect(result.current.error).toBeTruthy();
    });

    test("should convert non-Error save exceptions", async () => {
      mockSaveKey.mockRejectedValue("String error");

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.saveKey("sk-test")).rejects.toThrow();
      expect(result.current.error).toBeInstanceOf(Error);
    });

    test("should dispatch key change event after save", async () => {
      const eventListener = vi.fn();
      window.addEventListener("openrouter-key-changed", eventListener);

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.saveKey("sk-test");

      expect(eventListener).toHaveBeenCalled();

      window.removeEventListener("openrouter-key-changed", eventListener);
    });
  });

  describe("Remove Key", () => {
    test("should remove key successfully", async () => {
      mockLoadKey.mockResolvedValue("sk-existing-key");
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.apiKey).toBe("sk-existing-key");
      });

      await result.current.removeKey();

      expect(mockRemoveKey).toHaveBeenCalledWith(
        mockConvexUser._id,
        mockConvex
      );
      expect(result.current.apiKey).toBe(null);
      expect(result.current.hasKey).toBe(false);
      expect(result.current.error).toBe(null);
    });

    test("should remove key even when no key exists", async () => {
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.removeKey();

      expect(mockRemoveKey).toHaveBeenCalled();
      expect(result.current.apiKey).toBe(null);
    });

    test("should throw error when Convex client is not ready", async () => {
      mockUseConvex.mockReturnValue(null);
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.removeKey()).rejects.toThrow(
        "Convex client not ready"
      );
    });

    test("should throw error when convexUser is missing", async () => {
      mockUseConvexUser.mockReturnValue({ convexUser: null });
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.removeKey()).rejects.toThrow(
        "User not authenticated"
      );
    });

    test("should handle remove error and log it", async () => {
      const testError = new Error("Delete failed");
      mockRemoveKey.mockRejectedValue(testError);

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.removeKey()).rejects.toThrow(testError);

      expect(mockLogError).toHaveBeenCalledWith(
        "Failed to remove OpenRouter key",
        testError
      );
      expect(result.current.error).toBeTruthy();
    });

    test("should convert non-Error remove exceptions", async () => {
      mockRemoveKey.mockRejectedValue("Database error");

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(result.current.removeKey()).rejects.toThrow();
      expect(result.current.error).toBeInstanceOf(Error);
    });

    test("should dispatch key change event after remove", async () => {
      const eventListener = vi.fn();
      window.addEventListener("openrouter-key-changed", eventListener);

      mockLoadKey.mockResolvedValue("sk-key-to-remove");
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.apiKey).toBe("sk-key-to-remove");
      });

      await result.current.removeKey();

      expect(eventListener).toHaveBeenCalled();

      window.removeEventListener("openrouter-key-changed", eventListener);
    });
  });

  describe("Event Synchronization", () => {
    test("should reload key when change event is dispatched", async () => {
      const firstKey = "sk-first-key";
      const secondKey = "sk-second-key";
      mockLoadKey.mockResolvedValueOnce(firstKey);

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.apiKey).toBe(firstKey);
      });

      // Simulate key change in another tab/component
      mockLoadKey.mockResolvedValueOnce(secondKey);
      window.dispatchEvent(new Event("openrouter-key-changed"));

      await waitFor(() => {
        expect(result.current.apiKey).toBe(secondKey);
      });

      expect(mockLoadKey).toHaveBeenCalledTimes(2);
    });

    test("should not reload after unmount", async () => {
      mockLoadKey.mockResolvedValue("sk-test");
      const { result, unmount } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.apiKey).toBe("sk-test");
      });

      const callCount = mockLoadKey.mock.calls.length;
      unmount();

      // Dispatch event after unmount
      window.dispatchEvent(new Event("openrouter-key-changed"));

      // Wait a bit to ensure no additional calls
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockLoadKey).toHaveBeenCalledTimes(callCount);
    });

    test("should clean up event listener on unmount", async () => {
      const { unmount } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(mockLoadKey).toHaveBeenCalled();
      });

      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "openrouter-key-changed",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    test("should handle multiple instances listening to events", async () => {
      mockLoadKey.mockResolvedValue("sk-shared-key");

      const { result: result1 } = renderHook(() => useOpenRouterKey());
      const { result: result2 } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result1.current.apiKey).toBe("sk-shared-key");
        expect(result2.current.apiKey).toBe("sk-shared-key");
      });

      // Mock the new key for subsequent loads
      mockLoadKey.mockResolvedValue("sk-new-shared-key");

      // Update key in first instance
      await result1.current.saveKey("sk-new-shared-key");

      // Both instances should reload
      await waitFor(() => {
        expect(result1.current.apiKey).toBe("sk-new-shared-key");
        expect(result2.current.apiKey).toBe("sk-new-shared-key");
      });
    });
  });

  describe("User Session Changes", () => {
    test("should reload when user changes", async () => {
      const firstUser = { id: "user_1", email: "user1@test.com" };
      const secondUser = { id: "user_2", email: "user2@test.com" };

      mockUseSession.mockReturnValue({ data: { user: firstUser } });
      mockLoadKey.mockResolvedValue("sk-user1-key");

      const { result, rerender } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.apiKey).toBe("sk-user1-key");
      });

      // Change user
      mockUseSession.mockReturnValue({ data: { user: secondUser } });
      mockLoadKey.mockResolvedValue("sk-user2-key");

      rerender();

      await waitFor(() => {
        expect(result.current.apiKey).toBe("sk-user2-key");
      });
    });

    test("should clear key when user logs out", async () => {
      mockLoadKey.mockResolvedValue("sk-test-key");
      mockUseSession.mockReturnValue({ data: { user: mockUser } });

      const { result, rerender } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.apiKey).toBe("sk-test-key");
      });

      // Simulate logout
      mockUseSession.mockReturnValue({ data: null });
      rerender();

      await waitFor(() => {
        expect(result.current.apiKey).toBe(null);
        expect(result.current.hasKey).toBe(false);
      });
    });
  });

  describe("Convex Client State", () => {
    test("should handle Convex client becoming available", async () => {
      mockUseConvex.mockReturnValue(null);
      mockLoadKey.mockResolvedValue("sk-test-key");

      const { result, rerender } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockLoadKey).not.toHaveBeenCalled();

      // Convex becomes ready
      mockUseConvex.mockReturnValue(mockConvex);
      rerender();

      await waitFor(() => {
        expect(result.current.apiKey).toBe("sk-test-key");
      });

      expect(mockLoadKey).toHaveBeenCalled();
    });

    test("should handle Convex client becoming unavailable", async () => {
      mockLoadKey.mockResolvedValue("sk-test-key");
      mockUseConvex.mockReturnValue(mockConvex);

      const { result, rerender } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.apiKey).toBe("sk-test-key");
      });

      // Convex becomes unavailable
      mockUseConvex.mockReturnValue(null);
      rerender();

      // State should remain but no new operations should work
      expect(result.current.apiKey).toBe("sk-test-key");

      await expect(result.current.saveKey("new-key")).rejects.toThrow(
        "Convex client not ready"
      );
    });
  });

  describe("Edge Cases", () => {
    test("should handle rapid save calls", async () => {
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Rapid fire saves
      const promises = [
        result.current.saveKey("key1"),
        result.current.saveKey("key2"),
        result.current.saveKey("key3"),
      ];

      await Promise.all(promises);

      // All saves should complete
      expect(mockSaveKey).toHaveBeenCalledTimes(3);
    });

    test("should handle empty string as key", async () => {
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.saveKey("");

      expect(mockSaveKey).toHaveBeenCalledWith(
        "",
        mockConvexUser._id,
        mockUser.id,
        mockConvex
      );
    });

    test("should handle very long key strings", async () => {
      const longKey = "sk-" + "a".repeat(500);
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.saveKey(longKey);

      expect(mockSaveKey).toHaveBeenCalledWith(
        longKey,
        mockConvexUser._id,
        mockUser.id,
        mockConvex
      );
    });

    test("should handle special characters in key", async () => {
      const specialKey = "sk-test!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.saveKey(specialKey);

      expect(mockSaveKey).toHaveBeenCalledWith(
        specialKey,
        mockConvexUser._id,
        mockUser.id,
        mockConvex
      );
    });

    test("should maintain referential stability of functions", () => {
      const { result, rerender } = renderHook(() => useOpenRouterKey());

      const saveKey1 = result.current.saveKey;
      const removeKey1 = result.current.removeKey;

      rerender();

      const saveKey2 = result.current.saveKey;
      const removeKey2 = result.current.removeKey;

      // Functions should maintain reference (via useCallback)
      expect(saveKey1).toBe(saveKey2);
      expect(removeKey1).toBe(removeKey2);
    });

    test("should handle concurrent save and remove operations", async () => {
      mockLoadKey.mockResolvedValue("sk-initial");
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.apiKey).toBe("sk-initial");
      });

      // Start both operations at once
      const savePromise = result.current.saveKey("sk-new");
      const removePromise = result.current.removeKey();

      // Both should complete
      await Promise.all([savePromise, removePromise]);

      expect(mockSaveKey).toHaveBeenCalled();
      expect(mockRemoveKey).toHaveBeenCalled();
    });

    test("should clear error state on successful operation after error", async () => {
      const testError = new Error("Initial error");
      mockLoadKey.mockRejectedValueOnce(testError);

      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Now succeed
      mockSaveKey.mockResolvedValue(undefined);
      await result.current.saveKey("sk-success");

      await waitFor(() => {
        expect(result.current.error).toBe(null);
      });
    });
  });

  describe("hasKey Computed Property", () => {
    test("should return false when key is null", async () => {
      mockLoadKey.mockResolvedValue(null);
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasKey).toBe(false);
    });

    test("should return true when key exists", async () => {
      mockLoadKey.mockResolvedValue("sk-test-key");
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasKey).toBe(true);
    });

    test("should update when key is saved", async () => {
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasKey).toBe(false);

      await result.current.saveKey("sk-new-key");

      await waitFor(() => {
        expect(result.current.hasKey).toBe(true);
      });
    });

    test("should update when key is removed", async () => {
      mockLoadKey.mockResolvedValue("sk-existing");
      const { result } = renderHook(() => useOpenRouterKey());

      await waitFor(() => {
        expect(result.current.hasKey).toBe(true);
      });

      await result.current.removeKey();

      await waitFor(() => {
        expect(result.current.hasKey).toBe(false);
      });
    });
  });
});
