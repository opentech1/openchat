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
	- Even without a full auth system, continue generating a stable guest/workspace id (`ensureGuestId*`). Call `identifyClient(distinctId)` once per session and optionally `posthog.group("workspace", workspaceId)` to keep chat cohorts together.
	- Register lightweight super-properties: `auth_state: "guest"`, `has_openrouter_key`, `workspace_id`, `ui_theme` (dark/light), `brand_theme`.

---

## 2. Core Event Taxonomy (Lean Set)

These 14 events cover the highest-leverage insights without burning volume on low-signal noise.

| Event | Trigger (file / hook) | Key properties | Value |
| --- | --- | --- | --- |
| `marketing.visit_landing` | `hero-section.tsx` on mount | `referrer_url`, `referrer_domain`, `utm_source`, `entry_path`, `session_is_guest` | Measures acquisition mix and landing conversion without relying on auth. |
| `marketing.cta_clicked` | Primary CTAs (`hero-section`, header CTA) | `cta_id` (`hero_try_openchat`, `hero_request_demo`), `cta_copy`, `section`, `screen_width_bucket` | Shows which CTAs turn visitors into users. |
| `dashboard.entered` | `dashboard/layout.tsx` after chat list load | `chat_total`, `has_api_key`, `entry_path`, `brand_theme` | Baseline active sessions and personalization adoption. |
| `chat.created` *(front + server)* | Sidebar “New Chat” + router success | `chat_id`, `source` (`sidebar_button`), `storage_backend` (`postgres`, `memory_fallback`), `title_length` | Tracks creation intent and fallback usage. |
| `chat_message_submitted` *(existing)* | `chat-room.tsx` send handler | `chat_id`, `model_id`, `characters`, `attachment_count`, `has_api_key` | Core usage + cost proxy by model and content length. |
| `chat_message_stream` *(existing server)* | `/api/chat` handler completion | `chat_id`, `model_id`, `status` (`completed`, `error`, `aborted`), `duration_ms`, `characters`, `openrouter_status`, `rate_limit_bucket` | Single source of truth for streaming health. |
| `chat.rate_limited` | 429 branch in `createChatHandler` | `chat_id`, `limit`, `window_ms`, `client_ip_hash_trunc` | Detect traffic spikes or abuse without extra server logs. |
| `chat.attachment_event` | `handleFileSelection` success/failure | `chat_id`, `result` (`accepted`, `rejected`), `file_mime`, `file_size_bytes`, `limit_bytes` | One event that captures attachment demand and guardrail friction. |
| `openrouter.key_prompt_shown` | `OpenRouterLinkModal` open | `reason` (`missing`, `error`), `has_api_key` | Measures API-key onboarding friction. |
| `openrouter.key_saved` | Successful save (modal or settings) | `source` (`modal`, `settings`), `masked_tail`, `scope` | Activation milestone toward usable chats. |
| `openrouter.key_removed` | `handleRemoveApiKey` | `source`, `had_models_cached` | Detects churn risk for paid usage. |
| `openrouter.models_fetch_failed` | Catch in `fetchModels` | `status`, `error_message`, `provider_host`, `has_api_key` | Alerts when model catalogue fails—critical reliability signal. |
| `sync.connection_state` | `apps/web/src/lib/sync.ts` (`onopen`, `onclose`, retry) | `state` (`connected`, `retry`, `failed`), `retry_count`, `tab_id` | Observability for live sync without extra logs. |
| `workspace.fallback_storage_used` | Server router fallback branches | `operation` (`create`, `list`, `send`, `streamUpsert`), `chat_id`, `fallback_size` | Immediate warning when DB connectivity regresses. |

> **Naming convention**: use `scope.action` (lowercase, snake words). Keep existing `chat_message_submitted` naming and align new events to the same style.

---

## 3. Common Properties

Set these super-properties via `posthog.register` (client) and `client.capture({ properties })` (server):

- `auth_state`: `"guest"` today; toggle to `"member"` once auth ships.
- `workspace_id`: the stable id from guest/session helpers.
- `has_openrouter_key`: boolean updated on key save/remove.
- `model_id`: last selected model (register inside `ModelSelector`’s `onChange`).
- `ui_theme`: `"light"`/`"dark"`.
- `brand_theme`: brand accent from `BrandThemeProvider`.
- `app_version`: surface via env (web & server).
- `deployment`: `"local"`, `"staging"`, `"prod"` using env flags.
- `electric_enabled`: from `process.env.NEXT_PUBLIC_ELECTRIC_URL` truthiness.

For server-side events, add:

- `origin`: host making the request (from `validateRequestOrigin`).
- `ip_hash`: SHA-256 of `pickClientIp(request)` truncated (first 8 bytes) to respect privacy.
- `openrouter_latency_ms`, `openrouter_status` when streaming.

---

## 4. Dashboards & Insights

1. **Acquisition to Activation Funnel**
	- Steps: `marketing.visit_landing` → `marketing.cta_clicked` (CTA = `hero_try_openchat`) → `dashboard.entered` → `openrouter.key_saved`.
	- Slice by `referrer_domain`, `utm_source`, `session_is_guest`.
2. **Chat Health Overview**
	- Time-series of `chat_message_submitted` vs `chat_message_stream` (`status` split), average `duration_ms`, average `characters`.
	- Breakdown by `model_id`, `has_openrouter_key`, `deployment`.
3. **Reliability Board**
	- Track `chat.rate_limited`, `openrouter.models_fetch_failed`, `sync.connection_state` (`state = failed`), and `workspace.fallback_storage_used`.
	- Alert when fallback usage > 5% or rate limits spike.
4. **Attachment Demand**
	- Segment `chat.attachment_event` by `result`, `file_mime`, and `file_size_bytes` to justify storage roadmap.
5. **Model Performance Report**
	- Compare `chat_message_stream` success rate, median `duration_ms`, and characters by `model_id`.
	- Flag models with >5% `status = error` to trigger provider follow-up.

---

## 5. Implementation Notes by File

- `apps/web/src/components/hero-section.tsx`: fire `marketing.visit_landing` on mount and `marketing.cta_clicked` on CTA buttons.
- `apps/web/src/components/app-sidebar.tsx`: emit `chat.created` once create resolves; include `storage_backend` from response/fallback context.
- `apps/web/src/components/chat-room.tsx`: enrich `chat_message_submitted`, capture `chat.rate_limited` feedback (server response), and pass stats for `chat_message_stream`.
- `apps/web/src/components/chat-composer.tsx`: emit `chat.attachment_event` with `result` set appropriately.
- `apps/web/src/components/openrouter-link-modal.tsx` & `account-settings-modal.tsx`: handle `openrouter.key_prompt_shown`, `openrouter.key_saved`, `openrouter.key_removed`.
- `apps/web/src/components/model-selector.tsx`: update the `model_id` super-property on change.
- `apps/web/src/lib/sync.ts`: emit `sync.connection_state` inside `onopen`, `onclose`, and retry logic.
- `apps/server/src/routers/index.ts`: in catch blocks where memory fallbacks run, fire `workspace.fallback_storage_used`.
- `apps/web/src/app/api/chat/chat-handler.ts`: ensure `chat_message_stream` properties, emit `chat.rate_limited`, and capture latency/error metadata.
- `apps/web/src/lib/posthog.ts`: register shared super-properties during bootstrap.

---

## 6. Next Steps

1. Align engineering on naming conventions (`scope.action`) and property casing (snake_case).
2. Ship the `$pageview` enrichment + super-property registration so sessions always include referrer and workspace metadata.
3. Instrument the events in two passes: marketing surface (landing + CTA) followed by chat surface (creation, streaming, attachments, OpenRouter flows).
4. Validate in PostHog’s Live Events feed; confirm rate limiting and fallback events appear only when expected.
5. Build the dashboards above and set alert thresholds for reliability metrics.

With this instrumentation in place, you’ll have lean but actionable coverage across acquisition, chat usage, reliability, and OpenRouter activation without burning through unnecessary event volume.
