# PostHog Event Plan

This document outlines a PostHog instrumentation blueprint for the OpenChat monorepo (web, server, extension). It focuses on events that turn the app's critical flows into actionable insights and includes property suggestions, owners, and reporting ideas.

---

## 1. Baseline Setup & Guardrails

- **Client bootstrap (`apps/web/src/lib/posthog.ts`)**
	- Continue initialising PostHog lazily. Add `client.register({ app: "openchat-web", app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev" })`.
	- Keep manual `$pageview`, but include `referrer_url: document.referrer || "direct"`, `referrer_domain`, `entry_path`, `entry_query`. This satisfies the "where user comes from" requirement even when PostHog’s default referrer can’t access cross-origin titles.
- **Server capture (`apps/web/src/lib/posthog-server.ts`, `apps/server/src/lib/posthog.ts`)**
	- Register `environment`, `deployment_region`, `app: "openchat-server"`.
	- Always call `captureServerEvent`/`capturePosthogEvent` inside `try/finally` blocks that already have a distinct user id; skip when unauthenticated.
- **Identity**
	- Once a session resolves (`chat-room.tsx`, `AppSidebar`), call `identifyClient(userId)` and `posthog.group("workspace", workspaceId)` for collaboration metrics. For guests, register `auth_state: "guest"`.
	- Register shared super-properties: `auth_state`, `has_openrouter_key`, `workspace_id`, `ui_theme` (dark/light), `brand_theme`.

---

## 2. Core Event Taxonomy

| Event | Trigger (file / hook) | Key properties | Why it matters |
| --- | --- | --- | --- |
| `marketing.visit_landing` | `hero-section.tsx` on mount | `referrer_url`, `referrer_domain`, `utm_source/medium/campaign`, `entry_path`, `session_is_guest` | Quantify acquisition sources and landing page conversion. |
| `marketing.cta_clicked` | Primary CTAs (`hero-section`, header, footer) | `cta_id` (`hero_try_openchat`, `hero_request_demo`, `header_dashboard`), `cta_copy`, `section`, `screen_width_bucket` | Measure CTA performance and feed experiments. |
| `marketing.menu_toggled` | Mobile nav toggle (`header.tsx`) | `state` (`open`/`closed`), `has_account` | Understand mobile navigation friction. |
| `auth.sign_in_started` | Submit in `sign-in-form.tsx` | `remember_me`, `email_domain` | Funnel start for sign-in. |
| `auth.sign_in` *(already exists)* | On success (`sign-in-form.tsx`) | Add: `method: "password"`, `remember_me`, `email_domain` | Track completions; align property naming. |
| `auth.sign_in_failed` | `sign-in-form.tsx` catch/toast error | `error_type`, `http_status` | Quantify failure reasons. |
| `auth.sign_up_started` | Submit in `sign-up-form.tsx` | `plan_hint` (if future tiers), `email_domain` | Funnel start for registrations. |
| `auth.sign_up` *(already exists)* | On success (`sign-up-form.tsx`) | Add: `method`, `email_domain` | Activation metric. |
| `auth.sign_up_failed` | Error branch (`sign-up-form.tsx`) | `error_type`, `http_status` | Detect validation friction. |
| `auth.sign_out` | After `handleSignOut` (`account-settings-modal.tsx`) | `session_length_minutes`, `chat_count` | Retention signal and clean cohorts. |
| `dashboard.entered` | `dashboard/layout.tsx` after chats load | `chat_total`, `has_api_key`, `auth_state`, `entry_path` | Baseline for active users. |
| `sidebar.chat_selected` | Link click in `ChatList` (`app-sidebar.tsx`) | `chat_id`, `position_index`, `source: "sidebar"`, `previous_chat_id` | Understand navigation patterns. |
| `sidebar.chat_delete_confirmation` | Delete button click (`ChatList`) | `chat_id`, `has_messages`, `is_guest` | Gauge destructive action frequency. |
| `chat.created` *(existing front/back)* | Sidebar button (`app-sidebar.tsx`) & server router | Add properties: `source` (`sidebar_button`, `auto`), `title_length`, `storage_backend` (`postgres`, `memory_fallback`) | Tie creation intent with backend success. |
| `chat.deleted` | Success path in `client.chats.delete` promise | `chat_id`, `message_count`, `storage_backend` | Measure churn of conversations. |
| `chat_message_submitted` *(existing)* | `chat-room.tsx` send handler | Add: `attachment_count`, `has_api_key`, `model_id`, `characters`, `input_latency_ms` (keydown→send). | Core usage + leading indicator for spend. |
| `chat.stream_started` | Before `streamText` call (`chat-handler.ts`) | `chat_id`, `model_id`, `openrouter_base`, `user_character_count` | Count completions vs attempts. |
| `chat_message_stream` *(existing server)* | Already captured in handler | Extend props: `chunk_count`, `error_code`, `openrouter_status`, `rate_limit_bucket`, `trail_latency_ms`. | Deep health KPI for completions. |
| `chat.stream_stopped` | `onStop` in `ChatComposer` | `chat_id`, `model_id`, `elapsed_ms`, `reason` (`user_stop`) | Identify interruption patterns. |
| `chat.attachment_added` | `handleFileSelection` success (`chat-composer.tsx`) | `file_mime`, `file_size_bytes`, `attachment_count` | Demand for multimodal features. |
| `chat.attachment_rejected` | Attachment > 5 MB path | `file_name`, `file_size_bytes`, `limit_bytes` | Justify raising limits or copy tweaks. |
| `chat.scroll_to_bottom_clicked` | Button in `chat-messages-panel.tsx` | `message_count`, `unpinned_distance_px` | Diagnose long thread UX. |
| `openrouter.key_prompt_shown` | `OpenRouterLinkModal` open | `reason` (`missing`, `error`), `api_key_present` | Track onboarding friction. |
| `openrouter.key_saved` | Success in `handleSaveApiKey` (modal + account settings) | `source` (`modal`, `settings`), `masked_tail`, `scope` | Activation milestone. |
| `openrouter.key_removed` | `handleRemoveApiKey` | `source`, `had_models_cached` | Detect churn risk. |
| `openrouter.models_fetch_started` | Before fetch POST `/api/openrouter/models` | `provider_host` | Baseline latency metrics. |
| `openrouter.models_fetch_failed` | Catch in `fetchModels` (`chat-room.tsx`) | `status`, `error_message`, `api_key_present` | Health signal for vendor issues. |
| `openrouter.model_selected` | `onChange` in `ModelSelector` | `model_id`, `pricing_prompt`, `pricing_completion`, `context_length` | Allows per-model retention split. |
| `openrouter.requirement_missing` | `handleMissingRequirement` | `requirement` (`apiKey`, `model`), `chat_id` | Detect gating blockers. |
| `settings.viewed` | `SettingsPageClient` mount | `is_guest`, `has_api_key`, `theme` | Settings engagement. |
| `settings.account_modal_opened` | `setOpen(true)` in settings/account | `is_guest` | Confirm guests hit paywall. |
| `settings.guest_cta_clicked` | Guest button → `/auth/sign-in` | `cta_copy`, `location` | Evaluate guest-to-auth conversion. |
| `theme.toggle` | `ThemeToggle` click | `from_theme`, `to_theme`, `auth_state` | Measure dark mode preference. |
| `brand_theme.selected` | `ThemeSelector` setTheme | `brand_theme_id`, `previous_theme` | Input for appearance roadmap. |
| `account.modal_opened` | Header/account button | `session_state` | Quick access usage. |
| `account.user_id_copied` | `handleCopyUserId` | `account_type` | Niche but indicates power users/devs. |
| `sync.connection_state` | `connect()` success/error (`apps/web/src/lib/sync.ts`) | `state` (`connected`, `retry`, `failed`), `retry_count`, `tab_id` | Track live sync reliability. |
| `sync.topic_subscription` | `subscribe()` | `topic`, `handler_count`, `tab_id` | Understand load on hub. |
| `workspace.fallback_storage_used` | `catch` branches in server router when DB fails | `chat_id`, `operation` (`create`, `list`, `send`, `streamUpsert`), `fallback_size` | Alert when falling back to in-memory stores. |
| `rpc.error` | ORPC client error wrapper | `procedure`, `http_status`, `error_code`, `auth_state` | Spot failing backend routes. |
| `rate_limit.hit` | `createChatHandler` rate limited branch | `limit`, `window_ms`, `client_ip_hash` | Monitor traffic spikes. |
| `extension.popup_opened` | `apps/extension/entrypoints/popup/main.tsx` render | `browser`, `extension_version` | Baseline for extension usage. |
| `extension.counter_incremented` | Button click in popup | `count` | Placeholder until real features ship. |

> **Naming convention**: use `scope.action` (lowercase, snake words). Keep existing `auth.sign_in`/`chat_message_submitted` but align new events to the same style.

---

## 3. Common Properties

Set these super-properties via `posthog.register` (client) and `client.capture({ properties })` (server):

- `auth_state`: `"guest"` or `"member"`.
- `workspace_id`: `session.user.id` (still set for guests).
- `plan_tier`: `"free"` for guests, future paid tiers later.
- `has_openrouter_key`: boolean; update whenever the key is saved/removed.
- `model_id`: last selected model (register after `openrouter.model_selected`).
- `ui_theme`: `"light"`/`"dark"`.
- `brand_theme`: `BrandThemeProvider` current theme id.
- `app_version`: surface via env (web & server).
- `deployment`: `"local"`, `"staging"`, `"prod"` using env flags.
- `electric_enabled`: from `process.env.NEXT_PUBLIC_ELECTRIC_URL` truthiness.

For server-side events, add:

- `origin`: host making the request (from `validateRequestOrigin`).
- `ip_hash`: SHA-256 of `pickClientIp(request)` truncated to respect privacy.
- `openrouter_latency_ms`, `openrouter_status`, `stream_status` where applicable.

---

## 4. Dashboards & Insights

1. **Activation Funnel**
	- Steps: `marketing.visit_landing` → `marketing.cta_clicked` (CTA = `hero_try_openchat`) → `auth.sign_up_started` → `auth.sign_up` → `dashboard.entered` → `openrouter.key_saved`.
	- Slice by `referrer_domain`, `utm_source`, `auth_state`.
2. **Chat Health Overview**
	- Time-series of `chat_message_submitted`, `chat_message_stream` (`status` split), average `durationMs`, average `characters`.
	- Breakdown by `model_id`, `has_openrouter_key`, `deployment`.
3. **Sync Reliability Board**
	- Monitor `sync.connection_state` (`state = failed`), `workspace.fallback_storage_used`, `rpc.error`.
	- Set alerts when fallback usage > 5% of total events.
4. **Personalization Adoption**
	- Pie charts for `ui_theme`, `brand_theme.selected`.
	- Funnel `settings.viewed` → `theme.toggle`/`brand_theme.selected`.
5. **Attachment Usage**
	- Count of `chat.attachment_added` vs `chat.attachment_rejected`.
	- Weighted by file type to justify storage roadmap.
6. **Model Performance Report**
	- Compare `chat_message_stream` success rate, median `durationMs`, and tokens (approx via `characters`) by `model_id`.
	- Flag models with >5% error rate (`status = error`).
7. **Guest vs Authenticated Cohort Retention**
	- Use `auth_state` property to build retention curves and segment `chat.created`, `openrouter.key_saved`.

---

## 5. Implementation Notes by File

- `apps/web/src/components/hero-section.tsx`: fire landing + CTA events using `captureClientEvent`.
- `apps/web/src/components/auth/sign-*.tsx`: wrap submission and error flows.
- `apps/web/src/components/app-sidebar.tsx`: emit selection/deletion events; include fallback detection by reading the local `fallbackChats` vs `electric`.
- `apps/web/src/components/chat-room.tsx`: enrich existing events with new properties, add attachments + requirement events.
- `apps/web/src/components/chat-composer.tsx`: instrument attachments and stop button.
- `apps/web/src/components/chat-messages-panel.tsx`: scroll-to-bottom.
- `apps/web/src/components/openrouter-link-modal.tsx` & `account-settings-modal.tsx`: API key lifecycle events.
- `apps/web/src/components/settings-page-client.tsx`: `settings.viewed`, guest CTA, theme picks.
- `apps/web/src/components/theme-toggle.tsx` & `settings/theme-selector.tsx`: theme events.
- `apps/web/src/lib/sync.ts`: connection/subscription telemetry.
- `apps/server/src/routers/index.ts`: in catch blocks where fallback memory is used, capture `workspace.fallback_storage_used`.
- `apps/web/src/app/api/chat/chat-handler.ts`: expand streaming events, rate-limit hits, API failures.
- `apps/web/src/utils/orpc.ts`: wrap `client` calls with error instrumentation for `rpc.error`.
- `apps/extension/entrypoints/popup/*.tsx`: minimal signals for extension adoption (optional now).

---

## 6. Next Steps

1. Align engineering on naming conventions (`scope.action`) and property casing (snake_case).
2. Implement super-property registration + `$pageview` enhancement (referrer/domain) first so every session has provenance.
3. Iterate on event additions by surface (auth → chat → settings), deploying behind a feature flag if needed.
4. Validate in PostHog using the "Live events" feed; ensure events marry to the correct distinct ids (guest vs authenticated).
5. Build dashboards in the order above, then share with stakeholders for feedback.

With this instrumentation in place, you’ll have the coverage needed to monitor acquisition sources, onboarding friction, chat reliability, personalization adoption, and extension engagement—all within PostHog.

