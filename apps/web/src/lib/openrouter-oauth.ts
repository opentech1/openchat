/**
 * OpenRouter OAuth PKCE Implementation
 *
 * Implements the OAuth 2.0 Authorization Code Flow with PKCE (Proof Key for Code Exchange)
 * for secure authentication with OpenRouter.
 *
 * @see https://openrouter.ai/docs/api-keys
 */

// ============================================================================
// Constants
// ============================================================================

export const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth'
export const OPENROUTER_TOKEN_URL = 'https://openrouter.ai/api/v1/auth/keys'

// Storage keys
const STORAGE_KEY_VERIFIER = 'openrouter_code_verifier'
const STORAGE_KEY_STATE = 'openrouter_oauth_state'

// ============================================================================
// Types
// ============================================================================

export interface OpenRouterTokenResponse {
  key: string
}

export interface OpenRouterErrorResponse {
  error: string
  message?: string
}

// ============================================================================
// PKCE Utilities
// ============================================================================

/**
 * Generates a cryptographically secure random code verifier.
 * The verifier must be between 43-128 characters, using unreserved URI characters.
 *
 * @returns A random code verifier string (64 characters)
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(48)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Generates a code challenge from a code verifier using SHA-256.
 * This is the S256 challenge method required by PKCE.
 *
 * @param verifier - The code verifier to hash
 * @returns The base64url-encoded SHA-256 hash of the verifier
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

/**
 * Generates a random state parameter for CSRF protection.
 *
 * @returns A random state string
 */
export function generateState(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

// ============================================================================
// OAuth Flow
// ============================================================================

/**
 * Initiates the OpenRouter OAuth PKCE flow.
 *
 * 1. Generates a code verifier and challenge
 * 2. Generates a state parameter for CSRF protection
 * 3. Stores verifier and state in sessionStorage
 * 4. Redirects the user to OpenRouter's authorization page
 *
 * @param callbackUrl - The URL to redirect back to after authorization
 */
export async function initiateOAuthFlow(callbackUrl: string): Promise<void> {
  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state = generateState()

  // Store verifier and state for later verification
  sessionStorage.setItem(STORAGE_KEY_VERIFIER, codeVerifier)
  sessionStorage.setItem(STORAGE_KEY_STATE, state)

  // Build authorization URL
  const params = new URLSearchParams({
    callback_url: callbackUrl,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })

  const authUrl = `${OPENROUTER_AUTH_URL}?${params.toString()}`

  // Redirect to OpenRouter
  window.location.href = authUrl
}

/**
 * Retrieves the stored code verifier from sessionStorage (without clearing).
 *
 * @returns The stored code verifier, or null if not found
 */
export function getStoredCodeVerifier(): string | null {
  return sessionStorage.getItem(STORAGE_KEY_VERIFIER)
}

/**
 * Retrieves the stored state from sessionStorage (without clearing).
 *
 * @returns The stored state, or null if not found
 */
export function getStoredState(): string | null {
  return sessionStorage.getItem(STORAGE_KEY_STATE)
}

/**
 * Clears the stored OAuth parameters from sessionStorage.
 * Call this after successful token exchange.
 */
export function clearOAuthStorage(): void {
  sessionStorage.removeItem(STORAGE_KEY_VERIFIER)
  sessionStorage.removeItem(STORAGE_KEY_STATE)
}

/**
 * Validates the returned state against the stored state.
 *
 * @param returnedState - The state returned from OpenRouter
 * @returns True if the state matches, false otherwise
 */
export function validateState(returnedState: string | null): boolean {
  const storedState = getStoredState()
  if (!storedState || !returnedState) {
    return false
  }
  return storedState === returnedState
}

/**
 * Exchanges the authorization code for an API key.
 *
 * @param code - The authorization code from OpenRouter
 * @param codeVerifier - The original code verifier
 * @returns The API key response or throws an error
 */
export async function exchangeCodeForKey(
  code: string,
  codeVerifier: string,
): Promise<string> {
  const response = await fetch(OPENROUTER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      code_challenge_method: 'S256',
    }),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({
      error: 'Unknown error',
    }))) as OpenRouterErrorResponse
    throw new Error(
      errorData.message || errorData.error || `HTTP ${response.status}`,
    )
  }

  const data = (await response.json()) as OpenRouterTokenResponse

  if (!data.key) {
    throw new Error('No API key returned from OpenRouter')
  }

  return data.key
}

// ============================================================================
// Internal Utilities
// ============================================================================

/**
 * Encodes a Uint8Array to a base64url string (no padding).
 *
 * @param buffer - The buffer to encode
 * @returns The base64url-encoded string
 */
function base64UrlEncode(buffer: Uint8Array): string {
  // Convert to base64
  const base64 = btoa(String.fromCharCode(...buffer))

  // Convert to base64url (URL-safe)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
