import { z } from "zod"

import {
	blueprintNameShape,
	requireAtLeastOneValue,
	vector3TransformShape,
} from "./namespace-action-schema-fragments.js"
import {
	RegistrationDispatch,
	RegistrationParams,
	RegistrationSchemas,
} from "./registration-context.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

export function contentBlueprintDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const {
		blueprintNameParam,
		editorTools,
		optionalStringParam,
		pythonDispatch,
		requiredStringParam,
		toRotatorArray,
		toVector3Array,
	} = ctx

	const blueprintTargetNoNameShape = {
		blueprint_name: z.string().optional(),
		asset_path: z.string().optional(),
	}

	return [
		{ name: "manage_blueprint", actions: {
		create_blueprint: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						name: z.string().optional(),
						blueprint_name: z.string().optional(),
						parent_class: z.string().optional(),
						path: z.string().optional(),
					})
					.strict(),
				["name", "blueprint_name"],
				"Provide name or blueprint_name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEBlueprintTool("create_blueprint", {
						name: requiredStringParam(params, ["name", "blueprint_name"]),
						parent_class: optionalStringParam(params, ["parent_class"]),
						path: optionalStringParam(params, ["path"]),
					}),
				),
		},
		add_component: {
			paramsSchema: requireAtLeastOneValue(
				requireAtLeastOneValue(
					requireAtLeastOneValue(
						z
							.object({
								...blueprintTargetNoNameShape,
								component_type: z.string().optional(),
								class_name: z.string().optional(),
								component_name: z.string().optional(),
								name: z.string().optional(),
								...vector3TransformShape,
								component_properties: z.record(z.any()).optional(),
								parent_component_name: z.string().optional(),
							})
							.strict(),
						["blueprint_name", "asset_path"],
						"Provide blueprint_name or asset_path for the target Blueprint.",
					),
					["component_type", "class_name"],
					"Provide component_type or class_name.",
				),
				["component_name", "name"],
				"Provide component_name or name for the new component.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEBlueprintTool("add_component_to_blueprint", {
						blueprint_name: requiredStringParam(params, ["blueprint_name", "asset_path"]),
						component_type: requiredStringParam(params, ["component_type", "class_name"]),
						component_name: requiredStringParam(params, ["component_name", "name"]),
						location: toVector3Array(params.location),
						rotation: toRotatorArray(params.rotation),
						scale: toVector3Array(params.scale),
						component_properties: params.component_properties,
						parent_component_name: optionalStringParam(params, ["parent_component_name"]),
					}),
				),
		},
		set_static_mesh: {
			paramsSchema: requireAtLeastOneValue(
				requireAtLeastOneValue(
					z
						.object({
							...blueprintNameShape,
							component_name: z.string(),
							static_mesh: z.string().optional(),
							mesh_path: z.string().optional(),
						})
						.strict(),
					["blueprint_name", "asset_path", "name"],
					"Provide blueprint_name, asset_path, or name.",
				),
				["static_mesh", "mesh_path"],
				"Provide static_mesh or mesh_path.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEBlueprintTool("set_static_mesh_properties", {
						blueprint_name: blueprintNameParam(params),
						component_name: requiredStringParam(params, ["component_name"]),
						static_mesh: requiredStringParam(params, ["static_mesh", "mesh_path"]),
					}),
				),
		},
		set_component_property: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...blueprintNameShape,
						component_name: z.string(),
						property_name: z.string(),
						property_value: z.any().optional(),
					})
					.strict(),
				["blueprint_name", "asset_path", "name"],
				"Provide blueprint_name, asset_path, or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEBlueprintTool("set_component_property", {
						blueprint_name: blueprintNameParam(params),
						component_name: requiredStringParam(params, ["component_name"]),
						property_name: requiredStringParam(params, ["property_name"]),
						property_value: params.property_value,
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
		set_blueprint_property: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...blueprintNameShape,
						property_name: z.string(),
						property_value: z.any().optional(),
					})
					.strict(),
				["blueprint_name", "asset_path", "name"],
				"Provide blueprint_name, asset_path, or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEBlueprintTool("set_blueprint_property", {
						blueprint_name: blueprintNameParam(params),
						property_name: requiredStringParam(params, ["property_name"]),
						property_value: params.property_value,
					}),
				),
		},
		compile: {
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
		read: {
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
		} },
	]
}
