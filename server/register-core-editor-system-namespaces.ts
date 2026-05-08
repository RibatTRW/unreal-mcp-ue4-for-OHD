import { z } from "zod"

import {
	actorNameShape,
	actorNameSchema,
	assetLookupSchema,
	blueprintNameShape,
	requireAtLeastOneValue,
	vector3TransformShape,
} from "./namespace-action-schema-fragments.js"
import { RegistrationContext } from "./registration-context.js"

export function registerCoreEditorSystemNamespaces(ctx: RegistrationContext) {
	const {
		actorNameParam,
		blueprintNameParam,
		directDispatch,
		editorTools,
		pythonDispatch,
		registerToolNamespace,
		requiredStringParam,
		toRotatorRecord,
		toVector3Record,
		toolNamespaceRegistry,
	} = ctx

	registerToolNamespace("manage_editor", ctx.toolDescription("manage_editor"), {
		run_python: {
			paramsSchema: z
				.object({
					code: z.string(),
				})
				.strict(),
			handler: (params) => pythonDispatch(requiredStringParam(params, ["code"])),
		},
		console_command: {
			paramsSchema: z
				.object({
					command: z.string(),
				})
				.strict(),
			handler: (params) =>
				pythonDispatch(editorTools.UEConsoleCommand(requiredStringParam(params, ["command"]))),
		},
		project_info: { handler: () => pythonDispatch(editorTools.UEGetProjectInfo()) },
		map_info: { handler: () => pythonDispatch(editorTools.UEGetMapInfo()) },
		world_outliner: { handler: () => pythonDispatch(editorTools.UEGetWorldOutliner()) },
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
		get_console_variable: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						variable_name: z.string().optional(),
						name: z.string().optional(),
						console_variable: z.string().optional(),
					})
					.strict(),
				["variable_name", "name", "console_variable"],
				"Provide variable_name, name, or console_variable.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetConsoleVariable(
						requiredStringParam(params, ["variable_name", "name", "console_variable"]),
					),
				),
		},
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
	})

	registerToolNamespace("manage_system", ctx.toolDescription("manage_system"), {
		console_command: {
			paramsSchema: z
				.object({
					command: z.string(),
				})
				.strict(),
			handler: (params) =>
				pythonDispatch(editorTools.UEConsoleCommand(requiredStringParam(params, ["command"]))),
		},
		get_console_variable: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						variable_name: z.string().optional(),
						name: z.string().optional(),
						console_variable: z.string().optional(),
					})
					.strict(),
				["variable_name", "name", "console_variable"],
				"Provide variable_name, name, or console_variable.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetConsoleVariable(
						requiredStringParam(params, ["variable_name", "name", "console_variable"]),
					),
				),
		},
		validate_assets: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						asset_paths: z.string().optional(),
						paths: z.string().optional(),
					})
					.strict(),
				["asset_paths", "paths"],
				"Provide asset_paths or paths.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEValidateAssets(requiredStringParam(params, ["asset_paths", "paths"])),
				),
		},
	})

	registerToolNamespace("manage_inspection", ctx.toolDescription("manage_inspection"), {
		asset: {
			paramsSchema: assetLookupSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"])),
				),
		},
		asset_references: {
			paramsSchema: assetLookupSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetAssetReferences(requiredStringParam(params, ["asset_path", "path", "name"])),
				),
		},
		actor: {
			paramsSchema: actorNameSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("get_actor_properties", {
						name: actorNameParam(params),
					}),
				),
		},
		actor_materials: {
			paramsSchema: actorNameSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("get_actor_material_info", {
						name: actorNameParam(params),
					}),
				),
		},
		blueprint: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...blueprintNameShape,
						include_nodes: z.boolean().optional(),
					})
					.strict(),
				["blueprint_name", "asset_path", "name"],
				"Provide blueprint_name, asset_path, or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEBlueprintAnalysisTool("read_blueprint_content", {
						blueprint_name: blueprintNameParam(params),
						include_nodes: Boolean(params.include_nodes),
					}),
				),
		},
		map: { handler: () => pythonDispatch(editorTools.UEGetMapInfo()) },
	})

	registerToolNamespace("manage_tools", ctx.toolDescription("manage_tools"), {
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
							}
						: {
								success: false,
								message: `Unknown tool namespace: ${toolName}`,
								available_tool_namespaces: Array.from(toolNamespaceRegistry.keys()).sort(),
							},
				)
			},
		},
	})
}
