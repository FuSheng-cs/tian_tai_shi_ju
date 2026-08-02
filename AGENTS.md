# Repository Guidelines

## Project Structure & Module Organization

- `backend/` contains the Go 1.22/Gin API. Routes live in `handlers/`, LLM prompts and rule evaluation in `llm/`, and environment loading in `config/`.
- `legacy_vue/` is the active Vue 3 client. Put pages in `src/views/`, reusable UI in `src/components/`, state in `src/store/`, domain contracts in `src/domain/`, and integrations in `src/modules/`.
- Frontend tests are in `legacy_vue/tests/*.test.ts`; Go tests stay beside their package as `*_test.go`.
- Assets belong in `legacy_vue/public/assets/`; documentation belongs in `docs/`.

## Build, Test, and Development Commands

Run frontend commands from `legacy_vue/`:

- `npm ci` installs the locked dependency set.
- `npm run dev` starts Vite at `http://localhost:5173`.
- `npm test -- --run` runs the Vitest suite once.
- `npm run lint` checks Vue and TypeScript with ESLint.
- `npm run build` type-checks and creates the production bundle.
- `npm run assets:generate` regenerates derived image assets.

Run backend commands from `backend/`:

- `go run .` starts the API on port 8080.
- `go test ./...` runs all Go tests.
- `go build ./...` verifies all packages compile.

## Coding Style & Naming Conventions

Vue and TypeScript use two-space indentation, single quotes, no semicolons, a 100-column target, and no explicit `any`. Use PascalCase for Vue components (`GameView.vue`), camelCase for functions and state, and `use<Name>Store` for Pinia stores. Format Go with `gofmt` and standard Go naming.

## Testing Guidelines

Use Vitest with jsdom and Vue Test Utils. Name frontend tests `<Subject>.test.ts` and Go tests `Test<Behavior>`. Add tests for state transitions, ending thresholds, prompt parsing, API contracts, and persistence changes. There is no fixed coverage percentage; changed behavior must have focused regression coverage.

## Commit & Pull Request Guidelines

History favors short imperative subjects such as `Add after-story save slots` or `Fix immersive dialogue state flow`. Keep each commit scoped; Conventional Commit prefixes are optional. Pull requests should explain behavior changes, list verification commands, link relevant issues, and include screenshots or recordings for UI/CG changes. Call out Prompt, contract, save-format, or environment changes explicitly.

## Security & Narrative Consistency

Copy `.env.example` files locally and never commit API keys or `.env.local`. Keep backend and frontend game contracts synchronized. Prompt or story changes must also be checked against `docs/product/game_setting_bible.md` and the Prompt documentation; do not introduce conflicting character facts, ending rules, or unsafe romanticization of the crisis scenario.
