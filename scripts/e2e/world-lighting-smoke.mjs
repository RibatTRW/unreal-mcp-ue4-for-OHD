export async function runWorldLightingScenarios(ctx, state) {
	const { runStep, callJsonTool, assert } = ctx
	const { lightActorName, directionalLightActorName, spotLightActorName } = state

	await runStep("Spawn a point light through manage_lighting", async () => {
		const lightResult = await callJsonTool("manage_lighting", {
			action: "spawn_point_light",
			params: {
				name: lightActorName,
				location: { x: -300, y: 300, z: 240 },
			},
		})
		assert(
			lightResult.actor?.label === lightActorName,
			"manage_lighting spawn_point_light did not create the expected actor",
		)
	})

	await runStep("Spawn a directional light through manage_lighting", async () => {
		const directionalLightResult = await callJsonTool("manage_lighting", {
			action: "spawn_directional_light",
			params: {
				name: directionalLightActorName,
				location: { x: -420, y: 320, z: 320 },
				rotation: { pitch: -35, yaw: 15, roll: 0 },
			},
		})
		assert(
			directionalLightResult.actor?.label === directionalLightActorName,
			"manage_lighting spawn_directional_light did not create the expected actor",
		)
	})

	await runStep("Spawn a spot light through manage_lighting", async () => {
		const spotLightResult = await callJsonTool("manage_lighting", {
			action: "spawn_spot_light",
			params: {
				name: spotLightActorName,
				location: { x: -80, y: 300, z: 280 },
				rotation: { pitch: -45, yaw: 0, roll: 0 },
			},
		})
		assert(
			spotLightResult.actor?.label === spotLightActorName,
			"manage_lighting spawn_spot_light did not create the expected actor",
		)
	})

	await runStep("Move the point light through manage_lighting", async () => {
		const transformResult = await callJsonTool("manage_lighting", {
			action: "transform_light",
			params: {
				name: lightActorName,
				location: { x: -180, y: 300, z: 260 },
			},
		})
		assert(
			Math.abs(Number(transformResult.actor?.location?.x ?? 0) - -180) < 0.1,
			"manage_lighting transform_light did not update the expected X location",
		)
	})

	await runStep("Inspect lighting through manage_lighting", async () => {
		const lightingInfo = await callJsonTool("manage_lighting", {
			action: "inspect_lighting",
			params: {},
		})
		assert(
			typeof lightingInfo.map_name === "string" && lightingInfo.map_name.length > 0,
			"manage_lighting inspect_lighting did not return map_name",
		)
		assert(
			Number.isFinite(lightingInfo.lighting?.point_lights),
			"manage_lighting inspect_lighting did not return point_lights",
		)
	})

	await runStep("Delete the point light smoke-test actor", async () => {
		await callJsonTool("manage_actor", {
			action: "delete",
			params: { name: lightActorName },
		})
	})
}
