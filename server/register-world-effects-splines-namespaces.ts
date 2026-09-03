import { z } from "zod"

import {
	actorNameShape,
	actorNameSchema,
	blueprintNameShape,
	materialColorShape,
	requireAtLeastOneValue,
	vector3TransformShape,
} from "./namespace-action-schema-fragments.js"
import {
	RegistrationDispatch,
	RegistrationParams,
	RegistrationSchemas,
} from "./registration-context.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

export function worldEffectsSplineDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const {
		actorNameParam,
		editorTools,
		optionalStringParam,
		pythonDispatch,
		requiredStringParam,
		toColorArray,
		toRotatorArray,
		toRotatorRecord,
		toVector3Array,
		toVector3Record,
	} = ctx

	const blueprintTargetNoNameShape = {
		blueprint_name: z.string().optional(),
		asset_path: z.string().optional(),
	}

	return [
		{ name: "manage_splines", actions: {
		spawn_actor: {
			paramsSchema: z
				.object({
					...blueprintTargetNoNameShape,
					object_class: z.string().optional(),
					class_name: z.string().optional(),
					...actorNameShape,
					...vector3TransformShape,
					properties: z.record(z.any()).optional(),
				})
				.strict(),
			handler: (params) => {
				const blueprintName = optionalStringParam(params, ["blueprint_name", "asset_path"])
				if (blueprintName) {
					return pythonDispatch(
						editorTools.UEActorTool("spawn_blueprint_actor", {
							blueprint_name: blueprintName,
							name: optionalStringParam(params, ["name", "actor_name"]),
							location: toVector3Array(params.location),
							rotation: toRotatorArray(params.rotation),
							scale: toVector3Array(params.scale),
							properties: params.properties,
						}),
					)
				}

				return pythonDispatch(
					editorTools.UECreateObject(
						optionalStringParam(params, ["object_class", "class_name"]) ?? "/Script/Engine.Actor",
						optionalStringParam(params, ["name", "actor_name"]) ?? "SplineHostActor",
						toVector3Record(params.location),
						toRotatorRecord(params.rotation),
						toVector3Record(params.scale),
						params.properties,
					),
				)
			},
		},
		transform_actor: {
			paramsSchema: requireAtLeastOneValue(
				z.object({ ...actorNameShape, ...vector3TransformShape }).strict(),
				["name", "actor_name"],
				"Provide name or actor_name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("set_actor_transform", {
						name: actorNameParam(params),
						location: toVector3Array(params.location),
						rotation: toRotatorArray(params.rotation),
						scale: toVector3Array(params.scale),
					}),
				),
		},
		delete_actor: {
			paramsSchema: actorNameSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("delete_actor", {
						name: actorNameParam(params),
					}),
				),
		},
		} },
		{ name: "manage_effect", actions: {
		spawn_debug_shape: {
			paramsSchema: z
				.object({
					shape: z.string().optional(),
					shape_type: z.string().optional(),
					...actorNameShape,
					material_path: z.string().optional(),
					...vector3TransformShape,
					properties: z.record(z.any()).optional(),
				})
				.strict(),
			handler: (params) => {
				const shapeName = optionalStringParam(params, ["shape", "shape_type"]) ?? "cube"
				const actorLabel = `${shapeName}_${optionalStringParam(params, ["name", "actor_name"]) ?? "DebugShape"}`
				const properties = {
					...(typeof params.properties === "object" && params.properties ? params.properties : {}),
					...(optionalStringParam(params, ["material_path"])
						? { Material: optionalStringParam(params, ["material_path"]) }
						: {}),
				}

				return pythonDispatch(
					editorTools.UECreateObject(
						"StaticMeshActor",
						actorLabel,
						toVector3Record(params.location),
						toRotatorRecord(params.rotation),
						toVector3Record(params.scale),
						properties,
					),
				)
			},
		},
		apply_material: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...actorNameShape,
						component_name: z.string().optional(),
						material_path: z.string(),
						slot_index: z.number().optional(),
					})
					.strict(),
				["name", "actor_name"],
				"Provide name or actor_name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEMaterialTool("apply_material_to_actor", {
						actor_name: actorNameParam(params),
						component_name: optionalStringParam(params, ["component_name"]),
						material_path: requiredStringParam(params, ["material_path"]),
						slot_index: params.slot_index,
					}),
				),
		},
		tint_debug_shape: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...actorNameShape,
						component_name: z.string().optional(),
						material_path: z.string().optional(),
						slot_index: z.number().optional(),
						...materialColorShape,
						parameter_name: z.string().optional(),
						instance_name: z.string().optional(),
						instance_path: z.string().optional(),
					})
					.strict(),
				["name", "actor_name"],
				"Provide name or actor_name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEMaterialTool("set_mesh_material_color", {
						actor_name: actorNameParam(params),
						component_name: optionalStringParam(params, ["component_name"]),
						material_path: optionalStringParam(params, ["material_path"]),
						slot_index: params.slot_index,
						color: toColorArray(params.color),
						parameter_name: optionalStringParam(params, ["parameter_name"]),
						instance_name: optionalStringParam(params, ["instance_name"]),
						instance_path: optionalStringParam(params, ["instance_path"]),
					}),
				),
		},
		delete_debug_shape: {
			paramsSchema: actorNameSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("delete_actor", {
						name: actorNameParam(params),
					}),
				),
		},
		} },
	]
}
