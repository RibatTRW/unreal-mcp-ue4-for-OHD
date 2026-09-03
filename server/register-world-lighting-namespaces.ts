import { z } from "zod"

import {
	actorNameShape,
	requireAtLeastOneValue,
	vector3TransformShape,
} from "./namespace-action-schema-fragments.js"
import {
	RegistrationDispatch,
	RegistrationParams,
	RegistrationSchemas,
} from "./registration-context.js"

export function registerWorldLightingNamespaces(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
) {
	const {
		actorNameParam,
		editorTools,
		optionalStringParam,
		pythonDispatch,
		registerToolNamespace,
		toRotatorArray,
		toVector3Array,
	} = ctx

	const lightSpawnSchema = z
		.object({
			...actorNameShape,
			...vector3TransformShape,
		})
		.strict()

	registerToolNamespace("manage_lighting", ctx.toolDescription("manage_lighting"), {
		spawn_directional_light: {
			paramsSchema: lightSpawnSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("spawn_actor", {
						type: "DirectionalLight",
						name: optionalStringParam(params, ["name", "actor_name"]) ?? "DirectionalLight",
						location: toVector3Array(params.location),
						rotation: toRotatorArray(params.rotation),
					}),
				),
		},
		spawn_point_light: {
			paramsSchema: lightSpawnSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("spawn_actor", {
						type: "PointLight",
						name: optionalStringParam(params, ["name", "actor_name"]) ?? "PointLight",
						location: toVector3Array(params.location),
						rotation: toRotatorArray(params.rotation),
					}),
				),
		},
		spawn_spot_light: {
			paramsSchema: lightSpawnSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("spawn_actor", {
						type: "SpotLight",
						name: optionalStringParam(params, ["name", "actor_name"]) ?? "SpotLight",
						location: toVector3Array(params.location),
						rotation: toRotatorArray(params.rotation),
					}),
				),
		},
		transform_light: {
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
		inspect_lighting: {
			handler: () => pythonDispatch(editorTools.UEGetMapInfo()),
		},
	})
}
