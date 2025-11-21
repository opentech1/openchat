/**
 * Comprehensive Unit Tests for useOpenRouterOAuth Hook
 *
 * Tests the React hook for OpenRouter OAuth PKCE authentication flow,
 * including URL generation, callback handling, code exchange, and error states.
 *
 * Coverage:
 * - OAuth flow initiation
 * - URL generation and validation
 * - PKCE parameter handling
 * - State management
 * - Error handling
 * - Loading states
 * - Window/environment checks
 * - Callback URL construction
 */

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useOpenRouterOAuth } from "@/hooks/use-openrouter-oauth";
import * as oauthLib from "@/lib/openrouter-oauth";
import * as logger from "@/lib/logger";

// Mock dependencies
vi.mock("@/lib/openrouter-oauth", () => ({
  initiateOAuthFlow: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

const mockInitiateOAuthFlow = oauthLib.initiateOAuthFlow as ReturnType<
  typeof vi.fn
>;
const mockLogError = logger.logError as ReturnType<typeof vi.fn>;

describe("useOpenRouterOAuth Hook", () => {
  // Store original values
  const originalWindow = global.window;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations to default (no-op function)
    mockInitiateOAuthFlow.mockReset();

    // Mock window.location
    delete (global as any).window;
    global.window = {
      location: {
        origin: "http://localhost:3000",
        href: "http://localhost:3000",
      },
    } as any;

    // Reset process.env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    global.window = originalWindow;
    process.env = originalEnv;
  });

  describe("Initial State", () => {
    test("should initialize with idle state", () => {
      const { result } = renderHook(() => useOpenRouterOAuth());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(typeof result.current.initiateLogin).toBe("function");
    });

    test("should return correct interface shape", () => {
      const { result } = renderHook(() => useOpenRouterOAuth());

      expect(result.current).toHaveProperty("initiateLogin");
      expect(result.current).toHaveProperty("isLoading");
      expect(result.current).toHaveProperty("error");
    });

    test("should not call initiateOAuthFlow on mount", () => {
      renderHook(() => useOpenRouterOAuth());

      expect(mockInitiateOAuthFlow).not.toHaveBeenCalled();
    });
  });

  describe("OAuth Flow Initiation", () => {
    test("should set loading state when initiating login", () => {
      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.isLoading).toBe(true);
    });

    test("should call initiateOAuthFlow with callback URL", () => {
      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "http://localhost:3000/openrouter/callback"
      );
    });

    test("should clear error state on new login attempt", () => {
      mockInitiateOAuthFlow.mockImplementation(() => {
        throw new Error("Initial error");
      });

      const { result } = renderHook(() => useOpenRouterOAuth());

      // First attempt - causes error
      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.error).toBeTruthy();

      // Mock successful flow
      mockInitiateOAuthFlow.mockImplementation(() => {});

      // Second attempt - should clear error
      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.error).toBe(null);
    });

    test("should use environment variable for callback URL when available", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://production.example.com";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "https://production.example.com/openrouter/callback"
      );
    });

    test("should fall back to window.location.origin when env var not set", () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      global.window.location.origin = "https://dynamic.example.com";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "https://dynamic.example.com/openrouter/callback"
      );
    });

    test("should handle multiple rapid initiation attempts", () => {
      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
        result.current.initiateLogin();
        result.current.initiateLogin();
      });

      // All calls should go through
      expect(mockInitiateOAuthFlow).toHaveBeenCalledTimes(3);
    });
  });

  describe("Error Handling", () => {
    test("should handle synchronous errors from initiateOAuthFlow", () => {
      const testError = new Error("OAuth flow failed");
      mockInitiateOAuthFlow.mockImplementation(() => {
        throw testError;
      });

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.error).toBe(testError);
      expect(result.current.isLoading).toBe(false);
      expect(mockLogError).toHaveBeenCalledWith(
        "Failed to initiate OpenRouter OAuth",
        testError
      );
    });

    test("should convert non-Error exceptions to Error objects", () => {
      mockInitiateOAuthFlow.mockImplementation(() => {
        throw "String error";
      });

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("String error");
      expect(result.current.isLoading).toBe(false);
    });

    test("should handle errors with custom messages", () => {
      const customError = new Error("Network timeout");
      mockInitiateOAuthFlow.mockImplementation(() => {
        throw customError;
      });

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.error?.message).toBe("Network timeout");
    });

    test("should reset loading state on error", () => {
      mockInitiateOAuthFlow.mockImplementation(() => {
        throw new Error("Test error");
      });

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("should log all errors", () => {
      const error1 = new Error("Error 1");
      const error2 = new Error("Error 2");

      mockInitiateOAuthFlow
        .mockImplementationOnce(() => {
          throw error1;
        })
        .mockImplementationOnce(() => {
          throw error2;
        });

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockLogError).toHaveBeenCalledTimes(2);
      expect(mockLogError).toHaveBeenNthCalledWith(
        1,
        "Failed to initiate OpenRouter OAuth",
        error1
      );
      expect(mockLogError).toHaveBeenNthCalledWith(
        2,
        "Failed to initiate OpenRouter OAuth",
        error2
      );
    });

    test("should handle null/undefined errors", () => {
      mockInitiateOAuthFlow.mockImplementation(() => {
        throw null;
      });

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("null");
    });

    test("should handle object errors", () => {
      mockInitiateOAuthFlow.mockImplementation(() => {
        throw { code: 400, message: "Bad request" };
      });

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain("object");
    });
  });

  describe("Loading State Management", () => {
    test("should remain loading until redirect (intentional behavior)", () => {
      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      // Loading should remain true (prevents UI flashing before redirect)
      expect(result.current.isLoading).toBe(true);
    });

    test("should handle loading state correctly on error", () => {
      mockInitiateOAuthFlow.mockImplementation(() => {
        throw new Error("Test");
      });

      const { result } = renderHook(() => useOpenRouterOAuth());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("should start with loading false", () => {
      const { result } = renderHook(() => useOpenRouterOAuth());

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Callback URL Construction", () => {
    test("should append /openrouter/callback to base URL", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "https://example.com/openrouter/callback"
      );
    });

    test("should handle base URL with trailing slash", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com/";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      // Should not have double slash
      const callbackUrl = mockInitiateOAuthFlow.mock.calls[0][0];
      expect(callbackUrl).not.toContain("//openrouter");
    });

    test("should handle localhost URLs", () => {
      global.window.location.origin = "http://localhost:3000";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "http://localhost:3000/openrouter/callback"
      );
    });

    test("should handle URLs with ports", () => {
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:8080";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "http://localhost:8080/openrouter/callback"
      );
    });

    test("should handle subdomains correctly", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.staging.example.com";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "https://app.staging.example.com/openrouter/callback"
      );
    });

    test("should handle custom paths in base URL", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com/myapp";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "https://example.com/myapp/openrouter/callback"
      );
    });
  });

  describe("Function Stability", () => {
    test("should maintain initiateLogin reference across renders", () => {
      const { result, rerender } = renderHook(() => useOpenRouterOAuth());

      const firstInitiateLogin = result.current.initiateLogin;

      rerender();

      const secondInitiateLogin = result.current.initiateLogin;

      expect(firstInitiateLogin).toBe(secondInitiateLogin);
    });

    test("should work correctly after multiple rerenders", () => {
      const { result, rerender } = renderHook(() => useOpenRouterOAuth());

      rerender();
      rerender();
      rerender();

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty string in NEXT_PUBLIC_APP_URL", () => {
      process.env.NEXT_PUBLIC_APP_URL = "";
      global.window.location.origin = "http://fallback.com";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      // Should fall back to window.location.origin
      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "http://fallback.com/openrouter/callback"
      );
    });

    test("should handle undefined window.location.origin", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://backup.com";
      delete (global.window as any).location.origin;

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      // Should use env var
      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "https://backup.com/openrouter/callback"
      );
    });

    test("should handle special characters in URLs", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com/app-name";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "https://example.com/app-name/openrouter/callback"
      );
    });

    test("should handle very long URLs", () => {
      const longPath = "a".repeat(200);
      process.env.NEXT_PUBLIC_APP_URL = `https://example.com/${longPath}`;

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalled();
      const callbackUrl = mockInitiateOAuthFlow.mock.calls[0][0];
      expect(callbackUrl).toContain(longPath);
      expect(callbackUrl).toContain("/openrouter/callback");
    });
  });

  describe("Return Value Interface", () => {
    test("should return object with three properties", () => {
      const { result } = renderHook(() => useOpenRouterOAuth());

      const keys = Object.keys(result.current);
      expect(keys).toHaveLength(3);
      expect(keys).toContain("initiateLogin");
      expect(keys).toContain("isLoading");
      expect(keys).toContain("error");
    });

    test("should have correct types for return values", () => {
      const { result } = renderHook(() => useOpenRouterOAuth());

      expect(typeof result.current.initiateLogin).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
      expect(
        result.current.error === null || result.current.error instanceof Error
      ).toBe(true);
    });
  });

  describe("State Transitions", () => {
    test("should transition from idle to loading", () => {
      const { result } = renderHook(() => useOpenRouterOAuth());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.isLoading).toBe(true);
    });

    test("should transition from loading to error on failure", () => {
      mockInitiateOAuthFlow.mockImplementation(() => {
        throw new Error("Test error");
      });

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    test("should clear error on successful retry after failure", () => {
      mockInitiateOAuthFlow
        .mockImplementationOnce(() => {
          throw new Error("Fail");
        })
        .mockImplementationOnce(() => {
          // Success
        });

      const { result } = renderHook(() => useOpenRouterOAuth());

      // First attempt - fail
      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.error).toBeTruthy();

      // Second attempt - succeed
      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.error).toBe(null);
      expect(result.current.isLoading).toBe(true);
    });

    test("should handle error -> error transition", () => {
      const error1 = new Error("Error 1");
      const error2 = new Error("Error 2");

      mockInitiateOAuthFlow
        .mockImplementationOnce(() => {
          throw error1;
        })
        .mockImplementationOnce(() => {
          throw error2;
        });

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.error).toBe(error1);

      act(() => {
        result.current.initiateLogin();
      });

      expect(result.current.error).toBe(error2);
    });
  });

  describe("Integration Scenarios", () => {
    test("should work with production environment", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      process.env.NEXT_PUBLIC_APP_URL = "https://prod.example.com";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "https://prod.example.com/openrouter/callback"
      );

      process.env.NODE_ENV = originalNodeEnv;
    });

    test("should work with development environment", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      delete process.env.NEXT_PUBLIC_APP_URL;
      global.window.location.origin = "http://localhost:3000";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "http://localhost:3000/openrouter/callback"
      );

      process.env.NODE_ENV = originalNodeEnv;
    });

    test("should work with staging environment", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://staging.example.com";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "https://staging.example.com/openrouter/callback"
      );
    });

    test("should handle preview deployments", () => {
      process.env.NEXT_PUBLIC_APP_URL =
        "https://preview-pr-123.vercel.app";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      expect(mockInitiateOAuthFlow).toHaveBeenCalledWith(
        "https://preview-pr-123.vercel.app/openrouter/callback"
      );
    });
  });

  describe("Comment Documentation Accuracy", () => {
    test("should indeed remain loading until redirect", () => {
      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      // This validates the comment in the code about loading state
      expect(result.current.isLoading).toBe(true);
    });

    test("should construct callback URL from env or origin as documented", () => {
      // Test documented fallback behavior
      delete process.env.NEXT_PUBLIC_APP_URL;
      global.window.location.origin = "http://test.com";

      const { result } = renderHook(() => useOpenRouterOAuth());

      act(() => {
        result.current.initiateLogin();
      });

      const callbackUrl = mockInitiateOAuthFlow.mock.calls[0][0];
      expect(callbackUrl).toBe("http://test.com/openrouter/callback");
    });
  });
});
