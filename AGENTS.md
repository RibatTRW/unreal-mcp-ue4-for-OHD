# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Effect migration scaffold (Phase 0)

- Pattern catalog + error channel + Config env readers live in `server/effect/` (not wired in yet);
  Zod stays at the MCP SDK call-site permanently (SDK throws on non-Zod).
- `test:no-unreal` also runs `scripts/check-tool-surface.mjs` (listTools snapshot
  in `scripts/__snapshots__/`) and `scripts/check-schema-parity.mjs` (Zod↔Schema matrix).
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
