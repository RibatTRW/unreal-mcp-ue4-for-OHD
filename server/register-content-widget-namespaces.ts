import { Effect } from "effect"
import { z } from "zod"
import type { ToolError } from "./effect/errors.js"

import {
	assetPathParam,
	childWidgetNameKeys,
	childWidgetNameMessage,
	materialColorShape,
	requireAtLeastOneValue,
	requireValueGroups,
	strictObject,
	vector2PlacementShape,
	widgetBlueprintAssetKeys,
	widgetBlueprintAssetMessage,
	widgetBlueprintAssetShape,
	widgetBlueprintKeys,
	widgetBlueprintMessage,
	widgetBlueprintShape,
	widgetNameKeys,
	widgetNameMessage,
} from "./namespace-action-schema-fragments.js"
import type { RegistrationDispatch, RegistrationParams, RegistrationSchemas } from "./registration-context.js"
import type { ToolCatalogEntry } from "./tool-catalog-types.js"
import { createToolDescriptionLookup } from "./tool-catalog-types.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

/**
 * Catalog entries co-located with the namespace registration below.
 * Adding a tool here needs no edit to a separate catalog file.
 */
export const contentWidgetEntries: ToolCatalogEntry[] = [
	{
		name: "manage_widget",
		category: "Content & Authoring Tool Namespaces",
		description:
			"Widget tool namespace for UMG Blueprint creation, widget-tree inspection, widget-tree edits, CanvasPanel root normalization, and viewport spawning actions. Use inspect_tree to verify designer contents, add_child_widget for nested layout work, and ensure_canvas_root when absolute CanvasPanel positioning is required.",
	},
]

const describeTool = createToolDescriptionLookup(contentWidgetEntries)

export function contentWidgetDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const {
		editorTools,
		optionalStringParam,
		pythonDispatch,
		requiredStringParam,
		toColorArray,
		toVector2Array,
		toVector2Record,
		vector2InputSchema,
		widgetBlueprintParam,
	} = ctx

	const requireWidgetBlueprintSelection = <S extends z.ZodRawShape>(shape: S) =>
		requireValueGroups(strictObject({ ...widgetBlueprintShape, ...shape }), [
			{ keys: widgetBlueprintKeys, message: widgetBlueprintMessage },
		])

	const requireNamedWidgetBlueprintSelection = <S extends z.ZodRawShape>(shape: S, nameKeys: string[], nameMessage: string) =>
		requireValueGroups(strictObject({ ...widgetBlueprintShape, ...shape }), [
			{ keys: widgetBlueprintKeys, message: widgetBlueprintMessage },
			{ keys: nameKeys, message: nameMessage },
		])

	const requireWidgetAssetAndName = <S extends z.ZodRawShape>(
		shape: S,
		nameKeys = widgetNameKeys,
		nameMessage = widgetNameMessage,
	) =>
		requireValueGroups(strictObject({ ...widgetBlueprintAssetShape, ...shape }), [
			{ keys: widgetBlueprintAssetKeys, message: widgetBlueprintAssetMessage },
			{ keys: nameKeys, message: nameMessage },
		])

	const placementShape = {
		position: vector2InputSchema.optional(),
		size: vector2InputSchema.optional(),
		z_order: z.number().optional(),
	}

	return [
		{
			name: "manage_widget",
			description: describeTool("manage_widget"),
			actions: {
				create_widget_blueprint: {
					paramsSchema: requireAtLeastOneValue(
						strictObject({
							widget_name: z.string().optional(),
							name: z.string().optional(),
							asset_path: assetPathParam,
							widget_path: z.string().optional(),
							parent_class: z.string().optional(),
							path: z.string().optional(),
						}),
						["widget_name", "name", "asset_path", "widget_path"],
						"Provide widget_name, name, asset_path, or widget_path.",
					),
					// Phase 5d (report §5): handler returns Effect; param-helper
					// and builder throws become channel failures via Effect.try
					// (Effect.sync would defect past dispatch's catchAll and break
					// the identical envelope), rendered verbatim downstream.
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGTool("create_umg_widget_blueprint", {
										widget_name: requiredStringParam(params, ["widget_name", "name", "asset_path", "widget_path"]),
										parent_class: optionalStringParam(params, ["parent_class"]),
										path: optionalStringParam(params, ["path"]),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				ensure_canvas_root: {
					paramsSchema: requireWidgetBlueprintSelection({
						root_widget_name: z.string().optional(),
						root_name: z.string().optional(),
						wrap_existing_root: z.boolean().optional(),
					}),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGTool("ensure_canvas_root", {
										widget_name: widgetBlueprintParam(params),
										root_widget_name: optionalStringParam(params, ["root_widget_name", "root_name"]),
										wrap_existing_root: params.wrap_existing_root !== false,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				inspect_tree: {
					paramsSchema: requireWidgetBlueprintSelection({}),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGTool("inspect_widget_tree", {
										widget_name: widgetBlueprintParam(params),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				add_text_block: {
					paramsSchema: requireNamedWidgetBlueprintSelection(
						{
							text_block_name: z.string().optional(),
							name: z.string().optional(),
							text: z.string().optional(),
							...vector2PlacementShape,
							font_size: z.number().optional(),
							z_order: z.number().optional(),
							...materialColorShape,
						},
						["text_block_name", "name"],
						"Provide text_block_name or name.",
					),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGTool("add_text_block_to_widget", {
										widget_name: widgetBlueprintParam(params),
										text_block_name: requiredStringParam(params, ["text_block_name", "name"]),
										text: optionalStringParam(params, ["text"]),
										position: toVector2Array(params.position),
										size: toVector2Array(params.size),
										font_size: params.font_size,
										z_order: params.z_order,
										color: toColorArray(params.color),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				add_button: {
					paramsSchema: requireNamedWidgetBlueprintSelection(
						{
							button_name: z.string().optional(),
							name: z.string().optional(),
							text: z.string().optional(),
							...vector2PlacementShape,
							font_size: z.number().optional(),
							z_order: z.number().optional(),
							...materialColorShape,
							background_color: ctx.colorInputSchema.optional(),
						},
						["button_name", "name"],
						"Provide button_name or name.",
					),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGTool("add_button_to_widget", {
										widget_name: widgetBlueprintParam(params),
										button_name: requiredStringParam(params, ["button_name", "name"]),
										text: optionalStringParam(params, ["text"]),
										position: toVector2Array(params.position),
										size: toVector2Array(params.size),
										font_size: params.font_size,
										z_order: params.z_order,
										color: toColorArray(params.color),
										background_color: toColorArray(params.background_color),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				add_to_viewport: {
					paramsSchema: requireWidgetBlueprintSelection({
						z_order: z.number().optional(),
						start_pie_if_needed: z.boolean().optional(),
						auto_start_pie: z.boolean().optional(),
						timeout_seconds: z.number().optional(),
						poll_interval: z.number().optional(),
					}),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGTool("add_widget_to_viewport", {
										widget_name: widgetBlueprintParam(params),
										z_order: params.z_order,
										start_pie_if_needed: params.start_pie_if_needed,
										auto_start_pie: params.auto_start_pie,
										timeout_seconds: params.timeout_seconds,
										poll_interval: params.poll_interval,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				add_widget: {
					paramsSchema: requireWidgetAssetAndName({
						widget_class: z.string(),
						widget_name: z.string().optional(),
						name: z.string().optional(),
						parent_widget_name: z.string().optional(),
						...placementShape,
						background_color: ctx.colorInputSchema.optional(),
					}),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGAddWidget(
										requiredStringParam(params, [
											"widget_blueprint_path",
											"widget_blueprint",
											"widget_path",
											"asset_path",
										]),
										requiredStringParam(params, ["widget_class"]),
										requiredStringParam(params, ["widget_name", "name"]),
										optionalStringParam(params, ["parent_widget_name"]),
										toVector2Record(params.position),
										toVector2Record(params.size),
										toColorArray(params.background_color),
										typeof params.z_order === "number" ? params.z_order : undefined,
									),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				remove_widget: {
					paramsSchema: requireWidgetAssetAndName({
						widget_name: z.string().optional(),
						name: z.string().optional(),
					}),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGRemoveWidget(
										requiredStringParam(params, [
											"widget_blueprint_path",
											"widget_blueprint",
											"widget_path",
											"asset_path",
										]),
										requiredStringParam(params, ["widget_name", "name"]),
									),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				position_widget: {
					paramsSchema: requireAtLeastOneValue(
						requireWidgetAssetAndName({
							widget_name: z.string().optional(),
							name: z.string().optional(),
							...placementShape,
						}),
						["position", "size", "z_order"],
						"Provide position, size, or z_order.",
					),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGSetWidgetPosition(
										requiredStringParam(params, [
											"widget_blueprint_path",
											"widget_blueprint",
											"widget_path",
											"asset_path",
										]),
										requiredStringParam(params, ["widget_name", "name"]),
										toVector2Record(params.position),
										toVector2Record(params.size),
										typeof params.z_order === "number" ? params.z_order : undefined,
									),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				reparent_widget: {
					paramsSchema: requireWidgetAssetAndName({
						widget_name: z.string().optional(),
						name: z.string().optional(),
						new_parent_widget_name: z.string(),
						...placementShape,
					}),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGReparentWidget(
										requiredStringParam(params, [
											"widget_blueprint_path",
											"widget_blueprint",
											"widget_path",
											"asset_path",
										]),
										requiredStringParam(params, ["widget_name", "name"]),
										requiredStringParam(params, ["new_parent_widget_name"]),
										toVector2Record(params.position),
										toVector2Record(params.size),
										typeof params.z_order === "number" ? params.z_order : undefined,
									),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				add_child_widget: {
					paramsSchema: requireWidgetAssetAndName(
						{
							parent_widget_name: z.string(),
							child_widget_class: z.string(),
							child_widget_name: z.string().optional(),
							name: z.string().optional(),
							text: z.string().optional(),
							...placementShape,
							font_size: z.number().optional(),
							...materialColorShape,
							background_color: ctx.colorInputSchema.optional(),
						},
						childWidgetNameKeys,
						childWidgetNameMessage,
					),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGAddChildWidget(
										requiredStringParam(params, [
											"widget_blueprint_path",
											"widget_blueprint",
											"widget_path",
											"asset_path",
										]),
										requiredStringParam(params, ["parent_widget_name"]),
										requiredStringParam(params, ["child_widget_class"]),
										requiredStringParam(params, ["child_widget_name", "name"]),
										toVector2Record(params.position),
										toVector2Record(params.size),
										optionalStringParam(params, ["text"]),
										typeof params.font_size === "number" ? params.font_size : undefined,
										toColorArray(params.color),
										toColorArray(params.background_color),
										typeof params.z_order === "number" ? params.z_order : undefined,
									),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				remove_child_widget: {
					paramsSchema: requireWidgetAssetAndName(
						{
							parent_widget_name: z.string(),
							child_widget_name: z.string().optional(),
							name: z.string().optional(),
						},
						childWidgetNameKeys,
						childWidgetNameMessage,
					),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGRemoveChildWidget(
										requiredStringParam(params, [
											"widget_blueprint_path",
											"widget_blueprint",
											"widget_path",
											"asset_path",
										]),
										requiredStringParam(params, ["parent_widget_name"]),
										requiredStringParam(params, ["child_widget_name", "name"]),
									),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				position_child_widget: {
					paramsSchema: requireAtLeastOneValue(
						requireWidgetAssetAndName(
							{
								parent_widget_name: z.string(),
								child_widget_name: z.string().optional(),
								name: z.string().optional(),
								...placementShape,
							},
							childWidgetNameKeys,
							childWidgetNameMessage,
						),
						["position", "size", "z_order"],
						"Provide position, size, or z_order.",
					),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGSetChildWidgetPosition(
										requiredStringParam(params, [
											"widget_blueprint_path",
											"widget_blueprint",
											"widget_path",
											"asset_path",
										]),
										requiredStringParam(params, ["parent_widget_name"]),
										requiredStringParam(params, ["child_widget_name", "name"]),
										toVector2Record(params.position),
										toVector2Record(params.size),
										typeof params.z_order === "number" ? params.z_order : undefined,
									),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				setup_sidebar_tab: {
					paramsSchema: requireWidgetBlueprintSelection({
						url: z
							.string()
							.describe(
								"Initial URL loaded by the sidebar browser (e.g. the harness web GUI address). Accepts any page URL; DSH asset/browser names stay, non-DSH pages get no editor loop and face the 4.25 CEF gate",
							),
						browser_widget_name: z
							.string()
							.optional()
							.describe("Optional browser child widget name (defaults to DSHBrowser)"),
						name: z.string().optional().describe("Alias for browser_widget_name"),
						open_tab: z.boolean().optional().describe("Open the widget as an editor tab when true (default)"),
						use_template: z
							.boolean()
							.optional()
							.describe(
								"Duplicate the golden sidebar template (EUW + browser + On Key Down shortcut fix) when the target is missing, instead of building from scratch. Existing targets are reused untouched. Falls back to scratch build with a warning when the template is unavailable.",
							),
					}),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEUMGSetupSidebarTab(
										requiredStringParam(params, [
											"widget_blueprint_path",
											"widget_blueprint",
											"widget_path",
											"asset_path",
										]),
										requiredStringParam(params, ["url"]),
										optionalStringParam(params, ["browser_widget_name", "name"]),
										typeof params.open_tab === "boolean" ? params.open_tab : undefined,
										typeof params.use_template === "boolean" ? params.use_template : undefined,
									),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
			},
			options: { compactParamsSchema: true },
		},
	]
}
