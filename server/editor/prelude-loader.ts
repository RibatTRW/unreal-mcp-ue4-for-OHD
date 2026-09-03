import fs from "node:fs"
import path from "node:path"

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
		"11_widget_editing.py",
		"12_widget_creation.py",
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
		"10_widget_tree_access.py",
		"10_widget_tree_search.py",
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
	ue_content_factory: [
		"00_asset_factory_helpers.py",
		"10_sequence_behavior_factories.py",
		"20_audio_import.py",
	],
	ue_data: ["00_helpers.py", "10_search_ops.py", "20_create_ops.py"],
	ue_material: [
		"00_target_resolution.py",
		"10_material_ops.py",
		"20_material_tinting.py",
		"30_physics_spawn.py",
	],
	ue_sequence: ["00_sequence_helpers.py"],
	ue_source_control: [
		"00_helper_resolution.py",
		"01_state_serialization.py",
		"10_read_ops.py",
		"20_mutation_ops.py",
	],
	ue_umg: [
		"00_helpers.py",
		"10_widget_blueprints.py",
		"20_widget_tree_ops.py",
		"30_viewport_bindings.py",
	],
	ue_world_building: [
		"00_core.py",
		"10_settlement_structures.py",
		"11_bridge_fortress_structures.py",
		"20_patterns.py",
	],
}

export function buildOrderedPrelude(relativeDir: string): string {
	const absoluteDir = path.join(__dirname, relativeDir)
	if (!fs.existsSync(absoluteDir)) {
		return ""
	}

	const listed = preludeManifest[path.basename(relativeDir)]
	if (!listed) {
		throw new Error(`No prelude manifest for package '${relativeDir}'`)
	}

	const onDisk = fs
		.readdirSync(absoluteDir)
		.filter((fileName) => fileName.endsWith(".py"))
		.sort()
	const unlisted = onDisk.filter((fileName) => listed.indexOf(fileName) === -1)
	if (unlisted.length > 0) {
		throw new Error(
			`Unlisted prelude file(s) in ${relativeDir}: ${unlisted.join(", ")} (add them to preludeManifest)`,
		)
	}
	const missing = listed.filter((fileName) => onDisk.indexOf(fileName) === -1)
	if (missing.length > 0) {
		throw new Error(`Prelude manifest lists missing file(s) in ${relativeDir}: ${missing.join(", ")}`)
	}

	return listed.map((fileName) => readEditorScript(`${relativeDir}/${fileName}`)).join("\n\n")
}

export const editorPreludes = {
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
	worldBuilding: buildOrderedPrelude("./scripts/ue_world_building"),
}
