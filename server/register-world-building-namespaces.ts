import { z } from "zod"

import { RegistrationContext } from "./registration-context.js"

export function registerWorldBuildingNamespaces(ctx: RegistrationContext) {
	const {
		editorTools,
		pythonDispatch,
		registerToolNamespace,
		worldBuildBaseSchema,
		worldBuildCommand,
	} = ctx

	const createWallSchema = z
		.object({
			...worldBuildBaseSchema,
			segments: z.number().optional(),
			segment_length: z.number().optional(),
			height: z.number().optional(),
			thickness: z.number().optional(),
			axis: z.string().optional(),
		})
		.strict()
	const createMazeSchema = z
		.object({
			...worldBuildBaseSchema,
			rows: z.number().optional(),
			cols: z.number().optional(),
			cell_size: z.number().optional(),
			wall_height: z.number().optional(),
			wall_thickness: z.number().optional(),
			seed: z.number().optional(),
		})
		.strict()
	const createPyramidSchema = z
		.object({
			...worldBuildBaseSchema,
			levels: z.number().optional(),
			block_size: z.number().optional(),
		})
		.strict()
	const createBridgeSchema = z
		.object({
			...worldBuildBaseSchema,
			segments: z.number().optional(),
			segment_length: z.number().optional(),
			width: z.number().optional(),
			thickness: z.number().optional(),
			rail_height: z.number().optional(),
		})
		.strict()
	const createTownSchema = z
		.object({
			...worldBuildBaseSchema,
			rows: z.number().optional(),
			cols: z.number().optional(),
			spacing: z.number().optional(),
		})
		.strict()
	const constructHouseSchema = z
		.object({
			...worldBuildBaseSchema,
			width: z.number().optional(),
			depth: z.number().optional(),
			wall_height: z.number().optional(),
			wall_thickness: z.number().optional(),
			roof_height: z.number().optional(),
		})
		.strict()
	const constructMansionSchema = z
		.object({
			...worldBuildBaseSchema,
			width: z.number().optional(),
			depth: z.number().optional(),
			wall_height: z.number().optional(),
			wall_thickness: z.number().optional(),
			roof_height: z.number().optional(),
			wing_offset: z.number().optional(),
		})
		.strict()
	const createTowerSchema = z
		.object({
			...worldBuildBaseSchema,
			width: z.number().optional(),
			floors: z.number().optional(),
			floor_height: z.number().optional(),
		})
		.strict()
	const createArchSchema = z
		.object({
			...worldBuildBaseSchema,
			span_width: z.number().optional(),
			pillar_height: z.number().optional(),
			pillar_width: z.number().optional(),
			beam_height: z.number().optional(),
		})
		.strict()
	const createStaircaseSchema = z
		.object({
			...worldBuildBaseSchema,
			steps: z.number().optional(),
			step_width: z.number().optional(),
			step_height: z.number().optional(),
			step_depth: z.number().optional(),
		})
		.strict()
	const createSuspensionBridgeSchema = z
		.object({
			...createBridgeSchema.shape,
			tower_height: z.number().optional(),
		})
		.strict()
	const createAqueductSchema = z
		.object({
			...worldBuildBaseSchema,
			arches: z.number().optional(),
			spacing: z.number().optional(),
		})
		.strict()
	const createCastleFortressSchema = z
		.object({
			...worldBuildBaseSchema,
			size: z.number().optional(),
			segments: z.number().optional(),
			height: z.number().optional(),
			thickness: z.number().optional(),
			tower_width: z.number().optional(),
		})
		.strict()

	registerToolNamespace("manage_level", ctx.toolDescription("manage_level"), {
		info: { handler: () => pythonDispatch(editorTools.UEGetMapInfo()) },
		world_outliner: { handler: () => pythonDispatch(editorTools.UEGetWorldOutliner()) },
		list_actors: { handler: () => pythonDispatch(editorTools.UEActorTool("get_actors_in_level")) },
		create_wall: {
			paramsSchema: createWallSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_wall", params)),
		},
		create_maze: {
			paramsSchema: createMazeSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_maze", params)),
		},
		create_pyramid: {
			paramsSchema: createPyramidSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_pyramid", params)),
		},
		create_bridge: {
			paramsSchema: createBridgeSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_bridge", params)),
		},
		create_town: {
			paramsSchema: createTownSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_town", params)),
		},
	})

	registerToolNamespace(
		"manage_level_structure",
		ctx.toolDescription("manage_level_structure"),
		{
			world_outliner: { handler: () => pythonDispatch(editorTools.UEGetWorldOutliner()) },
			create_town: {
				paramsSchema: createTownSchema,
				handler: (params) => pythonDispatch(worldBuildCommand("create_town", params)),
			},
			construct_house: {
				paramsSchema: constructHouseSchema,
				handler: (params) => pythonDispatch(worldBuildCommand("construct_house", params)),
			},
			construct_mansion: {
				paramsSchema: constructMansionSchema,
				handler: (params) => pythonDispatch(worldBuildCommand("construct_mansion", params)),
			},
			create_tower: {
				paramsSchema: createTowerSchema,
				handler: (params) => pythonDispatch(worldBuildCommand("create_tower", params)),
			},
			create_wall: {
				paramsSchema: createWallSchema,
				handler: (params) => pythonDispatch(worldBuildCommand("create_wall", params)),
			},
			create_bridge: {
				paramsSchema: createBridgeSchema,
				handler: (params) => pythonDispatch(worldBuildCommand("create_bridge", params)),
			},
			create_suspension_bridge: {
				paramsSchema: createSuspensionBridgeSchema,
				handler: (params) =>
					pythonDispatch(worldBuildCommand("create_suspension_bridge", params)),
			},
			create_aqueduct: {
				paramsSchema: createAqueductSchema,
				handler: (params) => pythonDispatch(worldBuildCommand("create_aqueduct", params)),
			},
			create_castle_fortress: {
				paramsSchema: createCastleFortressSchema,
				handler: (params) =>
					pythonDispatch(worldBuildCommand("create_castle_fortress", params)),
			},
		},
	)

	registerToolNamespace("manage_environment", ctx.toolDescription("manage_environment"), {
		create_town: {
			paramsSchema: createTownSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_town", params)),
		},
		create_arch: {
			paramsSchema: createArchSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_arch", params)),
		},
		create_staircase: {
			paramsSchema: createStaircaseSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_staircase", params)),
		},
		create_pyramid: {
			paramsSchema: createPyramidSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_pyramid", params)),
		},
		create_maze: {
			paramsSchema: createMazeSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_maze", params)),
		},
	})

	registerToolNamespace("manage_geometry", ctx.toolDescription("manage_geometry"), {
		create_wall: {
			paramsSchema: createWallSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_wall", params)),
		},
		create_arch: {
			paramsSchema: createArchSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_arch", params)),
		},
		create_staircase: {
			paramsSchema: createStaircaseSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_staircase", params)),
		},
		create_pyramid: {
			paramsSchema: createPyramidSchema,
			handler: (params) => pythonDispatch(worldBuildCommand("create_pyramid", params)),
		},
	})
}
