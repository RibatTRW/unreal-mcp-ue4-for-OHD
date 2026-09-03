# UE 4.25 compatibility matrix (seed)

Method: static cross-check of every `unreal.X` reference emitted by
`server/editor/scripts/**/*.py` (62 distinct symbols) against the live
`dir(unreal)` snapshot in `evidence/ohd-probe-06.txt` (4065 symbols,
Python 2.7.14, OHD kit editor). Static only — per-method behavior still
needs the builder's `run_python` probe (SPEC §6).

## Present: 53 of 62

Including both backbone-critical APIs: `EditorLevelLibrary`,
`EditorAssetLibrary`. Also present: `load_class` (used as the primary
class resolver with `find_class` as fallback), generic
`get_editor_subsystem`, `AutomationLibrary`, `SystemLibrary`,
`AssetRegistryHelpers`, `Paths`.

## Missing: 9, with per-site impact

| Symbol | Used by | 4.25 behavior | Disposition |
|---|---|---|---|
| `UnrealEditorSubsystem` | `01_editor_world.get_editor_world` | Falls back to `EditorLevelLibrary.get_editor_world()` (present) | None — covered |
| `EditorActorSubsystem` | actor list/destroy in `01_editor_world` | Fall back to `EditorLevelLibrary` equivalents (present) | None — covered |
| `find_class` | `03_object_property_helpers` | `load_class` primary already; `find_class` is the guarded fallback | None — covered |
| `BlueprintEditorLibrary` | `try_compile_blueprint` (`11_widget_editing`, + persistence/component helpers) | `hasattr`-guarded; compile becomes silent no-op, saves still occur | Document; probe whether save-without-compile suffices in OHD |
| `KismetEditorUtilities` | compile fallback; `add_components_to_blueprint` (`18`, `23`) | Guarded; clean "not available" errors | Component authoring limited; probe SCS-based alternative |
| `new_object` | widget creation (`12`, `30`), component harvest/graph fallback (`23`, `24`), asset persistence (`20`) | Absent (probed live: hasattr False). Replacement probed live: positional UClass call `Class(outer, name)` works; `Outer=`/`Name=` kwargs rejected; SCS/`BlueprintEditorUtils`/`KismetEditorUtilities` also absent, so the template path is the only route | Fixed: `new_object_compat()` in `00_core` (factory-first on 4.27+, class-call fallback); all 5 call sites routed through it |
| `AttachmentTransformRules` | `23_blueprint_component_harvest` | Counterpart `AttachmentRule` exists; member names unverified | Probe member names (`KeepRelative`?) |
| `MovieSceneObjectBindingSpace`, `MovieSceneScriptingFloatChannel` | `00_sequence_helpers` (advanced sequence) | SequencerScripting ships OFF in the kit anyway | Deferred pending plugin enable + probe |

Net: world/actor/asset core is whole via `EditorLevelLibrary`; creation, compile, component, and advanced-sequence flows are the probe frontier. No overturn condition: nothing here changes the adapt verdict.
