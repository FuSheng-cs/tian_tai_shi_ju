# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`天台十句` is an AI-native narrative game: the player has ten free-text turns to talk to “艾” on a rooftop. The current architecture is a lightweight split between:

- `legacy_vue/`: the active Vue 3 + Vite + TypeScript frontend.
- `backend/`: a Go 1.22 + Gin backend that protects prompts and forwards OpenAI-compatible Chat Completions requests.
- `docs/`: product, story, prompt, and engineering documentation.
- `next_temp/`: an unused Next.js scaffold/template remnant; do not treat it as the active frontend unless the user explicitly asks.

The frontend handles interaction, rendering, Pinia state, local saves, achievements, and settings. The backend handles environment configuration, `/api/*` routes, server-side fallback LLM credentials, provider defaults, and the system prompts for main chat, hints, and after-story chat.

## Common commands

### Backend

```bash
cd backend
cp .env.example .env   # first-time local setup; fill optional LLM fallback config
go mod tidy
go run main.go         # serves http://localhost:8080 by default
go build ./...
go test ./...
```

Backend environment variables are documented in `backend/.env.example`. `LLM_API_KEY` and related `LLM_*` values are optional server-side fallback config; if absent, the frontend can still send player-provided credentials.

### Frontend

```bash
cd legacy_vue
npm install
npm run dev            # serves http://localhost:5173 by default
npm run build          # vue-tsc -b && vite build
npm test -- --run      # run Vitest once
npm test -- gameStore --run
npm run lint
npm run preview
npm run assets:generate
```

For frontend development against the local backend, set `legacy_vue/.env.local`:

```env
VITE_BACKEND_URL=http://localhost:8080
```

In production, `VITE_BACKEND_URL` is expected to be empty and `/api/*` is assumed to be same-origin proxied, typically by Nginx.

## High-level architecture

### Backend request flow

`backend/main.go` loads config, creates a Gin router, applies permissive development CORS, and mounts:

- `GET /api/health`
- `POST /api/chat`
- `POST /api/hint`
- `POST /api/chat-after`

`backend/handlers/game.go` parses frontend request bodies, builds an `llm.ClientConfig`, and prefers player-provided API keys over server fallback config from `backend/config/config.go`. If no usable key exists, handlers return mock/simulated replies so the game can still run in limited mode.

`backend/llm/service.go` contains provider defaults, OpenAI-compatible request/response structs, endpoint normalization, HTTP calls, and all core system prompts. The frontend depends on returned control tags such as `[好感度+5]` and `[结局:死亡|消失|相识]`, so prompt/tag changes must be coordinated with frontend parsing.

### Frontend game flow

`legacy_vue/src/router/index.ts` defines routes for start, game, settings, achievements, and after-story chat.

`legacy_vue/src/store/gameStore.ts` is the main game state machine. It tracks remaining rounds, hints, affection, messages, waiting state, and ending state. `sendMessage()` appends the player message, decrements rounds, calls `LLMService.chat()`, parses `[好感度+5]` to add affection and refund a turn, and parses ending tags into internal ending IDs. `requestHint()` consumes hints and calls `/api/hint`.

`legacy_vue/src/modules/LLMService.ts` is only a frontend proxy layer. It reads local LLM settings from `localStorage`, applies `VITE_BACKEND_URL`, and posts to the Go backend. Do not put system prompts or direct provider calls back into this frontend module.

`legacy_vue/src/modules/SaveSystem.ts` stores up to three local save slots in `localStorage` using base64-encoded JSON plus CRC32 checksum validation. `settingsStore.ts` holds display/audio settings and applies theme CSS variables, but LLM provider settings are stored separately by `LLMService.ts`.

### UI and content structure

The active UI lives in `legacy_vue/src/views/` and `legacy_vue/src/components/`. The main product loop is: `StartView` -> `GameView` -> an ending, optionally unlocking `ChatAfterStoryView` for the “相识” path. `AchievementsView` and save/settings-related UI support replayability and local configuration.

Reference docs:

- `docs/engineering/technical_overview.md`: broader architecture, flow, and known technical debt.
- `docs/engineering/prompts_and_settings.md`: prompt intent and game mechanics.
- `docs/product/storyline_and_lore.md`: character/world/ending context.

## Important implementation notes

- Treat `legacy_vue/` as the current frontend source of truth; ignore built artifacts under `legacy_vue/dist/` and dependency folders unless specifically asked.
- Keep the backend as the prompt boundary. The frontend should only send conversation/game state and local model config to `/api/*`.
- The LLM API is OpenAI Chat Completions compatible. Existing providers include `openai`, `qwen`, and `doubao`; custom URLs are normalized to include `/v1/chat/completions` when needed.
- Frontend tests currently use Vitest with `jsdom`, configured in `legacy_vue/vite.config.ts`.
- ESLint is configured by `legacy_vue/.eslintrc.cjs` and rejects explicit `any`; existing code still contains some `any`, so lint may reveal pre-existing issues.
