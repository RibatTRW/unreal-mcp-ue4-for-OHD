import { z } from "zod"

import {
	actorNameShape,
	actorNameSchema,
	requireAtLeastOneValue,
	vector3TransformShape,
} from "./namespace-action-schema-fragments.js"
import {
	RegistrationDispatch,
	RegistrationParams,
	RegistrationSchemas,
} from "./registration-context.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

export function worldNavigationVolumeDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const {
		actorNameParam,
		editorTools,
		optionalStringParam,
		pythonDispatch,
		toRotatorArray,
		toRotatorRecord,
		toVector3Array,
		toVector3Record,
	} = ctx

	const volumeSpawnSchema = z
		.object({
			object_class: z.string().optional(),
			class_name: z.string().optional(),
			...actorNameShape,
			...vector3TransformShape,
			properties: z.record(z.any()).optional(),
		})
		.strict()

	return [
		{ name: "manage_volumes", actions: {
		spawn_trigger_volume: {
			paramsSchema: volumeSpawnSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UECreateObject(
						optionalStringParam(params, ["object_class", "class_name"]) ??
							"/Script/Engine.TriggerVolume",
						optionalStringParam(params, ["name", "actor_name"]) ?? "TriggerVolume",
						toVector3Record(params.location),
						toRotatorRecord(params.rotation),
						toVector3Record(params.scale),
						params.properties,
					),
				),
		},
		spawn_blocking_volume: {
			paramsSchema: volumeSpawnSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UECreateObject(
						optionalStringParam(params, ["object_class", "class_name"]) ??
							"/Script/Engine.BlockingVolume",
						optionalStringParam(params, ["name", "actor_name"]) ?? "BlockingVolume",
						toVector3Record(params.location),
						toRotatorRecord(params.rotation),
						toVector3Record(params.scale),
						params.properties,
					),
				),
		},
		spawn_physics_volume: {
			paramsSchema: volumeSpawnSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UECreateObject(
						optionalStringParam(params, ["object_class", "class_name"]) ??
							"/Script/Engine.PhysicsVolume",
						optionalStringParam(params, ["name", "actor_name"]) ?? "PhysicsVolume",
						toVector3Record(params.location),
						toRotatorRecord(params.rotation),
						toVector3Record(params.scale),
						params.properties,
					),
				),
		},
		spawn_audio_volume: {
			paramsSchema: volumeSpawnSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UECreateObject(
						optionalStringParam(params, ["object_class", "class_name"]) ??
							"/Script/Engine.AudioVolume",
						optionalStringParam(params, ["name", "actor_name"]) ?? "AudioVolume",
						toVector3Record(params.location),
						toRotatorRecord(params.rotation),
						toVector3Record(params.scale),
						params.properties,
					),
				),
		},
		delete_volume: {
			paramsSchema: actorNameSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("delete_actor", {
						name: actorNameParam(params),
					}),
				),
		},
		transform_volume: {
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
		} },
		{ name: "manage_navigation", actions: {
		spawn_nav_mesh_bounds_volume: {
			paramsSchema: volumeSpawnSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UECreateObject(
						optionalStringParam(params, ["object_class", "class_name"]) ??
							"/Script/NavigationSystem.NavMeshBoundsVolume",
						optionalStringParam(params, ["name", "actor_name"]) ?? "NavMeshBoundsVolume",
						toVector3Record(params.location),
						toRotatorRecord(params.rotation),
						toVector3Record(params.scale),
						params.properties,
					),
				),
		},
		spawn_nav_modifier_volume: {
			paramsSchema: volumeSpawnSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UECreateObject(
						optionalStringParam(params, ["object_class", "class_name"]) ??
							"/Script/NavigationSystem.NavModifierVolume",
						optionalStringParam(params, ["name", "actor_name"]) ?? "NavModifierVolume",
						toVector3Record(params.location),
						toRotatorRecord(params.rotation),
						toVector3Record(params.scale),
						params.properties,
					),
				),
		},
		spawn_nav_link_proxy: {
			paramsSchema: volumeSpawnSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UECreateObject(
						optionalStringParam(params, ["object_class", "class_name"]) ??
							"/Script/AIModule.NavLinkProxy",
						optionalStringParam(params, ["name", "actor_name"]) ?? "NavLinkProxy",
						toVector3Record(params.location),
						toRotatorRecord(params.rotation),
						toVector3Record(params.scale),
						params.properties,
					),
				),
		},
		inspect_navigation: {
			handler: () => pythonDispatch(editorTools.UEGetMapInfo()),
		},
		} },
	]
}
