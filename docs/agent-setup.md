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
node --version   # expect v18 or newer
npm --version
```

Unreal Editor state (needed from Step 6 on; Steps 1–5 run without it):

- OHDCore Mod Kit project open (`HDGame/HarshDoorstop/HarshDoorstop.uproject`,
  launched via `LaunchEditor.bat`), with `Python Editor Script Plugin` enabled
  and `Edit -> Project Settings -> Plugins -> Python -> Enable Remote
  Execution` on. Full editor walkthrough: README `MCP Client Setup` step 3.

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

Done when: `node_modules/` exists and the command exits 0.

## Step 3 — Build

```bash
npm run build
```

The build script is defined in `package.json`; it emits the server bundle and
regenerates the README tool catalog via `postbuild`.

Done when: `dist/bin.js` and `dist/index.js` both exist.

## Step 4 — Configure the connection

Configuration has two parts: environment variables for the network session,
and `server.json` for registry metadata.

### 4a — Environment variables

The readers are the source of truth: `server/remote-execution.ts`
(`readStringEnv`/`readIntegerEnv`) with the Effect mirror in
`server/effect/config.ts`. Defaults ship in code, so a stock single-machine
setup needs no variables at all; set overrides only when the network or the
editor session needs them:

| Variable | Meaning |
| --- | --- |
| `UNREAL_MCP_BIND_ADDRESS` | Local bind address override |
| `UNREAL_MCP_MULTICAST_ADDRESS` | Editor discovery multicast group |
| `UNREAL_MCP_MULTICAST_PORT` | Editor discovery multicast port |
| `UNREAL_MCP_MULTICAST_TTL` | Multicast TTL |
| `UNREAL_MCP_COMMAND_ADDRESS` | Address the editor calls back on |
| `UNREAL_MCP_COMMAND_PORT` | Command callback port |
| `UNREAL_MCP_RETRY_COUNT` | Command retry count |
| `UNREAL_MCP_RETRY_DELAY_MS` | Base retry delay in ms |

Done when: with defaults, nothing is set and the server logs its bind line on
first command; with overrides, each intended variable is exported in the
server process environment.

### 4b — `server.json`

`server.json` at the repo root carries the registry name, version, and the
npm package transport (`stdio`). Keep it in sync with `package.json` via the
repo's version scripts (`set:version`, `sync:version`); hand-editing the
version in one file alone leaves the two diverged.

Done when: `server.json` `version` equals `package.json` `version`.

## Step 5 — Wire the MCP client

Register the built server in the client so the client launches it over stdio.
Copy the per-client command from README `MCP Client Setup` step 2 (global
install, `npx`, and local-checkout variants for Claude, Codex, and Copilot
live there):

- Global install points at the `unreal-mcp-ue4` binary.
- Local checkout points at `<checkout>/dist/bin.js` built in Step 3.

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

This builds the server, boots it over stdio, and checks tool discovery,
namespace schemas, parameter validation, payload codec, and the connection
session policy against fake transports.

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

## Server layout map (Effect migration current)

- `server/bin.ts` — process entry: `--version` handling, signal wiring,
  launching `MainLive` as a daemon fiber.
- `server/index.ts` — composition root exporting `MainLive`; owns the stdio
  transport connect.
- `server/effect/` — Effect services: connection session, `Config` env
  readers, prelude loading, error channel.
- `server/editor/` — pure payload renderers plus the Python 2.7 scripts sent
  to the editor; after touching `server/editor/scripts`, run the dialect gate
  from README `Testing` (`npm run check:py27`).
- `server/register-*.ts` — tool and namespace registration; tool
  name/category/description live co-located there.
- `server.json`, `package.json` scripts — registry metadata and the runnable
  command surface used throughout this guide.
