import { Effect } from "effect"
import { z } from "zod"

import type { ToolError } from "./effect/errors.js"
import {
	actorNameSchema,
	actorNameShape,
	assetPathParam,
	blueprintNameShape,
	materialColorShape,
	requireAtLeastOneValue,
	vector3TransformShape,
} from "./namespace-action-schema-fragments.js"
import type { RegistrationDispatch, RegistrationParams, RegistrationSchemas } from "./registration-context.js"
import type { ToolCatalogEntry } from "./tool-catalog-types.js"
import { createToolDescriptionLookup } from "./tool-catalog-types.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

/**
 * Catalog entries co-located with the namespace registration below.
 * Adding a tool here needs no edit to a separate catalog file.
 */
export const worldEffectsSplinesEntries: ToolCatalogEntry[] = [
	{
		name: "manage_splines",
		category: "World & Environment Tool Namespaces",
		description:
			"Spline tool namespace for spawning a spline-host actor or Blueprint and then transforming or deleting it.",
	},
	{
		name: "manage_effect",
		category: "World & Environment Tool Namespaces",
		description:
			"Effects tool namespace for spawning debug-shape actors, assigning materials, tinting them, and deleting them.",
	},
]

const describeTool = createToolDescriptionLookup(worldEffectsSplinesEntries)

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
		asset_path: assetPathParam,
	}

	return [
		{
			name: "manage_splines",
			description: describeTool("manage_splines"),
			actions: {
				spawn_actor: {
					paramsSchema: z
						.object({
							...blueprintTargetNoNameShape,
							object_class: z.string().optional(),
							class_name: z.string().optional(),
							...actorNameShape,
							...vector3TransformShape,
							properties: z.record(z.string(), z.any()).optional(),
						})
						.strict(),
					// Phase 5c (report §5): handler returns Effect; param-helper
					// and builder throws become channel failures via Effect.try
					// (Effect.sync would defect past dispatch's catchAll and break
					// the identical envelope), rendered verbatim downstream.
					handler: (params) =>
						Effect.try({
							try: () => {
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
										// Phase-4 retype: validated params are unknown-typed;
										// the cast recovers the static type, never changes values.
										params.properties as Record<string, unknown> | undefined,
									),
								)
							},
							catch: (cause) => cause as ToolError,
						}),
				},
				transform_actor: {
					paramsSchema: requireAtLeastOneValue(
						z.object({ ...actorNameShape, ...vector3TransformShape }).strict(),
						["name", "actor_name"],
						"Provide name or actor_name.",
					),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("set_actor_transform", {
										name: actorNameParam(params),
										location: toVector3Array(params.location),
										rotation: toRotatorArray(params.rotation),
										scale: toVector3Array(params.scale),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				delete_actor: {
					paramsSchema: actorNameSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("delete_actor", {
										name: actorNameParam(params),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
			},
		},
		{
			name: "manage_effect",
			description: describeTool("manage_effect"),
			actions: {
				spawn_debug_shape: {
					paramsSchema: z
						.object({
							shape: z.string().optional(),
							shape_type: z.string().optional(),
							...actorNameShape,
							material_path: z.string().optional(),
							...vector3TransformShape,
							properties: z.record(z.string(), z.any()).optional(),
						})
						.strict(),
					handler: (params) =>
						Effect.try({
							try: () => {
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
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEMaterialTool("apply_material_to_actor", {
										actor_name: actorNameParam(params),
										component_name: optionalStringParam(params, ["component_name"]),
										material_path: requiredStringParam(params, ["material_path"]),
										slot_index: params.slot_index,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
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
							catch: (cause) => cause as ToolError,
						}),
				},
				delete_debug_shape: {
					paramsSchema: actorNameSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("delete_actor", {
										name: actorNameParam(params),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
			},
		},
	]
}
