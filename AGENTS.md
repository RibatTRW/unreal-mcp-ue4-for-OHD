# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Effect migration (phases 0-7)

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
- Phase 5d large wave (`register-content-media-namespaces.ts` [`add_key`'s custom-issue `superRefine`
  ("Provide value.") untouched in frozen paramsSchema], `register-content-asset-namespaces.ts` [the nested
  `requireAtLeastOneValue` composition on `create_data_table` untouched — both custom messages preserved
  verbatim], `register-content-widget-namespaces.ts`, `register-core-asset-actor-namespaces.ts` [the
  `assetMutationHandler` helper wraps once, covering duplicate/rename/move; zero-arg `list` wraps inline;
  shared `validate_assets` untouched]): same mechanical wrap; no `success:false` degraded branches exist in
  these files, paramsSchema stays frozen Zod so the surface snapshot does not move.

- Pattern catalog + error channel (+`InvalidParamsError`) + Config env readers + connection service +
  prelude service live in `server/effect/`; Zod stays at the MCP SDK call-site permanently
  (SDK throws on non-Zod).
- Phase 6 composition root + entry (`server/index.ts` exports `MainLive`; `server/bin.ts` forkDaemons
  `Layer.launch(MainLive)` and joins it, interrupting the fiber on signals/exit so scope finalizers
  run the connection shutdown — interrupt idempotency replaces the shutdownInProgress guard,
  and main's catch ignores the join failure only when the explicit `shutdownRequested` flag
  was set (fiber-cleared alone is ambiguous: the fiber is also undefined when main fails
  before assignment). index owns the
  `StdioServerTransport`+connect; `--version`, the ECONNRESET guard, and the four `process.once`
  handlers are unchanged. Removed the remote-execution.ts Promise singleton shims
  (`tryRunCommand`/`discoverPath`/`shutdownRemoteExecution`); dispatch + direct tools run the
  injected `ConnectionSessionService` Effects directly (`withCompatErrors` keeps envelopes
  byte-identical, `runCompatPromise` stays as the SDK-boundary runner).
  Sharp edges: `Effect.fork` children die with the `runPromise` scope (structured concurrency) —
  forkDaemon is required for the server fiber; curried `Layer.provide(that)` mis-resolves
  overloads here, use data-first `Layer.provide(self, that)`; `Layer.launch` builds in-scope then
  runs `never`, so signals must interrupt the fiber (scope close runs finalizers).
- Session policy (`server/connection-session.ts`, `server/remote-execution.ts`) is Effect-backed
  (`server/effect/connection-service.ts`: custom 1.5x retry schedule, Clock/TestClock sleeps,
  cached acquisitions, one `Schedule.once` stale retry, short-lived healthy-connection hint
  (5s TTL, internals-only: command success arms, failure disarms, failed setup never arms),
  scoped Layer) behind the Promise-typed
  `ConnectionSession` boundary (the module-singleton shims went away in Phase 6). Sharp edges:
  `tapOutput` fires on the terminal Done step (guard the final sleep/log by
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
  `scripts/check-connection-session.mjs` (fake-transport scenarios over the `ConnectionSession`
  compat boundary, plus the composition-surface check: scoped layer present, shims absent) and
  `scripts/check-connection-session-effect.mjs` (TestClock timing: 1.5x gaps, MAX cap, stale-once,
  health-hint arm/expire/disarm) and
  `scripts/check-dispatch-envelope.mjs` (live invalid-params + handler-throw envelopes snapshotted in
  `scripts/__snapshots__/dispatch-envelope.snapshot.json`, plus dispatch-unit coverage of the Zod/Schema/
  throw/Effect-handler paths).
- Emit target is ES2022 (`tsconfig.json` owns it; `scripts/build.mjs` passes no overrides), proven on Node 18.
- Phase 7 dependency cleanup: zod KEPT, no `package.json` change. Evidence: the SDK accepts
  only Zod at the call-site (`getZodSchemaObject` throws otherwise — installed
  `@modelcontextprotocol/sdk/dist/esm/server/mcp.js`); dispatch itself builds
  `z.literal`/`z.enum`/`z.object`/`z.union` registered inputSchemas
  (`server/registration-context-dispatch.ts`); every registrar/fragments file holds frozen Zod
  paramsSchema and no file imports zod without using it. Do not attempt removal without an
  SDK upgrade (separate change with its own surface-snapshot run). Postbuild README/catalog
  regen verified diff-free; the surface/parity/envelope/session harnesses wired into
  `test:no-unreal` stay as permanent regression tests.

## TypeScript 7 toolchain

- `typescript@^7` (native Go port, no compiler API): `scripts/build.mjs` shells out to the
  workspace `tsc -p tsconfig.json --noEmitOnError` instead of `ts.createProgram`; do not
  `import ... from "typescript"` outside its `version`-only entry (a new API lands in 7.1,
  only `./unstable/*` previews exist). `tsconfig.json` pins the TS7-required settings:
  `module`/`moduleResolution` `nodenext` (still emits CJS — package.json has no `"type"`
  field), `types: ["node"]`, `rootDir: "server"`. Kept as-is: `target es2022`,
  `esModuleInterop`/`allowSyntheticDefaultImports` true, `strict`, `useDefineForClassFields:false`.
- `npm install` rewrites `package.json` array formatting (multiline files/keywords) — revert
  that churn so the dep diff stays one line. The lockfile carries one `@typescript/native-*`
  entry per platform (expected for the native-binary distribution model).

## Editor-side prelude cache (SHIP-S1)

- Payload shapes (`server/editor/script-renderer.ts`, protocol in `server/editor/prelude-cache.ts`,
  editor snippets `server/editor/scripts/ue_prelude_cache_{shim,register}.py`): default
  `PRELUDE + TAIL` (byte-identical to pre-S1), opt-in `cacheable` → `SHIM(hash) + TAIL`
  (1–5% of full bytes on the baseline set), `registerCache` → full + registration trailer.
  One flag (`{ cacheable?: boolean }`) on `renderScript`/`renderDomainScript`
  (`server/editor/tools-base.ts`); domain/direct builders and dispatch are untouched, so the
  cacheable path is exercised only through the renderers until a later ship flips callers.
- Editor protocol notes: store lives in `sys.modules["rrmcp_preludes"]` keyed by sha1 of the
  exact static prefix (content addressing = staleness guard) plus a `__rrmcp_version__`
  protocol guard; warm path merges the snapshot via `globals().update` then the literal
  tail runs unmodified in the same payload (no `exec` involved);
  miss prints exactly one `rrmcp:cache-miss:<hash>` line and never runs the tail; TS resends
  the registering full payload exactly once (`runWithPreludeCacheFallback`, generic over
  the Effect failure channel — composes with `ConnectionSessionService.runCommand`
  without touching the service). Snippet placeholders are plain `__RRMCP_PRELUDE_HASH__`
  tokens (never `${...}`, which would trip the codec/`${` checks); the `.py` snippets are
  covered by the stock `check-py27` gate.
- Permanent harness: `scripts/check-prelude-cache.mjs` (wired into `test:no-unreal`)
  asserts cacheable ≤10% of full bytes over actor-list/asset-search/sequence-create/pie_start,
  tail byte-identity vs the default render, and fake-transport scenarios (full first,
  tail-only second, exactly one resend on simulated miss) through the real service.

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
