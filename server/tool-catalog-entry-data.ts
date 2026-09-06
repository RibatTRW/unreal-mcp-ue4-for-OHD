import { contentAssetEntries } from "./register-content-asset-namespaces.js"
import { contentBlueprintEntries } from "./register-content-blueprint-namespaces.js"
import { contentMediaEntries } from "./register-content-media-namespaces.js"
import { contentWidgetEntries } from "./register-content-widget-namespaces.js"
import { coreAssetActorEntries } from "./register-core-asset-actor-namespaces.js"
import { coreEditorEntries } from "./register-core-editor-namespaces.js"
import { coreInspectionEntries } from "./register-core-inspection-namespaces.js"
import { coreSourceControlEntries } from "./register-core-source-control-namespaces.js"
import { coreSystemEntries } from "./register-core-system-namespaces.js"
import { coreToolsEntries } from "./register-core-tools-namespaces.js"
import { directToolEntries } from "./register-direct-tools.js"
import { gameplayEntries } from "./register-gameplay-namespaces.js"
import { worldBuildingEntries } from "./register-world-building-namespaces.js"
import { worldEffectsSplinesEntries } from "./register-world-effects-splines-namespaces.js"
import { worldLightingEntries } from "./register-world-lighting-namespaces.js"
import { worldNavigationVolumeEntries } from "./register-world-navigation-volume-namespaces.js"
import type { ToolCatalogEntry } from "./tool-catalog-types.js"

export type { ToolCatalogEntry } from "./tool-catalog-types.js"

/**
 * Every entry declared alongside its tool's registration. Adding a tool to a
 * register-* module automatically adds it here; this file needs no edit.
 */
const registeredEntries: ToolCatalogEntry[] = [
	...directToolEntries,
	...coreAssetActorEntries,
	...coreEditorEntries,
	...coreSystemEntries,
	...coreInspectionEntries,
	...coreToolsEntries,
	...coreSourceControlEntries,
	...worldLightingEntries,
	...worldNavigationVolumeEntries,
	...worldEffectsSplinesEntries,
	...worldBuildingEntries,
	...contentAssetEntries,
	...contentBlueprintEntries,
	...contentMediaEntries,
	...contentWidgetEntries,
	...gameplayEntries,
]

/**
 * Stable historic ordering for README generation. Tools registered under a
 * name absent from this list are appended automatically, so a new tool needs
 * no catalog edit to appear in the catalog and README.
 */
const legacyCatalogOrder: readonly string[] = [
	"get_unreal_engine_path",
	"get_unreal_project_path",
	"get_unreal_version",
	"editor_create_object",
	"editor_update_object",
	"editor_delete_object",
	"manage_asset",
	"manage_actor",
	"manage_editor",
	"manage_level",
	"manage_system",
	"manage_inspection",
	"manage_tools",
	"manage_source_control",
	"manage_lighting",
	"manage_level_structure",
	"manage_volumes",
	"manage_navigation",
	"manage_environment",
	"manage_splines",
	"manage_geometry",
	"manage_effect",
	"manage_skeleton",
	"manage_material",
	"manage_texture",
	"manage_data",
	"manage_blueprint",
	"manage_sequence",
	"manage_audio",
	"manage_widget",
	"manage_animation_physics",
	"manage_input",
	"manage_behavior_tree",
	"manage_gas",
]

const entryByName = new Map(registeredEntries.map((entry) => [entry.name, entry]))
const legacyOrder = new Set(legacyCatalogOrder)

export const toolCatalogEntries: ToolCatalogEntry[] = [
	...legacyCatalogOrder.map((name) => entryByName.get(name)).filter((entry) => entry !== undefined),
	...registeredEntries.filter((entry) => !legacyOrder.has(entry.name)),
]
