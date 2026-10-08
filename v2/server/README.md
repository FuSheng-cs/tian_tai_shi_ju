# v2 narrative API

Independent Go 1.22 standard-library service. It does not import, call, migrate, or write the v1 application. Run one service process per data directory.

```sh
cd v2/server
go test ./...
go test -race ./...
go build -o ../.run/tiantai-v2 .
go run .
```

Defaults: `127.0.0.1:8082`, persistent data at `/workspace/.cache/tiantai-v2`. Local Vite requests should proxy `/api/v2` to this address while preserving the browser's Host, or configure `V2_PUBLIC_ORIGIN` explicitly.

| Variable | Meaning |
| --- | --- |
| `V2_LISTEN_ADDR` | Listener, defaults to `127.0.0.1:8082` |
| `V2_DATA_DIR` | Dedicated v2 session directory; never point to v1 data |
| `V2_MAX_SESSIONS` | Persisted session capacity, integer 1–100000; defaults to 10000 |
| `V2_PUBLIC_ORIGIN` | Optional exact public origin, e.g. `https://v2.tiantaishiju.top`; no path |
| `V2_TRUSTED_PROXY_CIDRS` | Optional comma-separated CIDRs of immediate proxies, e.g. `127.0.0.1/32,::1/128`; defaults to no trust |
| `V2_LLM_BASE_URL` | Server-selected public HTTPS OpenAI-compatible endpoint; defaults to `https://api.openai.com/v1` |
| `V2_LLM_API_KEY` | Server-only provider credential, never sent to the browser or stored in sessions |
| `V2_LLM_MODEL` | Explicit model identifier; both this and the key are required for live sessions |

There is no `.env` loader or v1 credential fallback. Inject environment variables through the v2 service manager or the cloud environment's secret settings. Do not put secrets in source, command histories, browser configuration, or request bodies.

`aiConfigured` only reports that complete model configuration is present. It does not claim a model request has succeeded. Without configuration, live session creation returns HTTP 503; the independently labelled authored rehearsal remains available. Rehearsal contains ten authored beats with two explicit authored options per beat. Matching is exact, not keyword scoring or free-text interpretation. Legacy noncanonical lines retain the fixed script; a selected observation never overrides an exact chosen line.

## HTTP protocol

All successful session responses are the `Session` object directly, not an envelope. All failures are `{ "error": { "code", "message", "retryable" } }`. Request and response field names use camelCase.

- `GET /api/v2/health`: `{status:"ok",version:"2.0.0",aiConfigured:boolean}`.
- `POST /api/v2/sessions`: `{mode:"live"|"rehearsal"}` → HTTP 201 and session.
- `GET /api/v2/sessions/:id`: resume a durable session.
- `POST /api/v2/sessions/:id/observations`: `{requestId,expectedRevision,observation}`. Saves a new observation immediately, without dialogue or an AI call.
- `POST /api/v2/sessions/:id/turns`: `{requestId,expectedRevision,text,observation?,intent?}`. Optional `intent:"silence"` requires the exact text `让这一刻安静一会儿。`; it spends one turn as an explicit action, not spoken dialogue. Saved player messages retain the optional intent, and the model receives it separately.
- `POST /api/v2/sessions/:id/ending`: `{requestId,expectedRevision,choice:"handoff"|"separate"|"correspondence",echoMessageId?:string|null}`. The selected ID must name a committed nonsilence player line. Omitted, null or empty selects no quote.

Session fields: `id`, `revision`, `mode`, `turn`, `status`, `phase`, `messages`, `observations`, `memories`, `ending`, `createdAt`, `updatedAt`. The engine accepts exactly ten player turns. Phases are arrival at turns 0–2, listening at 3–6, threshold at 7–9, dawn at 10. Status changes from active to choosing after turn ten, then ended after a finale decision. The finale is a separate command, not an eleventh line.

`phase` describes dialogue progress, not confirmed location, consent, time of day, or support arrival. Each new free observation increments `revision` while keeping `turn` and `phase` unchanged. Clients must use the returned revision rather than deriving it from turn count. Each of the four observations can be recorded once; a new request for an already recorded item returns `observation_known` without mutation. Exact retries replay the receipt even after later progress. Observations remain available during the final choice, but ended records cannot be extended. Existing schema-1 saves, including observations recorded alongside a turn, remain readable. The previous server cannot read saves that use free observations or explicit silence; retain data backups when rolling back.

The 64-character random session ID is a bearer capability. Anyone who obtains it can read and continue that session. Keep it only in the same-origin browser storage; do not put it in public links, analytics, page URLs, or screenshots. The API sends `Referrer-Policy: no-referrer` and no-store headers, and deliberately has no request-path logging. **Disable reverse-proxy access logging for `/api/v2/sessions` routes**, including error logs that would record complete request URIs. This version does not provide user accounts or cross-device account recovery.

Input is 1–120 Unicode code points. Observation IDs are only `camera`, `receipt`, `door`, `rain`; absence is allowed. Request IDs must contain 8–96 ASCII letters, digits, underscores, or hyphens; UUIDs are valid. JSON bodies are capped at 16 KiB. Unknown fields, duplicate keys, omitted required fields and extra JSON values are rejected. Client-supplied scores, history, model settings and credentials have no protocol fields.

An exact repeated request ID and payload returns the original saved response without another model call. A reused ID with a different payload, stale revision, or in-flight turn returns HTTP 409. Keep the original request ID and body when retrying a lost response. A model failure or malformed response returns HTTP 502 without consuming a line. Reload the session on a revision conflict rather than copying client state back to the server.

## Model and persistence boundaries

One server-side turn call produces only `{reply,narration,memory:{title,text}|null}`. Reply and body-language lengths are bounded; a memory must quote a literal span of the current spoken player line or character response. Silence labels cannot become player quotes. The finale echo is taken directly from the player-selected committed message; no automatic quote is selected. Models cannot patch session state, set an ending, add turns, or alter observed items. The character prompt is grounded in `docs/v2/NARRATIVE.md`, including agency, ordinary support, and non-graphic crisis representation.

A live finale is a separate model transaction. The chosen route is an **offer**, not proof that the character accepted it. The finalizer receives the actual transcript, memories, and offered route, then generates only `{reply,narration}`; it may preserve a refusal or postpone a decision. Server-authored closing text and titles make no claims about previously undisclosed names, photos, contact exchanges, support arrivals or next-day messages. IDs, titles and exact player echoes remain server-owned. The authored rehearsal finales are separate because that mode has known fixed story beats. Failed, cancelled or malformed finale calls leave the current revision in the choosing state, and successful retries replay the stored ending without another provider call. Narrative fidelity still needs live-model evaluation: prompt instructions are not a deterministic guarantee about arbitrary natural-language claims.

The provider client preserves TLS verification, honors platform proxy settings, allows HTTPS port 443 only, rejects private/non-public destinations and DNS answers, pins validated IPs when connecting directly, rejects redirects, bounds response size and token budget, propagates cancellation, and has a 45-second timeout. A trusted environment proxy necessarily resolves the final destination itself; private proxy infrastructure is permitted, while the requested model hostname is checked before each request. Provider response bodies and internal errors are never returned to the player.

Each session and its idempotency receipts are a single JSON record. On the Linux deployment, files are 0600 inside a 0700 directory. Commits write and fsync a private temporary file, atomically rename it, then sync the directory. Windows local development also flushes the file before rename but skips unsupported directory fsync; filesystem access follows Windows ACLs rather than POSIX mode bits. A failed response after a successful commit can be retried using the receipt. No API keys are in records. Per-session mutexes serialize mutations; reads see an old or new complete snapshot. There is no multiprocess lock or multi-replica transaction support: use a transactional database before scaling beyond one process.

Capacity defaults to 10,000 persisted sessions and can be expanded with `V2_MAX_SESSIONS` up to 100,000. At capacity, only new sessions are rejected with an explicit maintenance/expansion message; existing stories remain readable and playable. There is no automatic expiry, deletion, or eviction. Records have a 4 MiB safety ceiling, so the conservative envelope for 10,000 records is approximately 40 GiB, plus backups and temporary writes; actual ten-turn records are much smaller. Measure aggregate record sizes without publishing capability filenames before selecting storage and capacity.

To expand safely, provision sufficient space and restart only the v2 service with a larger `V2_MAX_SESSIONS`. For backup or archival, stop this service gracefully, copy the entire private data directory to access-controlled storage while preserving exact filenames, contents and permissions, and verify that a restored copy loads before resuming. Keep the active originals unless an explicit retention/deletion decision has been made. Moving an active record out of the data directory breaks that browser's resume capability; copying a backup does not increase active capacity. Preserve original IDs when restoring. Retention, authenticated ownership, operator tooling and deletion requests require a separate operational policy.

The API permits up to 12 creations and 180 total requests per client address per minute, and at most eight concurrent model calls. Exceeding the creation allowance does not block existing session reads, turns, endings, or health within the total-request allowance. Forwarded identity is disabled by default. If `V2_TRUSTED_PROXY_CIDRS` is explicitly configured and the actual immediate peer falls within one of those networks, a single valid `X-Real-IP` becomes the rate identity. The proxy must **overwrite** that header with the actual client address; it must not preserve incoming values. Malformed, multiple, missing or non-IP values fall back to the actual peer. `X-Forwarded-For` is never used, and direct clients cannot obtain new budgets by spoofing headers. Networks covering all addresses are rejected. Without this opt-in, a reverse proxy shares an aggregate budget.

## Verification

Tests cover retry receipts across store reloads, payload and revision conflicts, concurrent submissions, unconsumed failed/cancelled model turns and finales, live-refusal preservation, strict HTTP bodies, request and configurable storage caps, trusted-proxy spoof resistance, uninterrupted existing sessions after creation-rate exhaustion, three complete ten-turn rehearsal paths, exact player echo, every phase transition, memory grounding, private-address rejection, provider credentials staying out of prompts, and sanitized errors. Fake provider tests validate protocol behavior; they are not evidence of live model quality or a successful external inference.
