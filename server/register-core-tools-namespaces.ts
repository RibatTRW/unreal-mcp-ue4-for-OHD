import { z } from "zod"

import { requireAtLeastOneValue } from "./namespace-action-schema-fragments.js"
import type { RegistrationDispatch, RegistrationParams, RegistrationSchemas } from "./registration-context.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

// Parameter hints served by manage_tools.describe_namespace. Entries cover
// namespaces whose descriptors live in other registrar files; the map stays
// with its only consumer so the split keeps behavior identical.
const namespaceParameterHints: Record<string, Record<string, string[]>> = {
	manage_editor: {
		project_info: ["No params. Returns the active project summary."],
		map_info: ["No params. Returns the current map summary."],
		world_outliner: ["No params. Lists actors in the current editor world."],
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
	},
}

export function coreToolsDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const { directDispatch, requiredStringParam, toolNamespaceRegistry } = ctx

	return [
		{
			name: "manage_tools",
			actions: {
				list_namespaces: {
					handler: () =>
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
				},
				tool_status: {
					handler: () =>
						directDispatch({
							success: true,
							tool_namespace_count: toolNamespaceRegistry.size,
							tool_namespaces: Array.from(toolNamespaceRegistry.keys()).sort(),
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
					handler: (params) => {
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
				},
			},
		},
	]
}
