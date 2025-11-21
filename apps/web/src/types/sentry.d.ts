/**
 * Sentry Type Declarations
 *
 * Global window type declarations for Sentry integration
 * This allows type-safe access to Sentry methods without using 'as any'
 */

interface SentryOptions {
  level?: "fatal" | "error" | "warning" | "log" | "info" | "debug";
  contexts?: Record<string, unknown>;
  tags?: Record<string, string | number | boolean>;
}

interface SentryUser {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
  [key: string]: unknown;
}

interface SentryScope {
  setUser(user: SentryUser | null): void;
  setTag(key: string, value: string | number | boolean): void;
  setContext(name: string, context: Record<string, unknown> | null): void;
  setLevel(level: SentryOptions["level"]): void;
  setExtra(key: string, extra: unknown): void;
}

interface SentryFeedbackOptions {
  eventId?: string;
  title?: string;
  subtitle?: string;
  subtitle2?: string;
  labelName?: string;
  labelEmail?: string;
  labelComments?: string;
  labelClose?: string;
  labelSubmit?: string;
  errorGeneric?: string;
  errorFormEntry?: string;
  successMessage?: string;
}

interface Sentry {
  captureException(
    exception: Error | unknown,
    captureContext?: SentryOptions
  ): string;
  captureMessage(
    message: string,
    captureContext?: SentryOptions
  ): string;
  showReportDialog(options?: SentryFeedbackOptions): void;
  configureScope(callback: (scope: SentryScope) => void): void;
  withScope(callback: (scope: SentryScope) => void): void;
  setUser(user: SentryUser | null): void;
  setTag(key: string, value: string | number | boolean): void;
  setContext(name: string, context: Record<string, unknown> | null): void;
}

declare global {
  interface Window {
    Sentry?: Sentry;
  }
}

export {};
