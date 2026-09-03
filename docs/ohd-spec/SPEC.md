# OHD MCP Server — Spec (DRAFT skeleton)

> Status: scaffold. Section bodies land with the spec-draft ticket. Normative decisions so far: backbone verdict (plain-TS adapt), v1 scope lock, setup facts, mod workflow, live-probe evidence.
> Map: issue #7. Ticket issues: #1–#6 closed, #5 scaffold, #8 spec draft.

## 1. Destination and verdict

Working local MCP server for OHD mod-making (UE 4.25.4 kit), built by adapting this fork's upstream (`conaman/unreal-mcp-ue4`, plain TypeScript + Zod). No fresh build, no Effect-TS in v1. (Issue #2.)

## 2. V1 scope

- Must-have: AI-driven create/edit/test — spawn/place actors, edit properties/components/materials, manage maps + assets, `run_python` hatch, PIE + screenshots. All Python 2.7-clean, validated in the ProbeThrowaway sandbox.
- Expansive rule: factions/rulesets/platoons, UMG widgets, sequencer (needs Sequencer Scripting on), source control are IN unless their 4.25 `run_python` probe fails — each failure is a deferred tool, not a new debate.
- Hard exclusions: Blueprint graph wiring, variable authoring, UMG delegate/event binding.
- Package/Upload: documented manual human steps; automation ruled out (no hooks). (Issue #3.)

## 3. Environment

OHD SDK at `C:\Program Files\Epic Games\OHDcoreModKit`: `HDEngine/` = UE 4.25.4, game `HDGame/HarshDoorstop/`, mods as content plugins under `Mods/`, shipped maps under `Plugins/OML|OOV|ORS|OSB|DLC`. (Issues #1, #4.)

## 4. Setup (builder-facing, mandatory)

1. Enable Python Editor Script Plugin (Edit → Plugins → Scripting), restart.
2. Project Settings → Plugins → Python → Enable Remote Execution; raise Multicast TTL 0 → 1.
3. Every snippet sent must be Python 2.7-clean (CI lint: no f-strings, `print()` single-arg form).
4. `EditorScriptingUtilities` already on — no action. (Issues #1, #6.)

## 5. UE 4.25 tool/compatibility table

TODO (spec draft): per-symbol present-vs-missing from `evidence/ohd-probe-06.txt` (4065 symbols; `EditorLevelLibrary` + `EditorAssetLibrary` confirmed). Each missing backbone-assumed binding becomes a deferred v1 tool.

## 6. Mod workflow

Create Mod → edit plugin `Content/` (map anatomy per Carentan example; registration via `PrimaryAssetTypesToScan`) → test in editor → Package Mod (release-pinned) → Upload Mod (Steam tags). (Issue #4.)

## 7. Safety

See `SAFETY.md` — throwaway test mod, play-mode checks, never shipped content.

## 8. Testing

Three tiers mirroring upstream (no-editor smoke, editor-backed smoke, asset-inclusive with create-and-clean-up), all inside the throwaway mod. First real MCP round-trip also serves as the remote-execution `pong` proof.

## 9. v2 notes (not v1)

Effect-TS rewrite stays parked: revisit only on second transport, outgrown retry module, or swallowed-error class. Keep error shapes and connection-module boundaries rewrite-friendly.

## 10. Evidence index

- `evidence/ohd-probe-06.txt` — live `dir(unreal)` snapshot (4.25.4, Python 2.7.14).
- Upstream files: `server/remote-execution.ts`, `server/excluded-capabilities.ts`, `server/tool-support.ts`.
