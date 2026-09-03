import { z } from "zod"

import {
	blueprintNameShape,
	assetLookupSchema,
	requireAtLeastOneValue,
	searchAssetsShape,
	vector3TransformShape,
} from "./namespace-action-schema-fragments.js"
import {
	RegistrationDispatch,
	RegistrationParams,
	RegistrationSchemas,
} from "./registration-context.js"

export function registerGameplayNamespaces(ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch) {
	const {
		blueprintNameParam,
		editorTools,
		optionalStringParam,
		pythonDispatch,
		registerToolNamespace,
		requiredStringParam,
		searchAssetsCommand,
		toRotatorArray,
		toVector3Array,
		toolDescription,
	} = ctx

	const blueprintTargetNoNameShape = {
		blueprint_name: z.string().optional(),
		asset_path: z.string().optional(),
	}

	registerToolNamespace("manage_animation_physics", toolDescription("manage_animation_physics"), {
		spawn_physics_blueprint_actor: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...blueprintTargetNoNameShape,
						name: z.string().optional(),
						actor_name: z.string().optional(),
						...vector3TransformShape,
						component_name: z.string().optional(),
						material_path: z.string().optional(),
						slot_index: z.number().optional(),
						simulate_physics: z.boolean().optional(),
						gravity_enabled: z.boolean().optional(),
						mass: z.number().optional(),
						linear_damping: z.number().optional(),
						angular_damping: z.number().optional(),
					})
					.strict(),
				["blueprint_name", "asset_path"],
				"Provide blueprint_name or asset_path for the Blueprint.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEMaterialTool("spawn_physics_blueprint_actor", {
						blueprint_name: requiredStringParam(params, ["blueprint_name", "asset_path"]),
						name: optionalStringParam(params, ["name", "actor_name"]),
						location: toVector3Array(params.location),
						rotation: toRotatorArray(params.rotation),
						scale: toVector3Array(params.scale),
						component_name: optionalStringParam(params, ["component_name"]),
						material_path: optionalStringParam(params, ["material_path"]),
						slot_index: params.slot_index,
						simulate_physics: params.simulate_physics,
						gravity_enabled: params.gravity_enabled,
						mass: params.mass,
						linear_damping: params.linear_damping,
						angular_damping: params.angular_damping,
					}),
				),
		},
		set_physics_properties: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...blueprintNameShape,
						component_name: z.string(),
						simulate_physics: z.boolean().optional(),
						gravity_enabled: z.boolean().optional(),
						mass: z.number().optional(),
						linear_damping: z.number().optional(),
						angular_damping: z.number().optional(),
					})
					.strict(),
				["blueprint_name", "asset_path", "name"],
				"Provide blueprint_name, asset_path, or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEBlueprintTool("set_physics_properties", {
						blueprint_name: blueprintNameParam(params),
						component_name: requiredStringParam(params, ["component_name"]),
						simulate_physics: params.simulate_physics,
						gravity_enabled: params.gravity_enabled,
						mass: params.mass,
						linear_damping: params.linear_damping,
						angular_damping: params.angular_damping,
					}),
				),
		},
		compile_blueprint: {
			paramsSchema: requireAtLeastOneValue(
				z.object(blueprintNameShape).strict(),
				["blueprint_name", "asset_path", "name"],
				"Provide blueprint_name, asset_path, or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEBlueprintTool("compile_blueprint", {
						blueprint_name: blueprintNameParam(params),
					}),
				),
		},
	})

	registerToolNamespace("manage_input", toolDescription("manage_input"), {
		create_input_mapping: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						mapping_name: z.string().optional(),
						action_name: z.string().optional(),
						name: z.string().optional(),
						key: z.string(),
						input_type: z.string().optional(),
						scale: z.number().optional(),
					})
					.strict(),
				["mapping_name", "action_name", "name"],
				"Provide mapping_name, action_name, or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEProjectTool("create_input_mapping", {
						mapping_name: requiredStringParam(params, ["mapping_name", "action_name", "name"]),
						key: requiredStringParam(params, ["key"]),
						input_type: optionalStringParam(params, ["input_type"]) ?? "Action",
						scale: params.scale,
					}),
				),
		},
	})

	registerToolNamespace("manage_behavior_tree", toolDescription("manage_behavior_tree"), {
		create_behavior_tree: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						name: z.string().optional(),
						asset_name: z.string().optional(),
						path: z.string().optional(),
					})
					.strict(),
				["name", "asset_name"],
				"Provide name or asset_name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEContentFactoryTool("create_behavior_tree", {
						name: requiredStringParam(params, ["name", "asset_name"]),
						path: optionalStringParam(params, ["path"]),
					}),
				),
		},
		search_behavior_trees: {
			paramsSchema: z.object(searchAssetsShape).strict(),
			handler: (params) => pythonDispatch(searchAssetsCommand(params, "BehaviorTree")),
		},
		search_ai_assets: {
			paramsSchema: z.object(searchAssetsShape).strict(),
			handler: (params) => pythonDispatch(searchAssetsCommand(params, "BehaviorTree")),
		},
		behavior_tree_info: {
			paramsSchema: assetLookupSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"])),
				),
		},
	})

	registerToolNamespace("manage_gas", toolDescription("manage_gas"), {
		search_gas_assets: {
			paramsSchema: z.object(searchAssetsShape).strict(),
			handler: (params) => pythonDispatch(searchAssetsCommand(params)),
		},
		asset_info: {
			paramsSchema: assetLookupSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"])),
				),
		},
	})
}
