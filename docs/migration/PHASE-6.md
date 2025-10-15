# TanStack Start Migration — Phase 6 (Deployment & Cleanup)

Status: Completed baseline cutover.

Changes
- Docker now builds the TanStack Start app as the primary `web` service using `docker/web-start.Dockerfile`.
- Next.js app package removed (`apps/web/package.json` deleted). Code under `apps/web/src` remains as a shared component library imported by the Start app.
- Root scripts updated:
  - `dev` → `turbo -F web-start -F server dev`
  - `verify:build` → builds `web-start` + `server` only.

Rollback Plan
- To revert to Next.js web image, use git to checkout prior commit and restore `docker-compose.yml` web service pointing to `docker/web.Dockerfile`, and restore `apps/web/package.json`.

Notes
- Environment variable compatibility maintained (`NEXT_PUBLIC_*` and `VITE_*`) for smoother infra rollout.
- No Next.js runtime/dependencies are required at build or runtime.

