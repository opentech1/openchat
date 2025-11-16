/**
 * OpenRouter OAuth PKCE Flow Implementation
 *
 * Implements OAuth 2.0 with PKCE (Proof Key for Code Exchange) for secure
 * authentication with OpenRouter API without exposing client secrets.
 *
 * Flow:
 * 1. Generate code verifier (random string) and code challenge (SHA-256 hash)
 * 2. Redirect user to OpenRouter authorization page
 * 3. User authorizes, OpenRouter redirects back with authorization code
 * 4. Exchange code for API key using code verifier
 * 5. Store encrypted API key in database
 */

const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
const OPENROUTER_TOKEN_URL = "https://openrouter.ai/api/v1/auth/keys";

// Storage keys for OAuth state
const STORAGE_KEYS = {
  CODE_VERIFIER: "openrouter_code_verifier",
  STATE: "openrouter_oauth_state",
} as const;

/**
 * Generates a random code verifier for PKCE
 * Creates a cryptographically secure random string (43-128 characters)
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Generates a code challenge from the verifier using SHA-256
 * The challenge is sent to the auth server, verifier is kept secret
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64URLEncode(new Uint8Array(hash));
}

/**
 * Encodes data to base64url format (URL-safe base64)
 * Replaces +/= with -_~ as per RFC 7636
 */
function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Generates a random state string for CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Initiates the OAuth flow by redirecting to OpenRouter
 * Generates PKCE parameters, stores verifier in sessionStorage
 *
 * @param callbackUrl - The URL to redirect back to after authorization
 */
export function initiateOAuthFlow(callbackUrl: string): void {
  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const state = generateState();

  // Store verifier and state in sessionStorage (persists during redirect)
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
    sessionStorage.setItem(STORAGE_KEYS.STATE, state);
  }

  // Generate code challenge asynchronously and redirect
  void (async () => {
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Build authorization URL
    const authUrl = new URL(OPENROUTER_AUTH_URL);
    authUrl.searchParams.set("callback_url", callbackUrl);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", state);

    // Redirect to OpenRouter
    if (typeof window !== "undefined") {
      window.location.href = authUrl.toString();
    }
  })();
}

/**
 * Retrieves the stored code verifier from sessionStorage
 */
export function getStoredCodeVerifier(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
}

/**
 * Retrieves the stored state from sessionStorage
 */
export function getStoredState(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEYS.STATE);
}

/**
 * Clears OAuth state from sessionStorage
 */
export function clearOAuthState(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
  sessionStorage.removeItem(STORAGE_KEYS.STATE);
}

/**
 * Exchanges authorization code for API key
 *
 * @param code - Authorization code from OpenRouter redirect
 * @param codeVerifier - The original code verifier from sessionStorage
 * @returns The API key from OpenRouter
 */
export async function exchangeCodeForKey(
  code: string,
  codeVerifier: string
): Promise<string> {
  try {
    const response = await fetch(OPENROUTER_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        code_challenge_method: "S256",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to exchange code for API key: ${response.status} ${errorText}`
      );
    }

    const data = await response.json();

    // OpenRouter returns the API key in the 'key' field
    if (!data.key) {
      throw new Error("No API key returned from OpenRouter");
    }

    return data.key;
  } catch (error) {
    console.error("Error exchanging code for key:", error);
    throw error instanceof Error
      ? error
      : new Error("Failed to exchange authorization code");
  }
}
