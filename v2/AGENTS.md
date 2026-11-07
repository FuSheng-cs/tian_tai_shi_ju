# V2 development boundaries

- This is the new independent `天台十句 · 未寄出的底片` chapter. Work in the existing checkout.
- The running game at `tiantaishiju.top` is read-only. Never deploy, restart, migrate, overwrite, or change its files, services, configuration, credentials, or data.
- Only the explicitly identified v2 target may be mutated. The hostname alone does not prove service/filesystem isolation; inspect those before remote deployment.
- Read `docs/v2/NARRATIVE.md` for canonical story facts. Existing v1 canon applies as historical context; the new chapter intentionally replaces the score-driven death mechanic and speculative cyberpunk roadmap.
- `web/` is a separate Vue/TypeScript app. `server/` is a separate Go module using the standard library. Frontend development uses port 5174; the v2 API uses 8082. Never point the v2 API proxy at a v1 process.
- Keep all state transitions, turn count, saved history and ending selection server-owned. The model suggests bounded prose; it cannot change rules or facts. Model errors must not consume a turn. Do not make rehearsed content appear to be live AI.
- No model credentials, session capability IDs, or conversations in application/proxy logs. The browser stores only a capability ID for resuming; settings contain no secrets.
- Use `bash v2/scripts/build.sh` from repository root, then `bash v2/scripts/dev.sh`; run `npm run test:e2e` from `v2/web` against these local services. No tests may target the operating main domain.
- After modifying runtime code, run relevant tests, typecheck/build and browser checks. Inspect desktop and narrow mobile screenshots after visual changes. Tests must exercise actual behavior, not only render counts.
- Generated art provenance is in `art/`. Runtime music is original local synthesis; do not claim a generative model was used for audio. Do not claim a specific image model version unless the tool actually reports it.
- Keep local builds, session data, credentials and test artifacts in ignored paths. Deployment examples are templates, not proof of deployment. Report real-model and server validation separately from deterministic tests.
