import { z } from "zod"

import { vector3TransformShape } from "./namespace-action-schema-fragments.js"
import type { RegistrationDispatch, RegistrationParams, RegistrationSchemas } from "./registration-context.js"
import { sharedReadOnlyActions } from "./shared-read-only-actions.js"
import type { ToolCatalogEntry } from "./tool-catalog-types.js"
import { createToolDescriptionLookup } from "./tool-catalog-types.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

/**
 * Catalog entries co-located with the namespace registration below.
 * Adding a tool here needs no edit to a separate catalog file.
 */
export const coreEditorEntries: ToolCatalogEntry[] = [
	{
		name: "manage_editor",
		category: "Core Tool Namespaces",
		description:
			"Editor tool namespace for run_python, console_command, project_info, map_info, world_outliner, is_pie_running, start_pie, stop_pie, screenshot, and move_camera actions.",
	},
]

const describeTool = createToolDescriptionLookup(coreEditorEntries)

export function coreEditorDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const { editorTools, pythonDispatch, requiredStringParam, toRotatorRecord, toVector3Record } = ctx
	const shared = sharedReadOnlyActions(ctx)

	return [
		{
			name: "manage_editor",
			description: describeTool("manage_editor"),
			actions: {
				run_python: {
					paramsSchema: z
						.object({
							code: z.string(),
						})
						.strict(),
					handler: (params) => pythonDispatch(requiredStringParam(params, ["code"])),
				},
				console_command: shared.console_command,
				project_info: { handler: () => pythonDispatch(editorTools.UEGetProjectInfo()) },
				map_info: shared.map_info,
				world_outliner: shared.world_outliner,
				is_pie_running: {
					paramsSchema: z
						.object({
							timeout_seconds: z.number().optional(),
							poll_interval: z.number().optional(),
						})
						.strict(),
					handler: (params) =>
						pythonDispatch(
							editorTools.UEPIETool("get_pie_status", {
								timeout_seconds: params.timeout_seconds,
								poll_interval: params.poll_interval,
							}),
						),
				},
				start_pie: {
					paramsSchema: z
						.object({
							timeout_seconds: z.number().optional(),
							poll_interval: z.number().optional(),
						})
						.strict(),
					handler: (params) =>
						pythonDispatch(
							editorTools.UEPIETool("start_pie", {
								timeout_seconds: params.timeout_seconds,
								poll_interval: params.poll_interval,
							}),
						),
				},
				stop_pie: {
					paramsSchema: z
						.object({
							timeout_seconds: z.number().optional(),
							poll_interval: z.number().optional(),
						})
						.strict(),
					handler: (params) =>
						pythonDispatch(
							editorTools.UEPIETool("stop_pie", {
								timeout_seconds: params.timeout_seconds,
								poll_interval: params.poll_interval,
							}),
						),
				},
				get_console_variable: shared.get_console_variable,
				screenshot: { handler: () => pythonDispatch(editorTools.UETakeScreenshot()) },
				move_camera: {
					paramsSchema: z.object(vector3TransformShape).strict(),
					handler: (params) =>
						pythonDispatch(
							editorTools.UEMoveCamera(
								toVector3Record(params.location) ?? { x: 0, y: 0, z: 0 },
								toRotatorRecord(params.rotation) ?? { pitch: 0, yaw: 0, roll: 0 },
							),
						),
				},
			},
		},
	]
}
