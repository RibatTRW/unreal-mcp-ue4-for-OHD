export async function runWorldLevelStructureLargeScenarios(ctx, state) {
	const { addCleanup, runStep, callJsonTool, assert, safeDeleteActors } = ctx
	const {
		levelStructureSuspensionBridgePrefix,
		levelStructureAqueductPrefix,
		levelStructureCastlePrefix,
		levelStructureMansionPrefix,
	} = state

	await runStep("Create a suspension bridge through manage_level_structure", async () => {
		const bridgeResult = await callJsonTool("manage_level_structure", {
			action: "create_suspension_bridge",
			params: {
				prefix: levelStructureSuspensionBridgePrefix,
				location: { x: 1460, y: 620, z: 0 },
				segments: 3,
				segment_length: 140,
				tower_height: 320,
			},
		})
		assert(
			bridgeResult.structure === "create_suspension_bridge",
			"manage_level_structure create_suspension_bridge returned the wrong structure",
		)
		assert(
			Number(bridgeResult.actor_count) > 0,
			"manage_level_structure create_suspension_bridge did not spawn any actors",
		)
		addCleanup(`Delete level-structure actors for ${levelStructureSuspensionBridgePrefix}`, () =>
			safeDeleteActors((bridgeResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create an aqueduct through manage_level_structure", async () => {
		const aqueductResult = await callJsonTool("manage_level_structure", {
			action: "create_aqueduct",
			params: {
				prefix: levelStructureAqueductPrefix,
				location: { x: 1660, y: 760, z: 0 },
				arches: 3,
				spacing: 260,
			},
		})
		assert(
			aqueductResult.structure === "create_aqueduct",
			"manage_level_structure create_aqueduct returned the wrong structure",
		)
		assert(Number(aqueductResult.actor_count) > 0, "manage_level_structure create_aqueduct did not spawn any actors")
		addCleanup(`Delete level-structure actors for ${levelStructureAqueductPrefix}`, () =>
			safeDeleteActors((aqueductResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Construct a mansion through manage_level_structure", async () => {
		const mansionResult = await callJsonTool("manage_level_structure", {
			action: "construct_mansion",
			params: {
				prefix: levelStructureMansionPrefix,
				location: { x: 1840, y: 360, z: 0 },
				width: 720,
				depth: 520,
				wall_height: 280,
				roof_height: 90,
				wing_offset: 520,
			},
		})
		assert(
			mansionResult.structure === "construct_mansion",
			"manage_level_structure construct_mansion returned the wrong structure",
		)
		assert(
			Number(mansionResult.actor_count) >= 15,
			"manage_level_structure construct_mansion did not spawn enough actors",
		)
		addCleanup(`Delete level-structure actors for ${levelStructureMansionPrefix}`, () =>
			safeDeleteActors((mansionResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})

	await runStep("Create a castle fortress through manage_level_structure", async () => {
		const fortressResult = await callJsonTool("manage_level_structure", {
			action: "create_castle_fortress",
			params: {
				prefix: levelStructureCastlePrefix,
				location: { x: 2540, y: 680, z: 0 },
				size: 900,
				segments: 3,
				height: 220,
				thickness: 40,
				tower_width: 160,
			},
		})
		assert(
			fortressResult.structure === "create_castle_fortress",
			"manage_level_structure create_castle_fortress returned the wrong structure",
		)
		assert(
			Number(fortressResult.actor_count) > 0,
			"manage_level_structure create_castle_fortress did not spawn any actors",
		)
		addCleanup(`Delete level-structure actors for ${levelStructureCastlePrefix}`, () =>
			safeDeleteActors((fortressResult.actors || []).map((actor) => actor.label || actor.name)),
		)
	})
}
