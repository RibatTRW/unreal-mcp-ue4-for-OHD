# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Effect migration (phases 0-3)

- Pattern catalog + error channel + Config env readers + connection service + prelude service live in `server/effect/`;
  Zod stays at the MCP SDK call-site permanently (SDK throws on non-Zod).
- Session policy (`server/connection-session.ts`, `server/remote-execution.ts`) is Effect-backed
  (`server/effect/connection-service.ts`: custom 1.5x retry schedule, Clock/TestClock sleeps,
  cached acquisitions, one `Schedule.once` stale retry, Layer singleton) behind Promise-typed
  shims. Sharp edges: `tapOutput` fires on the terminal Done step (guard the final sleep/log by
  state); `Effect.runPromise` rejects with FiberFailure (unwrap via `runPromiseExit`+`Cause.squash`
  to preserve rejection identity).
- Renderer purity (`server/editor/*`, `server/effect/prelude-service.ts`): `script-renderer.ts`/`tools-base.ts`/
  `tools-direct.ts`/`tools-domain.ts` stay pure sync string->string (no Effect in signatures); missing-arg and
  manifest throws are `RenderError`/`PreludeError` with `.message` aligned onto the legacy text
  (`Data.TaggedError` defaults message to `""`, which breaks message-reading harnesses). Import-time `.py` reads
  moved behind memoized-once cells (`getEditorPreludes`/`getDomainDispatchHarness`, lazy-getter `editorPreludes`
  preserving key order) composed into the `PreludeServiceLive` Layer (Phase 6 wires it at startup); sidebar-template
  read is a scoped Effect run synchronously inside the unchanged `UEUMGSetupSidebarTab` builder.
- `test:no-unreal` also runs `scripts/check-tool-surface.mjs` (listTools snapshot
  in `scripts/__snapshots__/`), `scripts/check-schema-parity.mjs` (Zod↔Schema matrix),
  `scripts/check-connection-session.mjs` (legacy fake-transport scenarios, unchanged) and
  `scripts/check-connection-session-effect.mjs` (TestClock timing: 1.5x gaps, MAX cap, stale-once).
- Emit target is ES2022 (`tsconfig.json` + `scripts/build.mjs` override), proven on Node 18.

## Tool catalog (W3)

- Tool name/category/description live co-located with registration in `server/register-*.ts`
  (`*Entries` arrays); `server/tool-catalog-entry-data.ts` only aggregates them. Never add a
  separate mirror file. New tools appear in the catalog and README with no catalog edit.
- Validate with `npm run typecheck` and `npm run test:no-unreal` (builds, boots the real server,
  regenerates the README via postbuild).

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
