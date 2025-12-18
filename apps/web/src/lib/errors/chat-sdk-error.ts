/**
 * ChatSDKError - Structured error handling for chat SDK operations
 *
 * Provides typed error codes combining error type and surface area,
 * making it easy to handle specific error scenarios and provide
 * appropriate user feedback.
 *
 * Error Code Format: `${ErrorType}:${Surface}`
 * Example: 'unauthorized:auth', 'rate_limit:api', 'offline:stream'
 */

/**
 * Error types representing the category of error
 */
export type ErrorType =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limit'
  | 'upgrade_required'
  | 'offline';

/**
 * Surface areas where errors can occur
 */
export type Surface = 'chat' | 'auth' | 'api' | 'stream' | 'database' | 'model';

/**
 * Combined error code type
 */
export type ErrorCode = `${ErrorType}:${Surface}`;

/**
 * HTTP status code mapping for each error type
 */
const statusCodeMap: Record<ErrorType, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  rate_limit: 429,
  upgrade_required: 402,
  offline: 503,
};

/**
 * User-friendly messages for each error code
 */
const errorMessages: Record<ErrorCode, string> = {
  // Bad request errors
  'bad_request:chat': 'Invalid chat request. Please check your input and try again.',
  'bad_request:auth': 'Invalid authentication request. Please try again.',
  'bad_request:api': 'Invalid API request. Please check the request format.',
  'bad_request:stream': 'Invalid stream request. Please try again.',
  'bad_request:database': 'Invalid database operation. Please contact support.',
  'bad_request:model': 'Invalid model configuration. Please select a different model.',

  // Unauthorized errors
  'unauthorized:chat': 'Please sign in to continue chatting.',
  'unauthorized:auth': 'Authentication required. Please sign in.',
  'unauthorized:api': 'API authentication failed. Please sign in again.',
  'unauthorized:stream': 'Stream authentication failed. Please sign in again.',
  'unauthorized:database': 'Database authentication failed. Please sign in again.',
  'unauthorized:model': 'Model access requires authentication. Please sign in.',

  // Forbidden errors
  'forbidden:chat': 'You do not have access to this chat.',
  'forbidden:auth': 'Access denied. Please contact support.',
  'forbidden:api': 'API access denied. Check your permissions.',
  'forbidden:stream': 'Stream access denied. Check your permissions.',
  'forbidden:database': 'Database access denied. Check your permissions.',
  'forbidden:model': 'You do not have access to this model.',

  // Rate limit errors
  'rate_limit:chat': 'Too many messages. Please wait a moment before sending more.',
  'rate_limit:auth': 'Too many authentication attempts. Please try again later.',
  'rate_limit:api': 'API rate limit exceeded. Please try again later.',
  'rate_limit:stream': 'Stream rate limit exceeded. Please try again later.',
  'rate_limit:database': 'Database rate limit exceeded. Please try again later.',
  'rate_limit:model': 'Model rate limit exceeded. Please try again later.',

  // Upgrade required errors
  'upgrade_required:chat': 'Upgrade your plan to continue chatting.',
  'upgrade_required:auth': 'Upgrade required for this authentication method.',
  'upgrade_required:api': 'Upgrade your plan to access this API feature.',
  'upgrade_required:stream': 'Upgrade your plan to use streaming.',
  'upgrade_required:database': 'Upgrade your plan for additional storage.',
  'upgrade_required:model': 'Upgrade your plan to access this model.',

  // Offline errors
  'offline:chat': 'Unable to connect. Please check your internet connection.',
  'offline:auth': 'Unable to authenticate. Please check your connection.',
  'offline:api': 'API unavailable. Please check your connection.',
  'offline:stream': 'Stream connection lost. Please check your connection.',
  'offline:database': 'Database unavailable. Please try again later.',
  'offline:model': 'Model service unavailable. Please try again later.',
};

/**
 * Get a user-friendly message for an error code
 */
export function getMessageByErrorCode(errorCode: ErrorCode): string {
  return errorMessages[errorCode] ?? 'An unexpected error occurred. Please try again.';
}

/**
 * Check if the error requires user to sign in
 */
export function isSignInRequired(error: ChatSDKError | ErrorCode): boolean {
  const type = typeof error === 'string' ? error.split(':')[0] as ErrorType : error.type;
  return type === 'unauthorized';
}

/**
 * Check if the error requires a plan upgrade
 */
export function isUpgradeRequired(error: ChatSDKError | ErrorCode): boolean {
  const type = typeof error === 'string' ? error.split(':')[0] as ErrorType : error.type;
  return type === 'upgrade_required';
}

/**
 * Action that can be taken in response to an error
 */
export interface ErrorAction {
  label: string;
  action: 'sign_in' | 'upgrade' | 'retry' | 'contact_support' | 'check_connection' | 'dismiss';
  primary?: boolean;
}

/**
 * Get recommended actions for an error
 */
export function getErrorActions(error: ChatSDKError | ErrorCode): ErrorAction[] {
  const type = typeof error === 'string' ? error.split(':')[0] as ErrorType : error.type;

  switch (type) {
    case 'unauthorized':
      return [
        { label: 'Sign In', action: 'sign_in', primary: true },
        { label: 'Dismiss', action: 'dismiss' },
      ];

    case 'upgrade_required':
      return [
        { label: 'Upgrade Plan', action: 'upgrade', primary: true },
        { label: 'Dismiss', action: 'dismiss' },
      ];

    case 'rate_limit':
      return [
        { label: 'Try Again', action: 'retry', primary: true },
        { label: 'Dismiss', action: 'dismiss' },
      ];

    case 'offline':
      return [
        { label: 'Check Connection', action: 'check_connection', primary: true },
        { label: 'Retry', action: 'retry' },
      ];

    case 'forbidden':
      return [
        { label: 'Contact Support', action: 'contact_support', primary: true },
        { label: 'Dismiss', action: 'dismiss' },
      ];

    case 'bad_request':
    default:
      return [
        { label: 'Try Again', action: 'retry', primary: true },
        { label: 'Dismiss', action: 'dismiss' },
      ];
  }
}

/**
 * ChatSDKError class for structured error handling
 *
 * @example
 * ```typescript
 * // Throwing an error
 * throw new ChatSDKError('unauthorized:chat', 'User session expired');
 *
 * // Creating a response in API routes
 * return new ChatSDKError('rate_limit:api', 'Too many requests').toResponse();
 *
 * // Checking error type
 * if (isSignInRequired(error)) {
 *   redirect('/auth/sign-in');
 * }
 * ```
 */
export class ChatSDKError extends Error {
  public readonly type: ErrorType;
  public readonly surface: Surface;
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly errorCause?: string;

  constructor(errorCode: ErrorCode, cause?: string) {
    super();
    const [type, surface] = errorCode.split(':') as [ErrorType, Surface];

    this.type = type;
    this.surface = surface;
    this.code = errorCode;
    this.errorCause = cause;
    this.message = getMessageByErrorCode(errorCode);
    this.statusCode = statusCodeMap[type];
    this.name = 'ChatSDKError';

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ChatSDKError);
    }
  }

  /**
   * Convert error to HTTP Response for API routes
   */
  toResponse(): Response {
    return Response.json(
      {
        code: this.code,
        message: this.message,
        cause: this.errorCause,
      },
      { status: this.statusCode }
    );
  }

  /**
   * Check if this error requires sign in
   */
  isSignInRequired(): boolean {
    return isSignInRequired(this);
  }

  /**
   * Check if this error requires upgrade
   */
  isUpgradeRequired(): boolean {
    return isUpgradeRequired(this);
  }

  /**
   * Get recommended actions for this error
   */
  getActions(): ErrorAction[] {
    return getErrorActions(this);
  }

  /**
   * Create error from a Response object
   */
  static async fromResponse(response: Response): Promise<ChatSDKError> {
    try {
      const data = await response.json();
      if (data.code && typeof data.code === 'string' && data.code.includes(':')) {
        return new ChatSDKError(data.code as ErrorCode, data.cause);
      }
    } catch {
      // Failed to parse response as ChatSDKError
    }

    // Map HTTP status to error code
    const surface: Surface = 'api';
    let type: ErrorType;

    switch (response.status) {
      case 400:
        type = 'bad_request';
        break;
      case 401:
        type = 'unauthorized';
        break;
      case 403:
        type = 'forbidden';
        break;
      case 402:
        type = 'upgrade_required';
        break;
      case 429:
        type = 'rate_limit';
        break;
      case 503:
      case 502:
      case 504:
        type = 'offline';
        break;
      default:
        type = 'bad_request';
    }

    return new ChatSDKError(`${type}:${surface}`, response.statusText);
  }

  /**
   * Check if an unknown error is a ChatSDKError
   */
  static isChatSDKError(error: unknown): error is ChatSDKError {
    return error instanceof ChatSDKError;
  }
}

/**
 * Type guard to check if a value is a valid ErrorCode
 */
export function isValidErrorCode(value: unknown): value is ErrorCode {
  if (typeof value !== 'string') return false;

  const parts = value.split(':');
  if (parts.length !== 2) return false;

  const [type, surface] = parts;
  const validTypes: ErrorType[] = ['bad_request', 'unauthorized', 'forbidden', 'rate_limit', 'upgrade_required', 'offline'];
  const validSurfaces: Surface[] = ['chat', 'auth', 'api', 'stream', 'database', 'model'];

  return validTypes.includes(type as ErrorType) && validSurfaces.includes(surface as Surface);
}
