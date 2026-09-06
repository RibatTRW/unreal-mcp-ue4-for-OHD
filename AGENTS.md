# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Effect migration (phases 0-4, 5a-5c)

- Phase 5a pilot (`register-core-system-namespaces.ts` [shared-actions only, no change],
  `register-core-inspection-namespaces.ts`, `register-world-lighting-namespaces.ts`): handlers return
  `Effect.try({ try: () => pythonDispatch(...), catch: (cause) => cause as ToolError })` with paramsSchema
  left as frozen Zod, so the listTools surface snapshot does not move. Never `Effect.sync`/`Effect.succeed`
  around throwing param-helper/builder thunks: `succeed` evaluates eagerly (throw escapes the Effect)
  and `sync` turns the throw into a defect that sails past dispatch's `Effect.catchAll` as FiberFailure;
  only `Effect.try` lands it in the failure channel for the identical envelope.
- Phase 5b small wave (`register-core-editor-namespaces.ts`, `register-core-tools-namespaces.ts`
  [`directDispatch` handlers wrap identically; the unknown-namespace `success:false` stays a payload,
  not a channel failure], `register-core-source-control-namespaces.ts` [provider-degraded `success:false`
  payloads stay payloads], `register-direct-tools.ts`): the three `discoverPath` callbacks run as
  `Effect.tryPromise` programs executed via `runCompatPromise`, preserving legacy rejection identity
  (discoverPath throws surface exactly as today). The `registerPythonTool` buildCommands stay pure
  sync string builders — no envelope path exists there (dispatch keeps promise semantics), so no
  channel to join.
- Phase 5c mid wave (`register-world-building-namespaces.ts` [the `worldAction` helper wraps once,
  covering every preset-construction action; `list_actors` wraps inline; shared `map_info`/`world_outliner`
  untouched], `register-world-navigation-volume-namespaces.ts`,
  `register-world-effects-splines-namespaces.ts` [block-body handlers wrap as `try: () => { ... }`,
  returns preserved inside], `register-gameplay-namespaces.ts`,
  `register-content-blueprint-namespaces.ts`): same mechanical wrap; no `success:false` degraded branches
  exist in these files (blueprint optional-fallbacks stay inline expressions inside `try`), paramsSchema stays
  frozen Zod so the surface snapshot does not move.

- Pattern catalog + error channel (+`InvalidParamsError`) + Config env readers + connection service +
  prelude service live in `server/effect/`; Zod stays at the MCP SDK call-site permanently
  (SDK throws on non-Zod).
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
- Registration framework (`server/registration-context-*.ts`, `server/namespace-action-schema-fragments.ts`,
  `server/shared-read-only-actions.ts`): dispatch runs as an Effect program with `Effect.catchAll` rendering
  the identical `{success:false, tool, action, message}` envelope; per-action `paramsSchema` accepts
  `z.ZodTypeAny | Schema.Schema.AnyNoContext` (Zod validates via `safeParseAsync`, Schemas via strict decode).
  Sharp edges: discriminate Zod-vs-Schema by duck-typing `safeParseAsync`, never `instanceof z.ZodType`
  (ESM/CJS dual zod instances in harnesses break instanceof); resolving our callbacks against the SDK's
  conditional `ToolCallback` explodes tsc (excessively-deep) — use the shallow `Sdk*Like` seams in
  `server/registration-context.ts`; Schema-validated actions contribute a permissive record to the SDK
  `inputSchema` (SDK pre-validates before our callback — strict check runs inside), so the surface
  snapshot will move when Phase 5 migrates the first action; handler params are `ActionParams`
  (`Record<string, unknown>`), param-helper throws are `MissingParamError` with `.message` aligned.
- `test:no-unreal` also runs `scripts/check-tool-surface.mjs` (listTools snapshot
  in `scripts/__snapshots__/`), `scripts/check-schema-parity.mjs` (Zod↔Schema matrix),
  `scripts/check-connection-session.mjs` (legacy fake-transport scenarios, unchanged) and
  `scripts/check-connection-session-effect.mjs` (TestClock timing: 1.5x gaps, MAX cap, stale-once) and
  `scripts/check-dispatch-envelope.mjs` (live invalid-params + handler-throw envelopes snapshotted in
  `scripts/__snapshots__/dispatch-envelope.snapshot.json`, plus dispatch-unit coverage of the Zod/Schema/
  throw/Effect-handler paths).
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
