import SettingsPageClient from "@/components/settings-page-client";

/**
 * Settings Page
 * 
 * NOTE: Authentication is handled by the parent layout's AuthGuard component.
 * We don't need server-side auth checks here because:
 * 1. The parent dashboard layout already wraps everything in AuthGuard
 * 2. Server-side cookies() may not be available in some environments (Edge, Cloudflare)
 * 3. Double auth checks can cause race conditions and unexpected redirects
 */
export default function SettingsPage() {
	return <SettingsPageClient />;
}
