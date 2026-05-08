import { z } from "zod"

import { RegistrationContext } from "./registration-context.js"

export function registerWorldBuildingNamespaces(ctx: RegistrationContext) {
	const { editorTools, pythonDispatch, registerToolNamespace, worldBuildBaseSchema, worldBuildCommand } = ctx

	const worldSchema = (shape: z.ZodRawShape) =>
		z
			.object({
				...worldBuildBaseSchema,
				...shape,
			})
			.strict()

	const wallShape = {
		segments: z.number().optional(),
		segment_length: z.number().optional(),
		height: z.number().optional(),
		thickness: z.number().optional(),
		axis: z.string().optional(),
	}
	const bridgeShape = {
		segments: z.number().optional(),
		segment_length: z.number().optional(),
		width: z.number().optional(),
		thickness: z.number().optional(),
		rail_height: z.number().optional(),
	}

	const createWallSchema = worldSchema(wallShape)
	const createMazeSchema = worldSchema({
		rows: z.number().optional(),
		cols: z.number().optional(),
		cell_size: z.number().optional(),
		wall_height: z.number().optional(),
		wall_thickness: z.number().optional(),
		seed: z.number().optional(),
	})
	const createPyramidSchema = worldSchema({
		levels: z.number().optional(),
		block_size: z.number().optional(),
	})
	const createBridgeSchema = worldSchema(bridgeShape)
	const createTownSchema = worldSchema({
		rows: z.number().optional(),
		cols: z.number().optional(),
		spacing: z.number().optional(),
	})
	const constructHouseSchema = worldSchema({
		width: z.number().optional(),
		depth: z.number().optional(),
		wall_height: z.number().optional(),
		wall_thickness: z.number().optional(),
		roof_height: z.number().optional(),
	})
	const constructMansionSchema = worldSchema({
		width: z.number().optional(),
		depth: z.number().optional(),
		wall_height: z.number().optional(),
		wall_thickness: z.number().optional(),
		roof_height: z.number().optional(),
		wing_offset: z.number().optional(),
	})
	const createTowerSchema = worldSchema({
		width: z.number().optional(),
		floors: z.number().optional(),
		floor_height: z.number().optional(),
	})
	const createArchSchema = worldSchema({
		span_width: z.number().optional(),
		pillar_height: z.number().optional(),
		pillar_width: z.number().optional(),
		beam_height: z.number().optional(),
	})
	const createStaircaseSchema = worldSchema({
		steps: z.number().optional(),
		step_width: z.number().optional(),
		step_height: z.number().optional(),
		step_depth: z.number().optional(),
	})
	const createSuspensionBridgeSchema = worldSchema({
		...bridgeShape,
		tower_height: z.number().optional(),
	})
	const createAqueductSchema = worldSchema({
		arches: z.number().optional(),
		spacing: z.number().optional(),
	})
	const createCastleFortressSchema = worldSchema({
		size: z.number().optional(),
		segments: z.number().optional(),
		height: z.number().optional(),
		thickness: z.number().optional(),
		tower_width: z.number().optional(),
	})
	const worldAction = (operation: string, paramsSchema: z.ZodTypeAny) => ({
		paramsSchema,
		handler: (params: Record<string, any>) => pythonDispatch(worldBuildCommand(operation, params)),
	})

	registerToolNamespace("manage_level", ctx.toolDescription("manage_level"), {
		info: { handler: () => pythonDispatch(editorTools.UEGetMapInfo()) },
		world_outliner: { handler: () => pythonDispatch(editorTools.UEGetWorldOutliner()) },
		list_actors: { handler: () => pythonDispatch(editorTools.UEActorTool("get_actors_in_level")) },
		create_wall: worldAction("create_wall", createWallSchema),
		create_maze: worldAction("create_maze", createMazeSchema),
		create_pyramid: worldAction("create_pyramid", createPyramidSchema),
		create_bridge: worldAction("create_bridge", createBridgeSchema),
		create_town: worldAction("create_town", createTownSchema),
	})

	registerToolNamespace("manage_level_structure", ctx.toolDescription("manage_level_structure"), {
		world_outliner: { handler: () => pythonDispatch(editorTools.UEGetWorldOutliner()) },
		create_town: worldAction("create_town", createTownSchema),
		construct_house: worldAction("construct_house", constructHouseSchema),
		construct_mansion: worldAction("construct_mansion", constructMansionSchema),
		create_tower: worldAction("create_tower", createTowerSchema),
		create_wall: worldAction("create_wall", createWallSchema),
		create_bridge: worldAction("create_bridge", createBridgeSchema),
		create_suspension_bridge: worldAction("create_suspension_bridge", createSuspensionBridgeSchema),
		create_aqueduct: worldAction("create_aqueduct", createAqueductSchema),
		create_castle_fortress: worldAction("create_castle_fortress", createCastleFortressSchema),
	})

	registerToolNamespace("manage_environment", ctx.toolDescription("manage_environment"), {
		create_town: worldAction("create_town", createTownSchema),
		create_arch: worldAction("create_arch", createArchSchema),
		create_staircase: worldAction("create_staircase", createStaircaseSchema),
		create_pyramid: worldAction("create_pyramid", createPyramidSchema),
		create_maze: worldAction("create_maze", createMazeSchema),
	})

	registerToolNamespace("manage_geometry", ctx.toolDescription("manage_geometry"), {
		create_wall: worldAction("create_wall", createWallSchema),
		create_arch: worldAction("create_arch", createArchSchema),
		create_staircase: worldAction("create_staircase", createStaircaseSchema),
		create_pyramid: worldAction("create_pyramid", createPyramidSchema),
	})
}
