import { Effect } from "effect"
import { z } from "zod"

import type { ToolError } from "./effect/errors.js"
import { actorNameShape, requireAtLeastOneValue, vector3TransformShape } from "./namespace-action-schema-fragments.js"
import type { RegistrationDispatch, RegistrationParams, RegistrationSchemas } from "./registration-context.js"
import { sharedReadOnlyActions } from "./shared-read-only-actions.js"
import type { ToolCatalogEntry } from "./tool-catalog-types.js"
import { createToolDescriptionLookup } from "./tool-catalog-types.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

/**
 * Catalog entries co-located with the namespace registration below.
 * Adding a tool here needs no edit to a separate catalog file.
 */
export const worldLightingEntries: ToolCatalogEntry[] = [
	{
		name: "manage_lighting",
		category: "World & Environment Tool Namespaces",
		description:
			"Lighting tool namespace for spawning common light actors, transforming them, and inspecting level lighting state.",
	},
]

const describeTool = createToolDescriptionLookup(worldLightingEntries)

export function worldLightingDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const { actorNameParam, editorTools, optionalStringParam, pythonDispatch, toRotatorArray, toVector3Array } = ctx
	const shared = sharedReadOnlyActions(ctx)

	const lightSpawnSchema = z
		.object({
			...actorNameShape,
			...vector3TransformShape,
		})
		.strict()

	return [
		{
			name: "manage_lighting",
			description: describeTool("manage_lighting"),
			actions: {
				spawn_directional_light: {
					paramsSchema: lightSpawnSchema,
					// Phase 5a: handler returns Effect; param-helper and builder
					// throws become channel failures via Effect.try (Effect.sync
					// would defect past dispatch's catchAll and break the
					// identical envelope), rendered verbatim downstream.
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("spawn_actor", {
										type: "DirectionalLight",
										name: optionalStringParam(params, ["name", "actor_name"]) ?? "DirectionalLight",
										location: toVector3Array(params.location),
										rotation: toRotatorArray(params.rotation),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				spawn_point_light: {
					paramsSchema: lightSpawnSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("spawn_actor", {
										type: "PointLight",
										name: optionalStringParam(params, ["name", "actor_name"]) ?? "PointLight",
										location: toVector3Array(params.location),
										rotation: toRotatorArray(params.rotation),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				spawn_spot_light: {
					paramsSchema: lightSpawnSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("spawn_actor", {
										type: "SpotLight",
										name: optionalStringParam(params, ["name", "actor_name"]) ?? "SpotLight",
										location: toVector3Array(params.location),
										rotation: toRotatorArray(params.rotation),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				transform_light: {
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
				inspect_lighting: shared.map_info,
			},
		},
	]
}
