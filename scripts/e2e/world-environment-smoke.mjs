export async function runWorldEnvironmentScenarios(ctx, state) {
	const { addCleanup, runStep, callJsonTool, assert, safeDeleteActors } = ctx
	const {
		environmentPrefix,
		environmentTownPrefix,
		environmentStairPrefix,
		environmentPyramidPrefix,
		environmentMazePrefix,
	} = state

	await runStep("Create an arch through manage_environment", async () => {
		const environmentResult = await callJsonTool("manage_environment", {
			action: "create_arch",
			params: {
				prefix: environmentPrefix,
				location: { x: 1260, y: 320, z: 0 },
				span_width: 220,
				pillar_height: 180,
				pillar_width: 40,
				beam_height: 40,
			},
		})
		assert(environmentResult.structure === "create_arch", "manage_environment create_arch returned the wrong structure")
		assert(Number(environmentResult.actor_count) === 3, "manage_environment create_arch did not spawn the expected actor count")
		addCleanup(
			`Delete environment actors for ${environmentPrefix}`,
			() => safeDeleteActors((environmentResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a pyramid through manage_environment", async () => {
		const pyramidResult = await callJsonTool("manage_environment", {
			action: "create_pyramid",
			params: {
				prefix: environmentPyramidPrefix,
				location: { x: 1380, y: 520, z: 0 },
				levels: 4,
				block_size: 130,
			},
		})
		assert(pyramidResult.structure === "create_pyramid", "manage_environment create_pyramid returned the wrong structure")
		assert(Number(pyramidResult.actor_count) > 0, "manage_environment create_pyramid did not spawn any actors")
		addCleanup(
			`Delete environment actors for ${environmentPyramidPrefix}`,
			() => safeDeleteActors((pyramidResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a staircase through manage_environment", async () => {
		const stairResult = await callJsonTool("manage_environment", {
			action: "create_staircase",
			params: {
				prefix: environmentStairPrefix,
				location: { x: 1560, y: 760, z: 0 },
				steps: 5,
				step_width: 180,
				step_height: 24,
				step_depth: 80,
			},
		})
		assert(stairResult.structure === "create_staircase", "manage_environment create_staircase returned the wrong structure")
		assert(Number(stairResult.actor_count) === 5, "manage_environment create_staircase did not spawn the expected actor count")
		addCleanup(
			`Delete environment actors for ${environmentStairPrefix}`,
			() => safeDeleteActors((stairResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a maze through manage_environment", async () => {
		const mazeResult = await callJsonTool("manage_environment", {
			action: "create_maze",
			params: {
				prefix: environmentMazePrefix,
				location: { x: 1760, y: 860, z: 0 },
				rows: 3,
				cols: 4,
				cell_size: 160,
				wall_height: 130,
				wall_thickness: 22,
				seed: 99,
			},
		})
		assert(mazeResult.structure === "create_maze", "manage_environment create_maze returned the wrong structure")
		assert(Number(mazeResult.actor_count) > 0, "manage_environment create_maze did not spawn any actors")
		addCleanup(
			`Delete environment actors for ${environmentMazePrefix}`,
			() => safeDeleteActors((mazeResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a town through manage_environment", async () => {
		const townResult = await callJsonTool("manage_environment", {
			action: "create_town",
			params: {
				prefix: environmentTownPrefix,
				location: { x: 1980, y: 860, z: 0 },
				rows: 1,
				cols: 2,
				spacing: 640,
			},
		})
		assert(townResult.structure === "create_town", "manage_environment create_town returned the wrong structure")
		assert(Number(townResult.actor_count) >= 10, "manage_environment create_town did not spawn enough actors")
		addCleanup(
			`Delete environment actors for ${environmentTownPrefix}`,
			() => safeDeleteActors((townResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})
}
