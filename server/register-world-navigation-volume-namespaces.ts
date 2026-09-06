import { z } from "zod"

import {
	actorNameSchema,
	actorNameShape,
	requireAtLeastOneValue,
	vector3TransformShape,
} from "./namespace-action-schema-fragments.js"
import type { RegistrationDispatch, RegistrationParams, RegistrationSchemas } from "./registration-context.js"
import { sharedReadOnlyActions } from "./shared-read-only-actions.js"
import type { ToolCatalogEntry } from "./tool-catalog-types.js"
import { createToolDescriptionLookup } from "./tool-catalog-types.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

/**
 * Catalog entries co-located with the namespace registration below.
 * Adding a tool here needs no edit to a separate catalog file.
 */
export const worldNavigationVolumeEntries: ToolCatalogEntry[] = [
	{
		name: "manage_volumes",
		category: "World & Environment Tool Namespaces",
		description: "Volume tool namespace for spawning common engine volumes and applying delete or transform actions.",
	},
	{
		name: "manage_navigation",
		category: "World & Environment Tool Namespaces",
		description:
			"Navigation tool namespace for spawning navigation volumes and proxies plus basic map inspection actions.",
	},
]

const describeTool = createToolDescriptionLookup(worldNavigationVolumeEntries)

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
	const shared = sharedReadOnlyActions(ctx)

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
		{
			name: "manage_volumes",
			description: describeTool("manage_volumes"),
			actions: {
				spawn_trigger_volume: {
					paramsSchema: volumeSpawnSchema,
					handler: (params) =>
						pythonDispatch(
							editorTools.UECreateObject(
								optionalStringParam(params, ["object_class", "class_name"]) ?? "/Script/Engine.TriggerVolume",
								optionalStringParam(params, ["name", "actor_name"]) ?? "TriggerVolume",
								toVector3Record(params.location),
								toRotatorRecord(params.rotation),
								toVector3Record(params.scale),
								// Phase-4 retype: validated params are unknown-typed; cast recovers the static type.
								params.properties as Record<string, unknown> | undefined,
							),
						),
				},
				spawn_blocking_volume: {
					paramsSchema: volumeSpawnSchema,
					handler: (params) =>
						pythonDispatch(
							editorTools.UECreateObject(
								optionalStringParam(params, ["object_class", "class_name"]) ?? "/Script/Engine.BlockingVolume",
								optionalStringParam(params, ["name", "actor_name"]) ?? "BlockingVolume",
								toVector3Record(params.location),
								toRotatorRecord(params.rotation),
								toVector3Record(params.scale),
								// Phase-4 retype: validated params are unknown-typed; cast recovers the static type.
								params.properties as Record<string, unknown> | undefined,
							),
						),
				},
				spawn_physics_volume: {
					paramsSchema: volumeSpawnSchema,
					handler: (params) =>
						pythonDispatch(
							editorTools.UECreateObject(
								optionalStringParam(params, ["object_class", "class_name"]) ?? "/Script/Engine.PhysicsVolume",
								optionalStringParam(params, ["name", "actor_name"]) ?? "PhysicsVolume",
								toVector3Record(params.location),
								toRotatorRecord(params.rotation),
								toVector3Record(params.scale),
								// Phase-4 retype: validated params are unknown-typed; cast recovers the static type.
								params.properties as Record<string, unknown> | undefined,
							),
						),
				},
				spawn_audio_volume: {
					paramsSchema: volumeSpawnSchema,
					handler: (params) =>
						pythonDispatch(
							editorTools.UECreateObject(
								optionalStringParam(params, ["object_class", "class_name"]) ?? "/Script/Engine.AudioVolume",
								optionalStringParam(params, ["name", "actor_name"]) ?? "AudioVolume",
								toVector3Record(params.location),
								toRotatorRecord(params.rotation),
								toVector3Record(params.scale),
								// Phase-4 retype: validated params are unknown-typed; cast recovers the static type.
								params.properties as Record<string, unknown> | undefined,
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
			},
		},
		{
			name: "manage_navigation",
			description: describeTool("manage_navigation"),
			actions: {
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
								// Phase-4 retype: validated params are unknown-typed; cast recovers the static type.
								params.properties as Record<string, unknown> | undefined,
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
								// Phase-4 retype: validated params are unknown-typed; cast recovers the static type.
								params.properties as Record<string, unknown> | undefined,
							),
						),
				},
				spawn_nav_link_proxy: {
					paramsSchema: volumeSpawnSchema,
					handler: (params) =>
						pythonDispatch(
							editorTools.UECreateObject(
								optionalStringParam(params, ["object_class", "class_name"]) ?? "/Script/AIModule.NavLinkProxy",
								optionalStringParam(params, ["name", "actor_name"]) ?? "NavLinkProxy",
								toVector3Record(params.location),
								toRotatorRecord(params.rotation),
								toVector3Record(params.scale),
								// Phase-4 retype: validated params are unknown-typed; cast recovers the static type.
								params.properties as Record<string, unknown> | undefined,
							),
						),
				},
				inspect_navigation: shared.map_info,
			},
		},
	]
}
