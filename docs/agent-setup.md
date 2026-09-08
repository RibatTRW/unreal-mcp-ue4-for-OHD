# Agent setup guide: download, install, configure, verify

Audience: an autonomous agent setting up this MCP server without a human
driving. Follow the steps in order; each step ends with a check that tells
you the step is done before you move on.

For the human-oriented narrative and editor screenshots, see the README
sections this guide points at. When a command below names an npm script, the
authoritative definition lives in `package.json` `scripts`.

## Step 0 — Confirm prerequisites

Check each item resolves to a working binary:

```bash
node --version   # expect v18 or newer (package.json engines: node >= 18)
npm --version    # expect npm 10+ (packageManager pins npm@10.8.1)
```

The TypeScript check lives in Step 2 (after `npm install`): on a fresh clone
`npx tsc` resolves to an unrelated registry placeholder, not the workspace
TypeScript 7 toolchain.

Toolchain notes: `tsconfig.json` owns the emit settings (`target es2022`,
`module`/`moduleResolution` `nodenext` still emitting CJS, `rootDir server/`,
`types: ["node"]`). Do not change them per-project; the build shells out to
`tsc -p tsconfig.json --noEmitOnError`.

Unreal Editor state (needed from Step 6 on; Steps 1–5 run without it):

- OHDCore Mod Kit project open (`HDGame/HarshDoorstop/HarshDoorstop.uproject`,
  launched via `LaunchEditor.bat`), with `Python Editor Script Plugin` enabled
  and `Edit -> Project Settings -> Plugins -> Python -> Enable Remote
  Execution` on. Full editor walkthrough: README `Editor remote execution`.

Done when: `node --version` reports 18+.

## Step 1 — Get the source

```bash
git clone https://github.com/RibatTRW/unreal-mcp-ue4-for-OHD.git
cd unreal-mcp-ue4-for-OHD
```

Done when: `git rev-parse --show-toplevel` prints the checkout and
`package.json` contains `"name": "unreal-mcp-ue4"`.

## Step 2 — Install dependencies

```bash
npm install
```

(`npm install` may reformat `package.json` array whitespace; leave that churn
out of any commit. CI installs with `npm ci`.)

Done when: `node_modules/` exists, the command exits 0, and `npx tsc --version`
reports 7.x (TypeScript 7 native toolchain; runs via the workspace tsc installed
by this step, no compiler API).

## Step 3 — Build

```bash
npm run build
```

The build regenerates `server/version.ts` and `server.json` from
`package.json` (the version's single source of truth), compiles with the
workspace `tsc`, emits the server bundle, then `postbuild` makes the binary
executable and regenerates the README tool catalog.

Done when: `dist/bin.js`, `dist/index.js`, and `dist/editor/tools.js` all exist.

## Step 4 — Configure the connection

Configuration has two parts: environment variables for the network session,
and `server.json` for registry metadata.

### 4a — Environment variables

The readers are the source of truth: `server/effect/config.ts` (the legacy
`server/remote-execution.ts` module-singleton shims are gone; dispatch runs
through the injected `ConnectionSessionService`). Defaults ship in code, so a
stock single-machine setup needs no variables at all; set overrides only when
the network or the editor session needs them:

| Variable | Default |
| --- | --- |
| `UNREAL_MCP_BIND_ADDRESS` / `UNREAL_MCP_COMMAND_ADDRESS` | first non-internal IPv4 |
| `UNREAL_MCP_COMMAND_PORT` | `6776` |
| `UNREAL_MCP_MULTICAST_ADDRESS` / `UNREAL_MCP_MULTICAST_PORT` / `UNREAL_MCP_MULTICAST_TTL` | `239.0.0.1` / `6766` / `1` |
| `UNREAL_MCP_RETRY_COUNT` / `UNREAL_MCP_RETRY_DELAY_MS` | built-in retry policy |

Done when: with defaults, nothing is set and the server logs its bind line on
first command; with overrides, each intended variable is exported in the
server process environment.

### 4b — `server.json`

`server.json` at the repo root carries the registry name, version, and the
npm package transport (`stdio`). The build (`scripts/sync-version.mjs`) and
the repo's version scripts (`set:version`, `sync:version`) regenerate it from
`package.json`; hand-editing the version in one file alone leaves the two
diverged.

Done when: `server.json` `version` equals `package.json` `version`.

## Step 5 — Wire the MCP client

Register the built server in the client so the client launches it over stdio.
One install, then one line per client (all clients call the same 34 tools
over stdio: 3 session-info + 3 direct actor CRUD primitives + 28 `manage_*`
namespaces). The same table lives in README `Setup`; copy from there if this
drifts:

| Client | Global install (`npm install -g unreal-mcp-ue4`) | Local checkout (`<checkout>/dist/bin.js` from Step 3) |
|--------|--------------------------------------------------|--------------------------------------------------------|
| Claude | `claude mcp add --scope user unreal-mcp-ue4 -- unreal-mcp-ue4` | `claude mcp add --scope user unreal-mcp-ue4 -- node /absolute/path/to/unreal-mcp-ue4-for-OHD/dist/bin.js` |
| Codex | `codex mcp add unreal-ue4 -- unreal-mcp-ue4` | `codex mcp add unreal-ue4 -- node /absolute/path/to/unreal-mcp-ue4-for-OHD/dist/bin.js` |
| Copilot | `.vscode/mcp.json` → `{ "servers": { "unreal-ue4": { "command": "unreal-mcp-ue4", "args": [] } } }`, then start the server from the MCP config UI | same file with `"command": "node", "args": ["/absolute/path/to/unreal-mcp-ue4-for-OHD/dist/bin.js"]` |

Done when: the client lists the server (for example `unreal-ue4` appears in
the tools picker) and a session starts without a launch error.

## Step 6 — Verify

Run these in order; each has its own done-condition.

### 6a — Version CLI (no editor needed)

```bash
node dist/bin.js --version
```

Done when: the printed version equals `package.json` `version` (also mirrored
in `server/version.ts`).

### 6b — No-Unreal smoke test (no editor needed)

```bash
npm run test:no-unreal
```

This builds the server, boots it over stdio, and runs every offline check in
order: MCP startup smoke, payload codec, batch prototype, prelude cache,
tool surface snapshot, dispatch envelope, bounded reads, schema parity, and
the connection session policy (compat boundary plus Effect/TestClock timing)
against fake transports.

Done when: every check prints `[PASS]` / `pass` and the command exits 0.

### 6c — Editor smoke test (editor from Step 0 required)

```bash
npm run test:e2e
```

The runner launches its own server process and drives reads plus actor
create/update/delete against the open editor. Asset coverage adds
`npm run test:e2e -- --with-assets`. Full option list: README `Testing`.

Done when: every step prints `[PASS]` and temporary actors are created then
removed in the editor.

### 6d — First live reads (editor required)

From the wired client, run the canonical read entry points from README
`Usage`:

- `manage_editor` with `action: "project_info"`
- `manage_editor` with `action: "map_info"`
- `manage_level` with `action: "world_outliner"`

Done when: each call returns `success: true` with project/map/actor data from
the open editor.

## Tool behavior agents must know

- **Paged reads with truncation envelope.** List/search actions
  (`world_outliner`, `manage_level` `list_actors`, `manage_actor`
  `list`/`find`) accept `limit` (integer, 0–2000, default 200), `offset`
  (integer, >= 0), and `fields` (string array, `world_outliner` only). Large
  results come back paged with a truncation envelope (`total_count`,
  `returned_count`, `truncated`) — page with `offset` when `truncated` is
  true. Out-of-range values (negative, non-integer, over max) are rejected;
  read the error message and retry with valid values.
- **Compacted schemas + `describe_namespace`.** Seven heavy tools
  (`manage_sequence`, `manage_level_structure`, `manage_asset`,
  `manage_blueprint`, `manage_volumes`, `manage_actor`, `manage_widget`)
  expose compacted `listTools` schemas to save context; their per-action
  parameter detail lives behind `manage_tools` `describe_namespace` (pass one
  of `tool_name`, `namespace_name`, or `name`). Discover namespaces with
  `manage_tools` `list_namespaces` first, then describe the one you need.
- **Prelude cache is invisible.** The static Python prelude is cached in the
  editor session behind the render seam (cacheable renders are ~1–5% of full
  bytes, misses resend once). Nothing to configure or call out; if a payload
  ever reports a cache miss, the server already resent the full payload.
- **Connect health-hint is internals-only.** A short-lived
  healthy-connection hint skips redundant reconnects; command success arms it,
  failure disarms it. No configuration, no agent-visible signal.
- **Python 2.7 payloads only.** The kit embeds Python 2.7.14: no f-strings,
  single-argument `print()`, no `pathlib`-era idioms. This applies to every
  `manage_editor` `run_python` snippet you send. After touching
  `server/editor/scripts`, run the dialect gate: `npm run check:py27`.

## CI expectations (per PR, no live editor)

`.github/workflows/ci.yml` runs on push and pull requests to `main` (four
jobs, all offline): `typecheck`, `check:py27`, `test:no-unreal`, and `biome`.
There is no live editor in CI — `test:e2e` never runs there, so run it
locally against the open editor before claiming editor coverage. Before
pushing, run `npm run typecheck` + `npm run check:py27` (plus
`npm run test:no-unreal` when possible).

## Server layout map (Effect migration current)

- `server/bin.ts` — process entry: `--version` handling, signal wiring,
  launching `MainLive` as a daemon fiber.
- `server/index.ts` — composition root exporting `MainLive`; owns the stdio
  transport connect.
- `server/effect/` — Effect services: connection session, `Config` env
  readers, prelude loading, error channel.
- `server/editor/` — pure payload renderers plus the Python 2.7 scripts sent
  to the editor; after touching `server/editor/scripts`, run the dialect gate
  (`npm run check:py27`).
- `server/register-*.ts` — tool and namespace registration; tool
  name/category/description live co-located there.
- `server.json`, `package.json` scripts — registry metadata and the runnable
  command surface used throughout this guide.
