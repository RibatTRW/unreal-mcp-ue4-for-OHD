# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Effect migration (phases 0-7)

- Handler consolidation (post Phase 5a–5d): the 134 per-handler `Effect.try` wrappers
  (plus their `ToolError` imports and Phase-5x comments) are deleted. Namespace handlers are
  plain sync functions through one helper in `registration-context-dispatch.ts` —
  `pythonAction((params) => command-string)` — with the `worldAction`/`assetMutationHandler`
  group helpers folded into it, block bodies returning the command string, and `directDispatch`
  handlers returning the payload directly. Lifting into the failure channel happens once,
  centrally, in `invokeActionHandler` (`Effect.tryPromise` flattens sync param-helper/builder
  throws into rejections for the identical envelope) — never reintroduce per-handler
  `Effect.try`/`Effect.sync` wrappers. All handler params are `ActionParams`
  (`Record<string, unknown>`); builder `properties` bags are `Record<string, unknown>`.

- Pattern catalog + error channel (+`InvalidParamsError`) + connection service +
  prelude service live in `server/effect/` (`server/effect/config.ts` deleted as dead —
  zero callers; re-derive the trivial `Config` forms from `remote-execution.ts` if one appears);
  Zod stays at the MCP SDK call-site permanently (SDK throws on non-Zod).
- Phase 6 composition root + entry (`server/index.ts` exports `MainLive`; `server/bin.ts` forkDaemons
  `Layer.launch(MainLive)` and joins it, interrupting the fiber on signals/exit so scope finalizers
  run the connection shutdown — interrupt idempotency replaces the shutdownInProgress guard,
  and main's catch ignores the join failure only when the explicit `shutdownRequested` flag
  was set (fiber-cleared alone is ambiguous: the fiber is also undefined when main fails
  before assignment). index owns the
  `serveStdio` stdio serve; `--version`, the ECONNRESET guard, and the four `process.once`
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
  read is a memoized-once module cell (negative cached too) inside the unchanged `UEUMGSetupSidebarTab` builder.
- Registration framework (`server/registration-context-*.ts`, `server/namespace-action-schema-fragments.ts`
  [Zod-only — dead `stringListSchema` and dead Schema re-exports deleted; migrated registrars import
  `atLeastOneValue`/`valueGroups` from `server/effect/schema-patterns.ts` directly],
  `server/shared-read-only-actions.ts`): dispatch runs as an Effect program with `Effect.catchAll` rendering
  the identical `{success:false, tool, action, message}` envelope; per-action `paramsSchema` accepts
  `z.ZodTypeAny | Schema.Schema.AnyNoContext` (Zod validates via `safeParseAsync`, Schemas via strict decode).
  Sharp edges: discriminate Zod-vs-Schema by duck-typing `safeParseAsync`, never `instanceof z.ZodType`
  (ESM/CJS dual zod instances in harnesses break instanceof); resolving our callbacks against the SDK's
  conditional `ToolCallback` explodes tsc (excessively-deep) — use the shallow `Sdk*Like` seams in
  `server/registration-context.ts`; Schema-validated actions contribute a permissive record to the SDK
  `inputSchema` (SDK pre-validates before our callback — strict check runs inside), so the surface
  snapshot moves per migrated namespace (first move: `manage_inspection`, whose 5 paramsSchemas are
  now `Schema.Struct` + `atLeastOneValue` from `server/effect/schema-patterns.ts` with verbatim messages);
  handler params are `ActionParams`
  (`Record<string, unknown>`), param-helper throws are `MissingParamError` with `.message` aligned.
  Sharp edge: constraint violations (negative/non-integer/over-max) on all-optional strict-union
  members match NO member, so the SDK gate rejects them with -32602 before dispatch — the
  `Invalid params` envelope only renders when the payload matches another member first.
- `test:no-unreal` also runs `scripts/check-tool-surface.mjs` (listTools snapshot
  in `scripts/__snapshots__/`), `scripts/check-schema-parity.mjs` (Zod↔Schema matrix),
  `scripts/check-connection-session.mjs` (fake-transport scenarios over the `ConnectionSession`
  compat boundary, plus the composition-surface check: scoped layer present, shims absent) and
  `scripts/check-connection-session-effect.mjs` (TestClock timing: 1.5x gaps, MAX cap, stale-once,
  health-hint arm/expire/disarm) and
  `scripts/check-dispatch-envelope.mjs` (live invalid-params + handler-throw envelopes snapshotted in
  `scripts/__snapshots__/dispatch-envelope.snapshot.json`, plus dispatch-unit coverage of the Zod/Schema/
  throw/Effect-handler paths) and `scripts/check-bounded-reads.mjs` (S3 paged reads: invalid
  limit/offset/fields envelopes + valid-path arg forwarding via dispatch-unit over the real
  registrations, truncation snapshot on a stubbed large payload in
  `scripts/__snapshots__/bounded-reads.snapshot.json` via `scripts/stub-bounded-reads.py`,
  synthetic N=2000 byte proxy).
- Emit target is ES2022 (`tsconfig.json` owns it; `scripts/build.mjs` passes no overrides). Engines are `node >= 20` (SDK v2 floor; was >=18).
- Phase 7 dependency cleanup (pre-v2 note, kept for history): zod was KEPT with no `package.json`
  change because SDK v1 accepted only Zod at the call-site. That constraint died with the
  MCP 2026-07-28 upgrade below — do not re-apply the v1 evidence here.
- MCP 2026-07-28 (SDK v2, `fm/ohd-mcp-upgrade-1`): protocol revision 2026-07-28 is served
  via the v2 packages — `@modelcontextprotocol/server@2.0.0` (runtime) +
  `@modelcontextprotocol/client@2.0.0` (dev, test scripts) replace the monolithic
  `@modelcontextprotocol/sdk`; `zod@^4.2.0` replaces v3 (v2 rejects v3 schemas at
  `tools/list` time, quietly). `server/index.ts` serves both eras through
  `serveStdio(() => server)` (default `legacy: 'serve'`; a hand-wired `connect()` would
  serve 2025-only) with an `acquireRelease` stdio-handle close + `Effect.never` park so
  scope finalizers still run on signal interrupt. The removed variadic `server.tool()` /
  `server.resource()` became `registerTool` (raw shapes wrapped with `z.object()` explicitly)
  / `registerResource` with a metadata config. `server.json` `$schema` stays
  `.../2025-12-11/server.schema.json` — newest published (no 2026-07-28 schema exists).
  Zod v4 sharp edges: shape-spreading helpers must take a generic `<S extends z.ZodRawShape>`
  param (a widened `ZodRawShape` spread drops extended keys from the inferred output, so
  chained `superRefine` callbacks lose them); `z.record` needs both args
  (`z.record(z.string(), z.any())`); `z.ZodArray` no longer takes two generics (annotate
  `z.ZodTypeAny`); `superRefine` still returns `this`. The listTools snapshot was
  re-baselined to the v4 2020-12 dialect (`$schema` stamp, `prefixItems` tuples,
  `additionalProperties: {}` records) — descriptions/requiredness unchanged. Postbuild
  README/catalog regen verified diff-free; the surface/parity/envelope/session harnesses
  wired into
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
  One flag (`{ cacheable?: boolean; registerCache?: boolean }`) on `renderScript`/`renderDomainScript`
  (`server/editor/tools-base.ts`); the SHIP-S1 pilot wires one builder end-to-end: `UEActorToolCommands`
  (`server/editor/tools-domain.ts`) returns the `(cached, full)` pair behind the
  `UNREAL_MCP_PRELUDE_CACHE=1` kill-switch (default off — both halves share one reference to
  today's byte-identical render), all 22 `UEActorTool` call sites use dispatch's
  `cacheablePythonAction` pair-helper, and the python-send site resends `fullCommand` exactly once
  on a miss (`runWithPreludeCacheFallback`). The python result carries `fullCommand?` for this.
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
