import fs from "node:fs"
import path from "node:path"

import { PreludeError } from "../effect/errors.js"

export function readEditorScript(filePath: string): string {
	return fs.readFileSync(path.join(__dirname, filePath), "utf8")
}

/**
 * Declared prelude contents per package directory, in load order. Filenames
 * carry no semantics: positions here are the order, so renames are safe and
 * same-prefix pairs (e.g. 10_widget_tree_access/search) no longer depend on
 * invisible alphabetical tiebreak. The initial order of every list matches
 * the old filename sort byte-for-byte.
 */
const preludeManifest: Record<string, string[]> = {
	ue_actor: ["00_transforms.py", "10_query_ops.py", "20_spawn_ops.py", "30_mutation_ops.py"],
	ue_asset_resolution: [
		"04_project_input_helpers.py",
		"20_asset_blueprint_persistence.py",
		"25_actor_widget_reporting.py",
		"30_material_component_reporting.py",
		"30_material_helpers.py",
		"31_physics_shape_helpers.py",
	],
	ue_blueprint: ["00_helpers.py", "10_asset_lifecycle.py", "20_component_ops.py"],
	ue_text_codec: ["00_text_codec.py"],
	ue_object_access: [
		"00_object_probe.py",
		"01_editor_world.py",
		"02_asset_package_helpers.py",
		"03_object_property_helpers.py",
		"09_widget_class_helpers.py",
		"18_blueprint_component_lookup.py",
		"18_blueprint_runtime_helpers.py",
		"19_asset_lookup.py",
		"21_blueprint_component_helpers.py",
		"22_blueprint_component_core.py",
		"22_blueprint_component_creation.py",
		"23_blueprint_component_harvest.py",
		"23_blueprint_graph_core.py",
		"24_blueprint_component_graph_fallback.py",
		"24_blueprint_graph_analysis.py",
	],
	ue_content_factory: ["00_asset_factory_helpers.py", "10_sequence_behavior_factories.py", "20_audio_import.py"],
	ue_data: ["00_helpers.py", "10_search_ops.py", "20_create_ops.py"],
	ue_material: ["00_target_resolution.py", "10_material_ops.py", "20_material_tinting.py", "30_physics_spawn.py"],
	ue_sequence: ["00_sequence_helpers.py"],
	ue_source_control: ["00_helper_resolution.py", "01_state_serialization.py", "10_read_ops.py", "20_mutation_ops.py"],
	ue_umg: ["00_helpers.py", "10_widget_blueprints.py", "30_viewport_bindings.py"],
	ue_widget_tree: [
		"00_helpers.py",
		"10_widget_tree_access.py",
		"10_widget_tree_search.py",
		"11_widget_editing.py",
		"12_widget_creation.py",
		"20_widget_tree_ops.py",
		"30_widget_presentation.py",
	],
	ue_world_building: [
		"00_core.py",
		"10_settlement_structures.py",
		"11_bridge_fortress_structures.py",
		"20_patterns.py",
	],
}

// Manifest-mismatch throws are PreludeError (report §4.2) with the legacy
// text preserved verbatim in `detail`. Data.TaggedError defaults .message
// to "", so it is aligned onto detail — legacy catch sites, logs, and the
// dispatch envelope keep reading the exact same words.
const throwPreludeError = (detail: string): never => {
	const error = new PreludeError({ detail })
	error.message = detail
	throw error
}

export function buildOrderedPrelude(relativeDir: string): string {
	const absoluteDir = path.join(__dirname, relativeDir)
	if (!fs.existsSync(absoluteDir)) {
		return ""
	}

	const listed = preludeManifest[path.basename(relativeDir)]
	if (!listed) {
		throwPreludeError(`No prelude manifest for package '${relativeDir}'`)
	}

	const onDisk = fs
		.readdirSync(absoluteDir)
		.filter((fileName) => fileName.endsWith(".py"))
		.sort()
	const unlisted = onDisk.filter((fileName) => listed.indexOf(fileName) === -1)
	if (unlisted.length > 0) {
		throwPreludeError(
			`Unlisted prelude file(s) in ${relativeDir}: ${unlisted.join(", ")} (add them to preludeManifest)`,
		)
	}
	const missing = listed.filter((fileName) => onDisk.indexOf(fileName) === -1)
	if (missing.length > 0) {
		throwPreludeError(`Prelude manifest lists missing file(s) in ${relativeDir}: ${missing.join(", ")}`)
	}

	return listed.map((fileName) => readEditorScript(`${relativeDir}/${fileName}`)).join("\n\n")
}

export interface EditorPreludes {
	readonly actor: string
	readonly textCodec: string
	readonly objectAccess: string
	readonly assetResolution: string
	readonly blueprint: string
	readonly contentFactory: string
	readonly data: string
	readonly material: string
	readonly sourceControl: string
	readonly sequence: string
	readonly umg: string
	readonly widgetTree: string
	readonly worldBuilding: string
}

// The exact import-time literal, now loaded on demand: same packages, same
// key order, same join semantics — only the timing moved.
function loadEditorPreludes(): EditorPreludes {
	return {
		actor: buildOrderedPrelude("./scripts/ue_actor"),
		textCodec: buildOrderedPrelude("./scripts/ue_text_codec"),
		objectAccess: buildOrderedPrelude("./scripts/ue_object_access"),
		assetResolution: buildOrderedPrelude("./scripts/ue_asset_resolution"),
		blueprint: buildOrderedPrelude("./scripts/ue_blueprint"),
		contentFactory: buildOrderedPrelude("./scripts/ue_content_factory"),
		data: buildOrderedPrelude("./scripts/ue_data"),
		material: buildOrderedPrelude("./scripts/ue_material"),
		sourceControl: buildOrderedPrelude("./scripts/ue_source_control"),
		sequence: buildOrderedPrelude("./scripts/ue_sequence"),
		umg: buildOrderedPrelude("./scripts/ue_umg"),
		widgetTree: buildOrderedPrelude("./scripts/ue_widget_tree"),
		worldBuilding: buildOrderedPrelude("./scripts/ue_world_building"),
	}
}

// Memoized-once cells (report §4.5): importing this module performs no
// filesystem reads. The first render — or the first PreludeServiceLive
// build at startup once Phase 6 wires the composition root — loads each
// file set exactly once per process; the Layer memoizes per build on top
// of these cells, so the bytes stay single-sourced either way.
let memoizedPreludes: EditorPreludes | undefined
let memoizedDispatchHarness: string | undefined

export function getEditorPreludes(): EditorPreludes {
	if (memoizedPreludes === undefined) {
		memoizedPreludes = loadEditorPreludes()
	}
	return memoizedPreludes
}

export function getDomainDispatchHarness(): string {
	if (memoizedDispatchHarness === undefined) {
		memoizedDispatchHarness = readEditorScript("./scripts/ue_tools_dispatch.py")
	}
	return memoizedDispatchHarness
}

// Byte-identical ordering: the key sequence matches the original
// import-time literal, so enumeration, spread, and destructuring observe
// the same order with the same values — only the first read is deferred.
const preludeKeys: ReadonlyArray<keyof EditorPreludes> = [
	"actor",
	"textCodec",
	"objectAccess",
	"assetResolution",
	"blueprint",
	"contentFactory",
	"data",
	"material",
	"sourceControl",
	"sequence",
	"umg",
	"widgetTree",
	"worldBuilding",
]

const lazyPreludes = {} as EditorPreludes
for (const key of preludeKeys) {
	Object.defineProperty(lazyPreludes, key, {
		enumerable: true,
		get: (): string => getEditorPreludes()[key],
	})
}

export const editorPreludes: EditorPreludes = lazyPreludes
