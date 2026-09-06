export async function runWorldGeometryScenarios(ctx, state) {
	const { addCleanup, runStep, callJsonTool, assert, safeDeleteActors } = ctx
	const { geometryPrefix, geometryArchPrefix, geometryWallPrefix, geometryPyramidPrefix } = state

	await runStep("Create a staircase through manage_geometry", async () => {
		const geometryResult = await callJsonTool("manage_geometry", {
			action: "create_staircase",
			params: {
				prefix: geometryPrefix,
				location: { x: 1500, y: 320, z: 0 },
				steps: 4,
				step_width: 180,
				step_height: 30,
				step_depth: 90,
			},
		})
		assert(
			geometryResult.structure === "create_staircase",
			"manage_geometry create_staircase returned the wrong structure",
		)
		assert(
			Number(geometryResult.actor_count) === 4,
			"manage_geometry create_staircase did not spawn the expected actor count",
		)
		addCleanup(`Delete geometry actors for ${geometryPrefix}`, () =>
			safeDeleteActors((geometryResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create an arch through manage_geometry", async () => {
		const geometryArchResult = await callJsonTool("manage_geometry", {
			action: "create_arch",
			params: {
				prefix: geometryArchPrefix,
				location: { x: 1720, y: 520, z: 0 },
				span_width: 180,
				pillar_height: 150,
				pillar_width: 35,
				beam_height: 30,
			},
		})
		assert(geometryArchResult.structure === "create_arch", "manage_geometry create_arch returned the wrong structure")
		assert(Number(geometryArchResult.actor_count) > 0, "manage_geometry create_arch did not spawn any actors")
		addCleanup(`Delete geometry actors for ${geometryArchPrefix}`, () =>
			safeDeleteActors((geometryArchResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a wall through manage_geometry", async () => {
		const geometryWallResult = await callJsonTool("manage_geometry", {
			action: "create_wall",
			params: {
				prefix: geometryWallPrefix,
				location: { x: 2220, y: 860, z: 140 },
				segments: 4,
				segment_length: 140,
				height: 200,
				thickness: 32,
			},
		})
		assert(geometryWallResult.structure === "create_wall", "manage_geometry create_wall returned the wrong structure")
		assert(Number(geometryWallResult.actor_count) > 0, "manage_geometry create_wall did not spawn any actors")
		addCleanup(`Delete geometry actors for ${geometryWallPrefix}`, () =>
			safeDeleteActors((geometryWallResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a pyramid through manage_geometry", async () => {
		const geometryPyramidResult = await callJsonTool("manage_geometry", {
			action: "create_pyramid",
			params: {
				prefix: geometryPyramidPrefix,
				location: { x: 2400, y: 960, z: 0 },
				levels: 3,
				block_size: 120,
			},
		})
		assert(
			geometryPyramidResult.structure === "create_pyramid",
			"manage_geometry create_pyramid returned the wrong structure",
		)
		assert(Number(geometryPyramidResult.actor_count) > 0, "manage_geometry create_pyramid did not spawn any actors")
		addCleanup(`Delete geometry actors for ${geometryPyramidPrefix}`, () =>
			safeDeleteActors((geometryPyramidResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})
}
