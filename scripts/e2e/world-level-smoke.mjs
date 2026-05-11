export async function runWorldLevelScenarios(ctx, state) {
	const { addCleanup, runStep, callJsonTool, assert, safeDeleteActors } = ctx
	const {
		levelPrefix,
		levelMazePrefix,
		levelPyramidPrefix,
		levelBridgePrefix,
		levelTownPrefix,
	} = state

	await runStep("Create a wall through manage_level", async () => {
		const levelResult = await callJsonTool("manage_level", {
			action: "create_wall",
			params: {
				prefix: levelPrefix,
				location: { x: 700, y: 320, z: 0 },
				segment_length: 260,
				height: 160,
				thickness: 30,
			},
		})
		assert(levelResult.structure === "create_wall", "manage_level create_wall returned the wrong structure")
		assert(Number(levelResult.actor_count) > 0, "manage_level create_wall did not spawn any actors")
		addCleanup(
			`Delete level actors for ${levelPrefix}`,
			() => safeDeleteActors((levelResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a maze through manage_level", async () => {
		const mazeResult = await callJsonTool("manage_level", {
			action: "create_maze",
			params: {
				prefix: levelMazePrefix,
				location: { x: 760, y: 640, z: 0 },
				rows: 4,
				cols: 5,
				cell_size: 180,
				wall_height: 140,
				wall_thickness: 24,
				seed: 42,
			},
		})
		assert(mazeResult.structure === "create_maze", "manage_level create_maze returned the wrong structure")
		assert(Number(mazeResult.actor_count) > 0, "manage_level create_maze did not spawn any actors")
		addCleanup(
			`Delete level actors for ${levelMazePrefix}`,
			() => safeDeleteActors((mazeResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a pyramid through manage_level", async () => {
		const pyramidResult = await callJsonTool("manage_level", {
			action: "create_pyramid",
			params: {
				prefix: levelPyramidPrefix,
				location: { x: 980, y: 760, z: 0 },
				levels: 3,
				block_size: 140,
			},
		})
		assert(pyramidResult.structure === "create_pyramid", "manage_level create_pyramid returned the wrong structure")
		assert(Number(pyramidResult.actor_count) > 0, "manage_level create_pyramid did not spawn any actors")
		addCleanup(
			`Delete level actors for ${levelPyramidPrefix}`,
			() => safeDeleteActors((pyramidResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a bridge through manage_level", async () => {
		const bridgeResult = await callJsonTool("manage_level", {
			action: "create_bridge",
			params: {
				prefix: levelBridgePrefix,
				location: { x: 1120, y: 860, z: 0 },
				segments: 4,
				segment_length: 140,
				width: 120,
				thickness: 24,
				rail_height: 50,
			},
		})
		assert(bridgeResult.structure === "create_bridge", "manage_level create_bridge returned the wrong structure")
		assert(Number(bridgeResult.actor_count) > 0, "manage_level create_bridge did not spawn any actors")
		addCleanup(
			`Delete level actors for ${levelBridgePrefix}`,
			() => safeDeleteActors((bridgeResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a town through manage_level", async () => {
		const townResult = await callJsonTool("manage_level", {
			action: "create_town",
			params: {
				prefix: levelTownPrefix,
				location: { x: 1480, y: 760, z: 0 },
				rows: 1,
				cols: 2,
				spacing: 650,
			},
		})
		assert(townResult.structure === "create_town", "manage_level create_town returned the wrong structure")
		assert(Number(townResult.actor_count) >= 10, "manage_level create_town did not spawn enough actors")
		addCleanup(
			`Delete level actors for ${levelTownPrefix}`,
			() => safeDeleteActors((townResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})
}
