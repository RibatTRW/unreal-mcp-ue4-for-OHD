import { z } from "zod"

import {
	materialColorShape,
	requireAtLeastOneValue,
	vector2PlacementShape,
	widgetBlueprintShape,
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
		widgetBlueprintParam,
	} = ctx

	registerToolNamespace("manage_widget", ctx.toolDescription("manage_widget"), {
		create_widget_blueprint: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						widget_name: z.string().optional(),
						name: z.string().optional(),
						parent_class: z.string().optional(),
						path: z.string().optional(),
					})
					.strict(),
				["widget_name", "name"],
				"Provide widget_name or name.",
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
			paramsSchema: requireAtLeastOneValue(
				requireAtLeastOneValue(
					z
						.object({
							...widgetBlueprintShape,
							text_block_name: z.string().optional(),
							name: z.string().optional(),
							text: z.string().optional(),
							...vector2PlacementShape,
							font_size: z.number().optional(),
							...materialColorShape,
						})
						.strict(),
					["widget_blueprint", "widget_blueprint_path", "widget_name", "blueprint_name"],
					"Provide widget_blueprint, widget_blueprint_path, widget_name, or blueprint_name.",
				),
				["text_block_name", "name"],
				"Provide text_block_name or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGTool("add_text_block_to_widget", {
						widget_name: widgetBlueprintParam(params),
						text_block_name: requiredStringParam(params, ["text_block_name", "name"]),
						text: optionalStringParam(params, ["text"]),
						position: toVector2Array(params.position as any),
						size: toVector2Array(params.size as any),
						font_size: params.font_size,
						color: toColorArray(params.color as any),
					}),
				),
		},
		add_button: {
			paramsSchema: requireAtLeastOneValue(
				requireAtLeastOneValue(
					z
						.object({
							...widgetBlueprintShape,
							button_name: z.string().optional(),
							name: z.string().optional(),
							text: z.string().optional(),
							...vector2PlacementShape,
							font_size: z.number().optional(),
							...materialColorShape,
							background_color: z
								.union([
									z.object({
										r: z.number(),
										g: z.number(),
										b: z.number(),
										a: z.number().optional(),
									}),
									z.tuple([z.number(), z.number(), z.number(), z.number()]),
								])
								.optional(),
						})
						.strict(),
					["widget_blueprint", "widget_blueprint_path", "widget_name", "blueprint_name"],
					"Provide widget_blueprint, widget_blueprint_path, widget_name, or blueprint_name.",
				),
				["button_name", "name"],
				"Provide button_name or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGTool("add_button_to_widget", {
						widget_name: widgetBlueprintParam(params),
						button_name: requiredStringParam(params, ["button_name", "name"]),
						text: optionalStringParam(params, ["text"]),
						position: toVector2Array(params.position as any),
						size: toVector2Array(params.size as any),
						font_size: params.font_size,
						color: toColorArray(params.color as any),
						background_color: toColorArray(params.background_color as any),
					}),
				),
		},
		add_to_viewport: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...widgetBlueprintShape,
						z_order: z.number().optional(),
					})
					.strict(),
				["widget_blueprint", "widget_blueprint_path", "widget_name", "blueprint_name"],
				"Provide widget_blueprint, widget_blueprint_path, widget_name, or blueprint_name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGTool("add_widget_to_viewport", {
						widget_name: widgetBlueprintParam(params),
						z_order: params.z_order,
					}),
				),
		},
		add_widget: {
			paramsSchema: requireAtLeastOneValue(
				requireAtLeastOneValue(
					z
						.object({
							widget_blueprint_path: z.string().optional(),
							widget_blueprint: z.string().optional(),
							widget_class: z.string(),
							widget_name: z.string().optional(),
							name: z.string().optional(),
							parent_widget_name: z.string().optional(),
							position: z
								.union([z.object({ x: z.number(), y: z.number() }), z.tuple([z.number(), z.number()])])
								.optional(),
							z_order: z.number().optional(),
						})
						.strict(),
					["widget_blueprint_path", "widget_blueprint"],
					"Provide widget_blueprint_path or widget_blueprint.",
				),
				["widget_name", "name"],
				"Provide widget_name or name.",
			),
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
			paramsSchema: requireAtLeastOneValue(
				requireAtLeastOneValue(
					z
						.object({
							widget_blueprint_path: z.string().optional(),
							widget_blueprint: z.string().optional(),
							widget_name: z.string().optional(),
							name: z.string().optional(),
						})
						.strict(),
					["widget_blueprint_path", "widget_blueprint"],
					"Provide widget_blueprint_path or widget_blueprint.",
				),
				["widget_name", "name"],
				"Provide widget_name or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEUMGRemoveWidget(
						requiredStringParam(params, ["widget_blueprint_path", "widget_blueprint"]),
						requiredStringParam(params, ["widget_name", "name"]),
					),
				),
		},
		position_widget: {
			paramsSchema: requireAtLeastOneValue(
				requireAtLeastOneValue(
					z
						.object({
							widget_blueprint_path: z.string().optional(),
							widget_blueprint: z.string().optional(),
							widget_name: z.string().optional(),
							name: z.string().optional(),
							position: z
								.union([z.object({ x: z.number(), y: z.number() }), z.tuple([z.number(), z.number()])]),
							z_order: z.number().optional(),
						})
						.strict(),
					["widget_blueprint_path", "widget_blueprint"],
					"Provide widget_blueprint_path or widget_blueprint.",
				),
				["widget_name", "name"],
				"Provide widget_name or name.",
			),
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
			paramsSchema: requireAtLeastOneValue(
				requireAtLeastOneValue(
					z
						.object({
							widget_blueprint_path: z.string().optional(),
							widget_blueprint: z.string().optional(),
							widget_name: z.string().optional(),
							name: z.string().optional(),
							new_parent_widget_name: z.string(),
							position: z
								.union([z.object({ x: z.number(), y: z.number() }), z.tuple([z.number(), z.number()])])
								.optional(),
							z_order: z.number().optional(),
						})
						.strict(),
					["widget_blueprint_path", "widget_blueprint"],
					"Provide widget_blueprint_path or widget_blueprint.",
				),
				["widget_name", "name"],
				"Provide widget_name or name.",
			),
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
			paramsSchema: requireAtLeastOneValue(
				requireAtLeastOneValue(
					z
						.object({
							widget_blueprint_path: z.string().optional(),
							widget_blueprint: z.string().optional(),
							parent_widget_name: z.string(),
							child_widget_class: z.string(),
							child_widget_name: z.string().optional(),
							name: z.string().optional(),
							position: z
								.union([z.object({ x: z.number(), y: z.number() }), z.tuple([z.number(), z.number()])])
								.optional(),
							z_order: z.number().optional(),
						})
						.strict(),
					["widget_blueprint_path", "widget_blueprint"],
					"Provide widget_blueprint_path or widget_blueprint.",
				),
				["child_widget_name", "name"],
				"Provide child_widget_name or name.",
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
			paramsSchema: requireAtLeastOneValue(
				requireAtLeastOneValue(
					z
						.object({
							widget_blueprint_path: z.string().optional(),
							widget_blueprint: z.string().optional(),
							parent_widget_name: z.string(),
							child_widget_name: z.string().optional(),
							name: z.string().optional(),
						})
						.strict(),
					["widget_blueprint_path", "widget_blueprint"],
					"Provide widget_blueprint_path or widget_blueprint.",
				),
				["child_widget_name", "name"],
				"Provide child_widget_name or name.",
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
			paramsSchema: requireAtLeastOneValue(
				requireAtLeastOneValue(
					z
						.object({
							widget_blueprint_path: z.string().optional(),
							widget_blueprint: z.string().optional(),
							parent_widget_name: z.string(),
							child_widget_name: z.string().optional(),
							name: z.string().optional(),
							position: z
								.union([z.object({ x: z.number(), y: z.number() }), z.tuple([z.number(), z.number()])]),
							z_order: z.number().optional(),
						})
						.strict(),
					["widget_blueprint_path", "widget_blueprint"],
					"Provide widget_blueprint_path or widget_blueprint.",
				),
				["child_widget_name", "name"],
				"Provide child_widget_name or name.",
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
