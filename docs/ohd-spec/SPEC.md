# OHD MCP Server — Builder Spec (v1)

> Status: DRAFT for implementation. Branch: `spec/scaffold`. Map: issue #7. Decided inputs: #1 (probe), #2 (verdict), #3 (scope), #4 (workflow), #5 (scaffold), #6 (live probe).
> Acceptance bar: a TypeScript-capable builder who never saw the map implements the server against this fork and passes the tiered tests in the ProbeThrowaway sandbox with no questions back.

## 1. What is being built

A local MCP server (stdio transport, keeps the backbone's launch model) that lets an AI client help make Operation Harsh Doorstop mods against the installed OHD SDK (UE 4.25.4 at `C:\Program Files\Epic Games\OHDcoreModKit`) by driving the editor through its built-in Python Remote Execution. No custom UE plugin, no C++ to port.

## 2. Backbone verdict (locked, issue #2)

Adapt `conaman/unreal-mcp-ue4` (plain TypeScript + Zod, MIT): fork, retarget to 4.25.4, keep the transport, the `manage_*` namespace/dispatch/registry surface, the `run_python` escape hatch, connection retry hygiene, and the tiered test shape. Do not adopt as-is (4.27.2-pinned), do not build fresh, no Effect-TS in v1. Effect returns only on a concrete tripwire: second transport/session model, retry outgrowing `remote-execution.ts`, or a swallowed-error class. (Revisit floated and declined; see #2 comments.)

## 3. V1 scope (locked, issue #3)

- **Must-have (MCP drives it):** create/edit/test mod content — spawn and place actors, edit properties/components/materials, manage maps + assets (list/search/duplicate/rename/move/save), `run_python` hatch, PIE control + screenshots. All Python 2.7-clean, all validated in the ProbeThrowaway sandbox.
- **Expansive rule:** factions/rulesets/platoons data tools, UMG widgets, sequencer tools (Sequencer Scripting ships OFF — enable, then probe), source-control tools (needs a configured provider; mod folders may have none — define the no-provider behavior) are IN unless their 4.25 `run_python` probe fails. Each failure is a deferred tool with evidence, not a new scope debate.
- **Hard exclusions:** Blueprint graph wiring, variable authoring, UMG delegate/event binding. Impossible upstream, worse in 4.25.
- **Package/Upload:** documented manual human steps (click-paths below); automation ruled out — no hooks exist.

## 4. Environment (issue #4)

- Engine `HDEngine/` = UE 4.25.4 (`Engine/Build/Build.version`); game `HDGame/HarshDoorstop/`; launcher `LaunchEditor.bat` (`-Installed`).
- Mods are content plugins: `Mods/<Name>/` = `<Name>.uplugin` (`CanContainContent:true`) + `Content/` + `Resources/Icon128.png` + one `HDModData` asset (`Content/MOD_<Name>.uasset`) carrying Mod Data → Primary Asset Paths to Scan.
- Shipped maps are content plugins under `Plugins/OML|OOV|ORS|OSB|DLC` (example anatomy: `Plugins/OOV/Carentan/` — `Content/Maps/` base `.umap` + Geo + `GameplayLayers/` per-mode maps + lighting/foliage/materials/meshes + minimap/banner/thumbnail + `Tools/BP_SplineTool`).
- Cross-mod registration: `Config/DefaultGame.ini` `PrimaryAssetTypesToScan` (Map/Faction/Ruleset/Platoon/`HDModData`/GameModeDefinition, per-mod dirs e.g. `/Michael/`, `/Overlord/`); `UGCManagerClassName=/Script/HDMain.HDGameModsProjectPolicies`; one-chunk-per-file packaging.
- Weapons live under `Plugins/OHD/HDAssets/Content/Items/Weapons/<Family>/<Weapon>/…`.
- `Templates/BaseTemplate/` is icon-only — there is no file-copy template; creation logic lives in the compiled `HDCoreUGCEditor` module.

## 5. Setup (mandatory, issues #1 + #6 — all verified live)

1. Edit → Plugins → Scripting → enable **Python Editor Script Plugin** (BETA 1.0), restart. Persists; `EditorScriptingUtilities` already on.
2. Edit → Project Settings → Plugins → Python → **Enable Remote Execution**. Endpoint `239.0.0.1:6766`, bind `0.0.0.0`, buffers 2 MiB — and **raise Multicast TTL 0 → 1** (kit default 0; backbone expects 1). Persists to `DefaultEngine.ini` once set.
3. **Python 2.7.14 only** (triple-confirmed: DLL, `LogPython`, live `sys.version`). CI lint gate on every emitted snippet: no f-strings, `print()` single-arg form, no `pathlib`-era idioms. Upstream 4.27/Python-3 examples must be rewritten.
4. OHD bridge quirks: class names can shadow each other in Python (observed: `HDBaseVehicle.CanBeDestroyedBP`/`CanBeDestroyed` → one `can_be_destroyed`); treat same-name collisions as probe failures.

## 6. UE 4.25 compatibility table (builder's first task)

Source: `evidence/ohd-probe-06.txt` (live `dir(unreal)`, 4065 symbols, Python 2.7.14).

- **Confirmed present:** `EditorLevelLibrary`, `EditorAssetLibrary`.
- **Procedure:** for every `unreal.*` symbol the backbone emits (built in `server/editor/tools-*.ts`), run it through the `run_python` hatch against the kit and record present-vs-missing here. Start with one string-heavy tool (a world-building preset) to catch 2.7 syntax surprises early.
- **Pre-deferred (do not probe, just exclude):** §3 hard exclusions; SequencerScripting-dependent advanced sequence actions until that plugin is enabled and probed.
- **Candidate probes (expansive rule):** faction/ruleset/platoon symbols, UMG helpers, source-control provider presence.

## 7. Mod workflow (issue #4, confirmed live in #6)

1. **Create:** toolbar Create Mod → content-only plugin under `Mods/<Name>/` (verified: `Mods/ProbeThrowaway/Content` + `MOD_ProbeThrowaway` with 4 scan paths). The ProbeThrowaway mod stays as the sandbox.
2. **Edit:** work under the mod's `Content/`; map anatomy §4.
3. **Test:** PIE + screenshots; nothing counts as done until played.
4. **Package:** Package Mod menu ("for local testing or to share"), output-directory dialog, pinned to `PackageUGCAgainstGameReleaseVersion=0.14.2.1-89-15233` (matches `Releases/…/WindowsNoEditor/AssetRegistry.bin`).
5. **Upload:** Upload Mod tab — mod dropdown, preview, Title/Description/Change-notes, Tags (Faction, Mutator, Gamemode, Ruleset, Map), workshop-terms disclaimer, Upload button. Click-only; manual human step.
- Unknown left in spec (not worth editor clicks): `ExplicitlyLoaded` runtime effect.

## 8. Safety (normative; see SAFETY.md)

Throwaway test mod for all experiments; PIE + screenshots before keeping; never shipped `Plugins/*`, `HDAssets`, or engine content; plugin/remote switches (`.uproject`, `DefaultEngine.ini`) are fine and reversible; package against the pinned release; 2.7-clean always.

## 9. Retarget checklist (code changes)

- Version pins 4.27.2 → 4.25.4 everywhere (requirements, server description); docs resource → 4.25 Python API reference.
- Python builders emit 2.7-clean code (lint in CI).
- Content-root conventions: mod plugin paths (`/ProbeThrowaway/…` style roots), `HDModData` awareness, per-mod scan dirs.
- Keep upstream file-for-file fidelity where possible (cherry-pickable); keep `run_python` as the debugging hatch; keep the exclusion-list honesty bar for 4.25.
- First real MCP round-trip doubles as the remote-execution `pong` proof (unobserved to date).

## 10. Testing and done

Tiers mirror upstream with create-and-clean-up discipline, all inside the throwaway mod: (1) no-editor smoke, (2) editor-backed smoke, (3) asset-inclusive (temporary assets, `--keep-assets` for inspection). Done = §3 scope implemented + tiers green + §6 table complete + setup §5 reproducible from a cold kit.

## 11. v2 notes (not v1)

Effect-TS rewrite parked (tripwire §2); keep error shapes and connection-module boundaries rewrite-friendly.

## 12. Evidence index

- `evidence/ohd-probe-06.txt` — live snapshot. Local findings: `findings-01-python-probe.md`, `findings-02-backbone-gap.md`. Upstream: `server/remote-execution.ts`, `server/excluded-capabilities.ts`, `server/tool-support.ts`. Map: issue #7, tickets #1–#6 + #8.
