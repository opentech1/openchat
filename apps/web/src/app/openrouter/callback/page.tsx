"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConvex } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { useConvexUser } from "@/contexts/convex-user-context";
import {
  exchangeCodeForKey,
  getStoredCodeVerifier,
  getStoredState,
  clearOAuthState,
} from "@/lib/openrouter-oauth";
import { saveOpenRouterKey } from "@/lib/openrouter-key-storage";
import { logError } from "@/lib/logger";
import { Logo } from "@/components/logo";

export default function OpenRouterCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const convex = useConvex();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const { convexUser } = useConvexUser();

  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get authorization code and state from URL
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        if (!code) {
          throw new Error("No authorization code received from OpenRouter");
        }

        // Verify state to prevent CSRF attacks
        const storedState = getStoredState();
        if (state !== storedState) {
          throw new Error("Invalid state parameter - possible CSRF attack");
        }

        // Get code verifier from sessionStorage
        const codeVerifier = getStoredCodeVerifier();
        if (!codeVerifier) {
          throw new Error(
            "Code verifier not found. Please try signing in again."
          );
        }

        // Wait for user to be authenticated
        if (!user?.id || !convexUser?._id || !convex) {
          // Still waiting for authentication
          return;
        }

        // Exchange code for API key
        setStatus("processing");
        const apiKey = await exchangeCodeForKey(code, codeVerifier);

        // Save encrypted key to database
        await saveOpenRouterKey(apiKey, convexUser._id, user.id, convex);

        // Clear OAuth state from storage
        clearOAuthState();

        // Success! Redirect to dashboard
        setStatus("success");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } catch (error) {
        console.error("OAuth callback error:", error);
        logError("OpenRouter OAuth callback failed", error);

        const message =
          error instanceof Error
            ? error.message
            : "Failed to complete OAuth flow";
        setErrorMessage(message);
        setStatus("error");

        // Clear OAuth state even on error
        clearOAuthState();
      }
    };

    void handleCallback();
  }, [searchParams, user?.id, convexUser?._id, convex, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <Logo size="medium" />
        </div>

        {status === "processing" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Connecting to OpenRouter</h1>
              <p className="text-muted-foreground text-sm">
                Please wait while we complete the authentication...
              </p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <svg
                  className="h-6 w-6 text-green-600 dark:text-green-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Authentication Successful</h1>
              <p className="text-muted-foreground text-sm">
                Your OpenRouter account has been connected. Redirecting to
                dashboard...
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <svg
                  className="h-6 w-6 text-red-600 dark:text-red-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Authentication Failed</h1>
              <p className="text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
              <p className="text-muted-foreground text-sm">
                Please try again or contact support if the issue persists.
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
