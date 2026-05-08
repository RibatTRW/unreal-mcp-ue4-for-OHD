import { z } from "zod"

import {
	childWidgetNameKeys,
	childWidgetNameMessage,
	materialColorShape,
	requireAtLeastOneValue,
	requireValueGroups,
	strictObject,
	widgetBlueprintAssetKeys,
	widgetBlueprintAssetMessage,
	widgetBlueprintAssetShape,
	widgetBlueprintKeys,
	widgetBlueprintMessage,
	vector2PlacementShape,
	widgetBlueprintShape,
	widgetNameKeys,
	widgetNameMessage,
} from "./namespace-action-schema-fragments.js"
import { RegistrationContext } from "./registration-context.js"

export function registerContentWidgetNamespaces(ctx: RegistrationContext) {
	const {
		editorTools,
		optionalStringParam,
		pythonDispatch,
		registerToolNamespace,
		requiredStringParam,
		toColorArray,
		toVector2Array,
		toVector2Record,
		vector2InputSchema,
		widgetBlueprintParam,
	} = ctx

	const requireWidgetBlueprintSelection = (shape: z.ZodRawShape) =>
		requireValueGroups(strictObject({ ...widgetBlueprintShape, ...shape }), [
			{ keys: widgetBlueprintKeys, message: widgetBlueprintMessage },
		])

	const requireNamedWidgetBlueprintSelection = (shape: z.ZodRawShape, nameKeys: string[], nameMessage: string) =>
		requireValueGroups(strictObject({ ...widgetBlueprintShape, ...shape }), [
			{ keys: widgetBlueprintKeys, message: widgetBlueprintMessage },
			{ keys: nameKeys, message: nameMessage },
		])

	const requireWidgetAssetAndName = (
		shape: z.ZodRawShape,
		nameKeys = widgetNameKeys,
		nameMessage = widgetNameMessage,
	) =>
		requireValueGroups(strictObject({ ...widgetBlueprintAssetShape, ...shape }), [
			{ keys: widgetBlueprintAssetKeys, message: widgetBlueprintAssetMessage },
			{ keys: nameKeys, message: nameMessage },
		])

	const placementShape = {
		position: vector2InputSchema.optional(),
		z_order: z.number().optional(),
	}

	registerToolNamespace("manage_widget", ctx.toolDescription("manage_widget"), {
		create_widget_blueprint: {
			paramsSchema: requireAtLeastOneValue(
				strictObject({
					widget_name: z.string().optional(),
					name: z.string().optional(),
					parent_class: z.string().optional(),
					path: z.string().optional(),
				}),
				widgetNameKeys,
				widgetNameMessage,
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGTool("create_umg_widget_blueprint", {
						widget_name: requiredStringParam(params, ["widget_name", "name"]),
						parent_class: optionalStringParam(params, ["parent_class"]),
						path: optionalStringParam(params, ["path"]),
					}),
				),
		},
		add_text_block: {
			paramsSchema: requireNamedWidgetBlueprintSelection(
				{
					text_block_name: z.string().optional(),
					name: z.string().optional(),
					text: z.string().optional(),
					...vector2PlacementShape,
					font_size: z.number().optional(),
					...materialColorShape,
				},
				["text_block_name", "name"],
				"Provide text_block_name or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGTool("add_text_block_to_widget", {
						widget_name: widgetBlueprintParam(params),
						text_block_name: requiredStringParam(params, ["text_block_name", "name"]),
						text: optionalStringParam(params, ["text"]),
						position: toVector2Array(params.position),
						size: toVector2Array(params.size),
						font_size: params.font_size,
						color: toColorArray(params.color),
					}),
				),
		},
		add_button: {
			paramsSchema: requireNamedWidgetBlueprintSelection(
				{
					button_name: z.string().optional(),
					name: z.string().optional(),
					text: z.string().optional(),
					...vector2PlacementShape,
					font_size: z.number().optional(),
					...materialColorShape,
					background_color: ctx.colorInputSchema.optional(),
				},
				["button_name", "name"],
				"Provide button_name or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGTool("add_button_to_widget", {
						widget_name: widgetBlueprintParam(params),
						button_name: requiredStringParam(params, ["button_name", "name"]),
						text: optionalStringParam(params, ["text"]),
						position: toVector2Array(params.position),
						size: toVector2Array(params.size),
						font_size: params.font_size,
						color: toColorArray(params.color),
						background_color: toColorArray(params.background_color),
					}),
				),
		},
		add_to_viewport: {
			paramsSchema: requireWidgetBlueprintSelection({
				z_order: z.number().optional(),
			}),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGTool("add_widget_to_viewport", {
						widget_name: widgetBlueprintParam(params),
						z_order: params.z_order,
					}),
				),
		},
		add_widget: {
			paramsSchema: requireWidgetAssetAndName({
				widget_class: z.string(),
				widget_name: z.string().optional(),
				name: z.string().optional(),
				parent_widget_name: z.string().optional(),
				...placementShape,
			}),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGAddWidget(
						requiredStringParam(params, ["widget_blueprint_path", "widget_blueprint"]),
						requiredStringParam(params, ["widget_class"]),
						requiredStringParam(params, ["widget_name", "name"]),
						optionalStringParam(params, ["parent_widget_name"]),
						toVector2Record(params.position),
						typeof params.z_order === "number" ? params.z_order : undefined,
					),
				),
		},
		remove_widget: {
			paramsSchema: requireWidgetAssetAndName({
				widget_name: z.string().optional(),
				name: z.string().optional(),
			}),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGRemoveWidget(
						requiredStringParam(params, ["widget_blueprint_path", "widget_blueprint"]),
						requiredStringParam(params, ["widget_name", "name"]),
					),
				),
		},
		position_widget: {
			paramsSchema: requireWidgetAssetAndName({
				widget_name: z.string().optional(),
				name: z.string().optional(),
				position: vector2InputSchema,
				z_order: z.number().optional(),
			}),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGSetWidgetPosition(
						requiredStringParam(params, ["widget_blueprint_path", "widget_blueprint"]),
						requiredStringParam(params, ["widget_name", "name"]),
						toVector2Record(params.position) ?? { x: 0, y: 0 },
						typeof params.z_order === "number" ? params.z_order : undefined,
					),
				),
		},
		reparent_widget: {
			paramsSchema: requireWidgetAssetAndName({
				widget_name: z.string().optional(),
				name: z.string().optional(),
				new_parent_widget_name: z.string(),
				...placementShape,
			}),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGReparentWidget(
						requiredStringParam(params, ["widget_blueprint_path", "widget_blueprint"]),
						requiredStringParam(params, ["widget_name", "name"]),
						requiredStringParam(params, ["new_parent_widget_name"]),
						toVector2Record(params.position),
						typeof params.z_order === "number" ? params.z_order : undefined,
					),
				),
		},
		add_child_widget: {
			paramsSchema: requireWidgetAssetAndName(
				{
					parent_widget_name: z.string(),
					child_widget_class: z.string(),
					child_widget_name: z.string().optional(),
					name: z.string().optional(),
					...placementShape,
				},
				childWidgetNameKeys,
				childWidgetNameMessage,
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGAddChildWidget(
						requiredStringParam(params, ["widget_blueprint_path", "widget_blueprint"]),
						requiredStringParam(params, ["parent_widget_name"]),
						requiredStringParam(params, ["child_widget_class"]),
						requiredStringParam(params, ["child_widget_name", "name"]),
						toVector2Record(params.position),
						typeof params.z_order === "number" ? params.z_order : undefined,
					),
				),
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
				pythonDispatch(
					editorTools.UEUMGRemoveChildWidget(
						requiredStringParam(params, ["widget_blueprint_path", "widget_blueprint"]),
						requiredStringParam(params, ["parent_widget_name"]),
						requiredStringParam(params, ["child_widget_name", "name"]),
					),
				),
		},
		position_child_widget: {
			paramsSchema: requireWidgetAssetAndName(
				{
					parent_widget_name: z.string(),
					child_widget_name: z.string().optional(),
					name: z.string().optional(),
					position: vector2InputSchema,
					z_order: z.number().optional(),
				},
				childWidgetNameKeys,
				childWidgetNameMessage,
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGSetChildWidgetPosition(
						requiredStringParam(params, ["widget_blueprint_path", "widget_blueprint"]),
						requiredStringParam(params, ["parent_widget_name"]),
						requiredStringParam(params, ["child_widget_name", "name"]),
						toVector2Record(params.position) ?? { x: 0, y: 0 },
						typeof params.z_order === "number" ? params.z_order : undefined,
					),
				),
		},
	})
}
