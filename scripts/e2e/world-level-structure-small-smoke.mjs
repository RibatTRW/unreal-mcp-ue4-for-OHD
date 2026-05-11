export async function runWorldLevelStructureSmallScenarios(ctx, state) {
	const { addCleanup, runStep, callJsonTool, assert, safeDeleteActors } = ctx
	const {
		levelStructurePrefix,
		levelStructureTownPrefix,
		levelStructureBridgePrefix,
		levelStructureTowerPrefix,
		levelStructureWallPrefix,
	} = state

	await runStep("Construct a house through manage_level_structure", async () => {
		const structureResult = await callJsonTool("manage_level_structure", {
			action: "construct_house",
			params: {
				prefix: levelStructurePrefix,
				location: { x: 960, y: 320, z: 0 },
				width: 260,
				depth: 220,
				wall_height: 180,
				roof_height: 60,
			},
		})
		assert(
			structureResult.structure === "construct_house",
			"manage_level_structure construct_house returned the wrong structure",
		)
		assert(Number(structureResult.actor_count) >= 5, "manage_level_structure construct_house did not spawn enough actors")
		addCleanup(
			`Delete level-structure actors for ${levelStructurePrefix}`,
			() => safeDeleteActors((structureResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Read world outliner through manage_level_structure", async () => {
		const outliner = await callJsonTool("manage_level_structure", {
			action: "world_outliner",
			params: {},
		})
		assert(Array.isArray(outliner.actors), "manage_level_structure world_outliner did not return an actor list")
		assert(Number.isFinite(outliner.total_actors), "manage_level_structure world_outliner did not return total_actors")
	})

	await runStep("Create a town through manage_level_structure", async () => {
		const townResult = await callJsonTool("manage_level_structure", {
			action: "create_town",
			params: {
				prefix: levelStructureTownPrefix,
				location: { x: 1260, y: 540, z: 0 },
				rows: 1,
				cols: 1,
				spacing: 650,
			},
		})
		assert(townResult.structure === "create_town", "manage_level_structure create_town returned the wrong structure")
		assert(Number(townResult.actor_count) > 0, "manage_level_structure create_town did not spawn any actors")
		addCleanup(
			`Delete level-structure actors for ${levelStructureTownPrefix}`,
			() => safeDeleteActors((townResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a bridge through manage_level_structure", async () => {
		const bridgeResult = await callJsonTool("manage_level_structure", {
			action: "create_bridge",
			params: {
				prefix: levelStructureBridgePrefix,
				location: { x: 1100, y: 480, z: 0 },
				segment_length: 320,
				width: 120,
				thickness: 20,
				rail_height: 45,
			},
		})
		assert(bridgeResult.structure === "create_bridge", "manage_level_structure create_bridge returned the wrong structure")
		assert(Number(bridgeResult.actor_count) > 0, "manage_level_structure create_bridge did not spawn any actors")
		addCleanup(
			`Delete level-structure actors for ${levelStructureBridgePrefix}`,
			() => safeDeleteActors((bridgeResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a tower through manage_level_structure", async () => {
		const towerResult = await callJsonTool("manage_level_structure", {
			action: "create_tower",
			params: {
				prefix: levelStructureTowerPrefix,
				location: { x: 2100, y: 640, z: 0 },
				width: 240,
				floors: 4,
				floor_height: 180,
			},
		})
		assert(towerResult.structure === "create_tower", "manage_level_structure create_tower returned the wrong structure")
		assert(Number(towerResult.actor_count) >= 5, "manage_level_structure create_tower did not spawn enough actors")
		addCleanup(
			`Delete level-structure actors for ${levelStructureTowerPrefix}`,
			() => safeDeleteActors((towerResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a wall through manage_level_structure", async () => {
		const wallResult = await callJsonTool("manage_level_structure", {
			action: "create_wall",
			params: {
				prefix: levelStructureWallPrefix,
				location: { x: 2300, y: 520, z: 160 },
				segments: 5,
				segment_length: 160,
				height: 220,
				thickness: 40,
			},
		})
		assert(wallResult.structure === "create_wall", "manage_level_structure create_wall returned the wrong structure")
		assert(Number(wallResult.actor_count) > 0, "manage_level_structure create_wall did not spawn any actors")
		addCleanup(
			`Delete level-structure actors for ${levelStructureWallPrefix}`,
			() => safeDeleteActors((wallResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})
}
