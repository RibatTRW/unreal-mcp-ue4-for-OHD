import { Effect } from "effect"
import { z } from "zod"

import type { ToolError } from "./effect/errors.js"

import { requireAtLeastOneValue } from "./namespace-action-schema-fragments.js"
import type { RegistrationDispatch, RegistrationParams, RegistrationSchemas } from "./registration-context.js"
import type { ToolCatalogEntry } from "./tool-catalog-types.js"
import { createToolDescriptionLookup } from "./tool-catalog-types.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

/**
 * Catalog entries co-located with the namespace registration below.
 * Adding a tool here needs no edit to a separate catalog file.
 */
export const coreToolsEntries: ToolCatalogEntry[] = [
	{
		name: "manage_tools",
		category: "Core Tool Namespaces",
		description:
			"Tool-namespace registry for listing registered tool namespaces and describing supported actions. Use this as the discovery entry point for the namespace-first MCP surface.",
	},
]

const describeTool = createToolDescriptionLookup(coreToolsEntries)

// Parameter hints served by manage_tools.describe_namespace. Entries cover
// namespaces whose descriptors live in other registrar files; the map stays
// with its only consumer so the split keeps behavior identical.
const namespaceParameterHints: Record<string, Record<string, string[]>> = {
	manage_editor: {
		project_info: ["No params. Returns the active project summary."],
		map_info: ["No params. Returns the current map summary."],
		world_outliner: [
			"Optional: limit (default 200, max 2000), offset, fields. Lists actors in the current editor world with a truncation envelope (total_count, returned_count, truncated).",
		],
		run_python: [
			"Required: code. Use this for UE4.25 Python debugging or gaps not wrapped by a stable action. All code must be Python 2.7-compatible.",
		],
		console_command: [
			"Required: command. Console output is not captured reliably; use run_python when stdout is required.",
		],
		is_pie_running: ["Optional: timeout_seconds, poll_interval. Polls PIE/game-world status."],
		start_pie: ["Optional: timeout_seconds, poll_interval. Starts PIE and waits for a game world when requested."],
		stop_pie: ["Optional: timeout_seconds, poll_interval. Stops PIE and can wait for shutdown."],
		screenshot: ["No params. Takes an editor viewport screenshot."],
		move_camera: ["Optional: location, rotation. Moves the editor viewport camera."],
	},
	manage_widget: {
		create_widget_blueprint: [
			"Required: widget_name, name, asset_path, or widget_path. Use a full asset path like /Game/UI/TestUMG when you want to choose the folder.",
			"Optional: parent_class, path.",
		],
		ensure_canvas_root: [
			"Required: widget_blueprint, widget_blueprint_path, widget_path, asset_path, widget_name, or blueprint_name.",
			"Optional: root_widget_name/root_name, wrap_existing_root. Existing CanvasPanel roots are renamed when a root name is requested.",
		],
		inspect_tree: [
			"Required: widget_blueprint, widget_blueprint_path, widget_path, asset_path, widget_name, or blueprint_name.",
			"Returns the UMG designer tree with widget names, classes, parents, children, text, style, and CanvasPanel slot layout.",
		],
		add_text_block: [
			"Required: widget blueprint selector plus text_block_name or name.",
			"Optional: text, position, size, font_size, color.",
		],
		add_button: [
			"Required: widget blueprint selector plus button_name or name.",
			"Optional: text, position, size, font_size, color, background_color.",
		],
		add_widget: [
			"Required: widget_blueprint_path/widget_blueprint/widget_path/asset_path, widget_class, widget_name/name.",
			"Optional: parent_widget_name, position, size, z_order, background_color. Position and size require a CanvasPanel slot.",
		],
		add_child_widget: [
			"Required: widget_blueprint_path/widget_blueprint/widget_path/asset_path, parent_widget_name, child_widget_class, child_widget_name/name.",
			"Optional: text, position, size, font_size, color, z_order, background_color. Position and size require the child to be attached to a CanvasPanel.",
		],
		position_widget: [
			"Required: widget_blueprint_path/widget_blueprint/widget_path/asset_path, widget_name/name, and at least one of position, size, or z_order.",
			"Only CanvasPanel children can be positioned or resized.",
		],
		position_child_widget: [
			"Required: widget_blueprint_path/widget_blueprint/widget_path/asset_path, parent_widget_name, child_widget_name/name, and at least one of position, size, or z_order.",
			"Only direct children attached to a CanvasPanel slot can be positioned or resized.",
		],
		reparent_widget: [
			"Required: widget_blueprint_path/widget_blueprint/widget_path/asset_path, widget_name/name, new_parent_widget_name.",
			"Optional: position, size, z_order. The current root widget cannot be reparented.",
		],
		remove_widget: ["Required: widget_blueprint_path/widget_blueprint/widget_path/asset_path and widget_name/name."],
		remove_child_widget: [
			"Required: widget_blueprint_path/widget_blueprint/widget_path/asset_path, parent_widget_name, and child_widget_name/name.",
		],
		add_to_viewport: [
			"Required: widget_blueprint, widget_blueprint_path, widget_path, asset_path, widget_name, or blueprint_name.",
			"Optional: z_order, start_pie_if_needed/auto_start_pie, timeout_seconds, poll_interval. Requires PIE or a game world; start_pie_if_needed can request PIE and may return retry_recommended until the game world is ready.",
		],
		setup_sidebar_tab: [
			"Required: widget blueprint selector plus url (initial sidebar browser URL).",
			"Optional: browser_widget_name/name, open_tab, use_template.",
		],
	},
	manage_sequence: {
		sequence_support: [
			"No params. Reports whether the UE4.25 SequencerScripting APIs needed by advanced sequence actions are available.",
		],
		create_sequence: ["Required: name or asset_name.", "Optional: path."],
		search_sequences: [
			"Optional: search_term, query, pattern, name, asset_class, class_name, class, include_engine, limit. Searches LevelSequence assets.",
		],
		sequence_info: ["Required: asset_path, path, or name. Reads basic LevelSequence asset metadata."],
		inspect_sequence: [
			"Required: sequence_path, asset_path, path, or name.",
			"Optional: include_channels, include_keys, key_limit.",
		],
		set_playback_range: [
			"Required: sequence_path, asset_path, path, or name.",
			"Optional: start_frame, end_frame, duration_frames, start_seconds, end_seconds, duration_seconds, unbounded, save.",
		],
		convert_time: [
			"Required: sequence_path, asset_path, path, or name, plus one of seconds, display_frame, tick_frame, or frame.",
		],
		bind_actor: [
			"Required: sequence_path, asset_path, path, or name, plus one of actor_name, actor_path, or object_path.",
			"Optional: binding_name, reuse_existing, save.",
		],
		add_track: [
			"Required: sequence_path, asset_path, path, or name, plus track_type.",
			"Optional: scope/master, track_index/track_name, binding target (binding_id, binding_name, actor_name, actor_path, object_path, camera_actor_name), range (start/end_frame, start/end_seconds, duration_*, unbounded, save), display_name, property_name, property_path, add_section.",
		],
		add_section: [
			"Required: sequence_path, asset_path, path, or name.",
			"Optional: track target (scope/master, track_type, track_index, track_name, binding target) and range (start/end_frame, start/end_seconds, duration_*, unbounded, save).",
		],
		add_key: [
			"Required: sequence_path, asset_path, path, or name; one of frame, time_seconds, or seconds; plus value.",
			"Optional: track target, section_index, channel_type/channel_name/channel_index, sub_frame, time_unit (display_rate, tick_resolution), save.",
		],
		add_camera_cut: [
			"Required: sequence_path, asset_path, path, or name, plus one of binding_id, binding_name, actor_name, actor_path, object_path, or camera_actor_name.",
			"Optional: range (start/end_frame, start/end_seconds, duration_*, unbounded, save).",
		],
		analyze_playback_speed: [
			"Required: sequence_path, asset_path, path, or name.",
			"Optional: target_seconds, target_frame, start_seconds, integration_mode (linear, constant).",
		],
		calculate_playback_time: [
			"Required: sequence_path, asset_path, path, or name, plus one of target_seconds, target_frame, end_seconds, or end_frame.",
			"Optional: start_seconds, integration_mode (linear, constant).",
		],
	},
	manage_level_structure: {
		world_outliner: ["No params. Lists actors in the current editor world."],
		create_town: ["Optional: location, material_path, prefix, rows, cols, spacing."],
		construct_house: [
			"Optional: location, material_path, prefix, width, depth, wall_height, wall_thickness, roof_height.",
		],
		construct_mansion: [
			"Optional: location, material_path, prefix, width, depth, wall_height, wall_thickness, roof_height, wing_offset.",
		],
		create_tower: ["Optional: location, material_path, prefix, width, floors, floor_height."],
		create_wall: ["Optional: location, material_path, prefix, segments, segment_length, height, thickness, axis."],
		create_bridge: [
			"Optional: location, material_path, prefix, segments, segment_length, width, thickness, rail_height.",
		],
		create_suspension_bridge: [
			"Optional: location, material_path, prefix, segments, segment_length, width, thickness, rail_height, tower_height.",
		],
		create_aqueduct: ["Optional: location, material_path, prefix, arches, spacing."],
		create_castle_fortress: [
			"Optional: location, material_path, prefix, size, segments, height, thickness, tower_width.",
		],
	},
	manage_asset: {
		list: ["Optional: root_path/path (defaults to /Game), recursive, limit."],
		search: ["Optional: search_term, query, pattern, name, asset_class, class_name, class, include_engine, limit."],
		info: ["Required: asset_path, path, or name. Reads asset metadata."],
		references: ["Required: asset_path, path, or name. Lists asset references."],
		exists: ["Required: asset_path, path, name, or asset_paths (array checks multiple assets)."],
		duplicate: [
			"Required: a source (source_asset_path, source_path, asset_path, or path) plus a destination (destination_asset_path, target_asset_path, destination_path, new_name, or name).",
		],
		rename: [
			"Required: a source (source_asset_path, source_path, asset_path, or path) plus a destination (destination_asset_path, target_asset_path, destination_path, new_name, or name).",
		],
		move: [
			"Required: a source (source_asset_path, source_path, asset_path, or path) plus a destination (destination_asset_path, target_asset_path, destination_path, new_name, or name).",
		],
		delete: ["Required: asset_path, path, name, or asset_paths."],
		save: ["Required: asset_path, path, name, or asset_paths.", "Optional: only_if_is_dirty."],
		create_folder: ["Required: directory_path, folder_path, or path."],
		list_folder: ["Optional: directory_path/folder_path/path (defaults to /Game), recursive."],
		delete_folder: ["Required: directory_path, folder_path, or path."],
		export: [
			"Required: asset_path, path, or name.",
			"Optional: destination_path, file_path, output_path, overwrite (defaults true).",
		],
		validate: ["Required: asset_paths or paths as a string, comma-separated string, or string array."],
	},
	manage_blueprint: {
		create_blueprint: ["Required: name or blueprint_name.", "Optional: parent_class, path."],
		add_component: [
			"Required: blueprint_name or asset_path for the target; component_type or class_name; component_name or name.",
			"Optional: location, rotation, scale, component_properties, parent_component_name.",
		],
		set_static_mesh: [
			"Required: blueprint target (blueprint_name, asset_path, or name), component_name, plus static_mesh or mesh_path.",
		],
		set_component_property: [
			"Required: blueprint target (blueprint_name, asset_path, or name), component_name, property_name.",
			"Optional: property_value.",
		],
		set_physics_properties: [
			"Required: blueprint target (blueprint_name, asset_path, or name), component_name.",
			"Optional: simulate_physics, gravity_enabled, mass, linear_damping, angular_damping.",
		],
		set_blueprint_property: [
			"Required: blueprint target (blueprint_name, asset_path, or name), property_name.",
			"Optional: property_value.",
		],
		compile: ["Required: blueprint_name, asset_path, or name."],
		read: ["Required: blueprint_name, asset_path, or name.", "Optional: include_nodes."],
	},
	manage_volumes: {
		spawn_trigger_volume: [
			"Optional: object_class/class_name, name/actor_name, location, rotation, scale, properties.",
		],
		spawn_blocking_volume: [
			"Optional: object_class/class_name, name/actor_name, location, rotation, scale, properties.",
		],
		spawn_physics_volume: [
			"Optional: object_class/class_name, name/actor_name, location, rotation, scale, properties.",
		],
		spawn_audio_volume: ["Optional: object_class/class_name, name/actor_name, location, rotation, scale, properties."],
		delete_volume: ["Required: name or actor_name."],
		transform_volume: ["Required: name or actor_name.", "Optional: location, rotation, scale."],
	},
	manage_actor: {
		list: ["No params. Lists actors in the current level."],
		find: ["Required: pattern or name."],
		spawn: ["Optional: type/actor_type/class_name (defaults to StaticMeshActor), name/actor_name, location, rotation."],
		spawn_blueprint: [
			"Required: blueprint_name or asset_path.",
			"Optional: name/actor_name, location, rotation, scale, properties.",
		],
		delete: ["Required: name or actor_name."],
		transform: ["Required: name or actor_name.", "Optional: location, rotation, scale."],
		get_properties: ["Required: name or actor_name."],
		set_property: ["Required: name or actor_name plus property_name.", "Optional: property_value."],
		get_material_info: ["Required: name or actor_name. Returns the actor material info."],
	},
}

export function coreToolsDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const { directDispatch, requiredStringParam, toolNamespaceRegistry } = ctx

	return [
		{
			name: "manage_tools",
			description: describeTool("manage_tools"),
			actions: {
				list_namespaces: {
					// Phase 5b (report §5): handler returns Effect; throws become
					// channel failures via Effect.try (Effect.sync would defect
					// past dispatch's catchAll and break the identical envelope),
					// rendered verbatim downstream.
					handler: () =>
						Effect.try({
							try: () =>
								directDispatch({
									success: true,
									namespaces: Array.from(toolNamespaceRegistry.entries())
										.map(([toolNamespace, info]) => ({
											tool_namespace: toolNamespace,
											description: info.description,
											supported_actions: info.supportedActions,
										}))
										.sort((left, right) => left.tool_namespace.localeCompare(right.tool_namespace)),
								}),
							catch: (cause) => cause as ToolError,
						}),
				},
				tool_status: {
					handler: () =>
						Effect.try({
							try: () =>
								directDispatch({
									success: true,
									tool_namespace_count: toolNamespaceRegistry.size,
									tool_namespaces: Array.from(toolNamespaceRegistry.keys()).sort(),
								}),
							catch: (cause) => cause as ToolError,
						}),
				},
				describe_namespace: {
					paramsSchema: requireAtLeastOneValue(
						z
							.object({
								tool_name: z.string().optional(),
								namespace_name: z.string().optional(),
								name: z.string().optional(),
							})
							.strict(),
						["tool_name", "namespace_name", "name"],
						"Provide tool_name, namespace_name, or name.",
					),
					handler: (params) =>
						Effect.try({
							try: () => {
								const toolName = requiredStringParam(params, ["tool_name", "namespace_name", "name"])
								const info = toolNamespaceRegistry.get(toolName)
								return directDispatch(
									info
										? {
												success: true,
												tool_namespace: toolName,
												description: info.description,
												supported_actions: info.supportedActions,
												parameter_hints: namespaceParameterHints[toolName],
											}
										: {
												success: false,
												message: `Unknown tool namespace: ${toolName}`,
												available_tool_namespaces: Array.from(toolNamespaceRegistry.keys()).sort(),
											},
								)
							},
							catch: (cause) => cause as ToolError,
						}),
				},
			},
		},
	]
}
