# V2 acceptance and browser verification

This suite exercises the isolated V2 application. It must never run against the operating game at `tiantaishiju.top`.

## Run

Start the isolated V2 API on `127.0.0.1:8082` and its Vite client on `127.0.0.1:5174`, then run from `v2/web`:

```sh
npm run test:e2e
```

To validate a production build already served by `npm run preview`, use:

```sh
V2_BASE_URL=http://127.0.0.1:4174 npm run test:e2e
```

The Playwright configuration uses the installed `/usr/bin/chromium`. Set `CHROMIUM_PATH` for another local browser, or `PLAYWRIGHT_USE_BUNDLED=1` to use a separately installed Playwright Chromium. `V2_BASE_URL` may select a local loopback URL or the explicitly authorized `v2.tiantaishiju.top`. Hostnames are normalized before this allowlist check, and all other hosts are rejected, including the operating game with a trailing dot. The test runner does not start, stop, or replace application servers.

Browser traces, failure screenshots, and intentional review screenshots are written outside the checkout under `/tmp/tiantai-v2-qa/`. They may include the test conversation, never credentials.

## Acceptance scope

- Desktop: clear explanation of the ten-sentence premise and an honest distinction between live AI and authored rehearsal.
- Rehearsal: create a real server session, send all ten sentences, inspect observations and saved memories, explicitly choose an ending, and export a text keepsake with its full transcript and mode disclosure.
- Persistence: refresh an active session and resume the same conversation; refresh an ended session and recover its ending.
- Failure handling: a genuine API validation rejection does not consume a turn; a transport failure after server commit can be retried without a duplicate turn or transcript entry.
- Multiple tabs: a stale tab receives a real `409`, restores the newer conversation, preserves its unsent text, and sends only after the player deliberately tries again.
- Mobile: the landing and conversation fit a 375 × 812 viewport; the composer and its submit action remain reachable without horizontal scrolling. Complete all ten sentences and choose a different ending from the desktop run.
- Accessibility: settings can be opened and dismissed from the keyboard, focus is contained in the modal and returns to its trigger, preferences persist, and reduced motion is respected.
- Audio: the real browser audio context starts only after activation; independently adjusted music/rain levels persist across reloads, while playback never starts automatically.

Rehearsal is fixed, authored narrative. A passing rehearsal run verifies the application, persistence, and interactions; it does not verify an actual model provider or claim that arbitrary user text changes the rehearsal response. Live AI requires a separately configured provider and a real upstream request.

## Verification record

Latest live-model iteration: [2026-10-09 real-model playtests](LIVE_PLAYTEST_2026-10-09.md). Three independent Codex character instances produced 25 accepted live outputs across two complete nights and one three-turn early close. Frontend unit checks are now **32/32**; the final production preview with the normal local Go binary passed **11/11 browser scenarios in 48.0 seconds**. External-provider connectivity and remote deployment were deliberately outside this local iteration.

Latest iteration: [2026-10-08 verification](ITERATION_2026-10-08.md). The final production preview run passed **9/9 scenarios in 37.4 seconds**, with 25 frontend unit tests and 27 Go top-level tests. It adds independent durable observations, explicit silence, chosen/blank echo, response-loss recovery and observation-only revision regression coverage. The historical initial record below is retained as provenance. Public deployment and actual-provider validation remain unverified because SSH is unreachable.

Initial browser runs found two integration defects: Vite's shorthand proxy changed the request host and caused genuine session creation to fail the API's same-origin check; native dialog tab traversal could leave document focus. Both were repaired by preserving the proxy host explicitly and wrapping focus at modal boundaries. The browser suite rechecks these paths.

Visual review also led to a mobile art crop adjustment so the character stays in frame, and a 16 px mobile composer font to avoid automatic zoom in browsers that zoom smaller form controls.

Final execution: `V2_BASE_URL=http://127.0.0.1:4174 npm run test:e2e` — **7 scenarios passed in 39.3 seconds**, using actual Chromium, the freshly built production frontend through Vite preview, and the restarted real Go API on port 8082. An earlier development-server run also passed all 7 scenarios in 41.9 seconds. The API reported `aiConfigured: false`; every game session in these acceptance runs deliberately used rehearsal. The two full game journeys produced different ending choices and completed all ten turns.

The final run additionally checked that optional authored suggestions only fill the composer and never submit automatically, the journal tabs support arrow-key focus, reduced motion disables the actual CSS animation, and the complete desktop journey makes no third-party browser HTTP requests. Every review capture waited for decoded artwork and loaded fonts. The final mobile ending retained correct focus and showed no displaced skip link.

The production-target guard was also executed with `V2_BASE_URL=https://tiantaishiju.top.` and stopped during configuration loading, before any test or browser navigation.

Reviewed screenshots under `/tmp/tiantai-v2-qa/`: desktop cover, opening, conversation, memories, choices, ending, failure/retry states and settings; mobile cover, opening, conversation, journal, choices and ending. Exported `/tmp/tiantai-v2-qa/authored-night.txt` was checked for all ten submitted sentences, memories, ending text, and rehearsal disclosure.

This is desktop Chromium and a Chromium viewport at 375 × 812. It does not claim physical iOS/Safari or Android keyboard verification, screen-reader certification, or a real live-model conversation. The network-loss test intentionally drops a response only after the actual API has committed it; the validation test alters one outgoing body and receives a genuine API `400`. Neither test supplies fabricated game responses.

The main integration run also completed frozen dependency installation, Go race tests, 17 frontend unit tests, ESLint, Vue/TypeScript checking, and a production build. A separate Axe 4.10.2 scan of the built cover, settings dialog, and active game reported zero violations for its WCAG 2 A/AA and 2.1 AA rules after the interfaces settled. These are scoped automated checks, not a claim of complete accessibility compliance.
