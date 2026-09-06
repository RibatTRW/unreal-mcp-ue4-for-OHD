import { Effect } from "effect"
import { z } from "zod"

import type { ToolError } from "./effect/errors.js"
import type { RegistrationDispatch, RegistrationParams, RegistrationSchemas } from "./registration-context.js"
import { sharedReadOnlyActions } from "./shared-read-only-actions.js"
import type { ToolCatalogEntry } from "./tool-catalog-types.js"
import { createToolDescriptionLookup } from "./tool-catalog-types.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

/**
 * Catalog entries co-located with the namespace registration below.
 * Adding a tool here needs no edit to a separate catalog file.
 */
export const worldBuildingEntries: ToolCatalogEntry[] = [
	{
		name: "manage_level",
		category: "Core Tool Namespaces",
		description:
			"Level tool namespace for map inspection, actor listing, world outliner inspection, and preset structure creation actions.",
	},
	{
		name: "manage_level_structure",
		category: "World & Environment Tool Namespaces",
		description:
			"Level-structure tool namespace for preset town, house, mansion, tower, wall, bridge, and fortress construction actions.",
	},
	{
		name: "manage_environment",
		category: "World & Environment Tool Namespaces",
		description:
			"Environment-building tool namespace for preset town, arch, staircase, pyramid, and maze generation actions.",
	},
	{
		name: "manage_geometry",
		category: "World & Environment Tool Namespaces",
		description: "Geometry tool namespace for wall, arch, staircase, and pyramid preset construction actions.",
	},
]

const describeTool = createToolDescriptionLookup(worldBuildingEntries)

export function worldBuildingDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const { editorTools, pythonDispatch, worldBuildBaseSchema, worldBuildCommand } = ctx
	const shared = sharedReadOnlyActions(ctx)

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
		// Phase 5c (report §5): handler returns Effect; param-helper
		// and builder throws become channel failures via Effect.try
		// (Effect.sync would defect past dispatch's catchAll and break
		// the identical envelope), rendered verbatim downstream.
		handler: (params: Record<string, any>) =>
			Effect.try({
				try: () => pythonDispatch(worldBuildCommand(operation, params)),
				catch: (cause) => cause as ToolError,
			}),
	})

	return [
		{
			name: "manage_level",
			description: describeTool("manage_level"),
			actions: {
				info: shared.map_info,
				world_outliner: shared.world_outliner,
				list_actors: {
					handler: () =>
						Effect.try({
							try: () => pythonDispatch(editorTools.UEActorTool("get_actors_in_level")),
							catch: (cause) => cause as ToolError,
						}),
				},
				create_wall: worldAction("create_wall", createWallSchema),
				create_maze: worldAction("create_maze", createMazeSchema),
				create_pyramid: worldAction("create_pyramid", createPyramidSchema),
				create_bridge: worldAction("create_bridge", createBridgeSchema),
				create_town: worldAction("create_town", createTownSchema),
			},
		},
		{
			name: "manage_level_structure",
			description: describeTool("manage_level_structure"),
			actions: {
				world_outliner: shared.world_outliner,
				create_town: worldAction("create_town", createTownSchema),
				construct_house: worldAction("construct_house", constructHouseSchema),
				construct_mansion: worldAction("construct_mansion", constructMansionSchema),
				create_tower: worldAction("create_tower", createTowerSchema),
				create_wall: worldAction("create_wall", createWallSchema),
				create_bridge: worldAction("create_bridge", createBridgeSchema),
				create_suspension_bridge: worldAction("create_suspension_bridge", createSuspensionBridgeSchema),
				create_aqueduct: worldAction("create_aqueduct", createAqueductSchema),
				create_castle_fortress: worldAction("create_castle_fortress", createCastleFortressSchema),
			},
		},
		{
			name: "manage_environment",
			description: describeTool("manage_environment"),
			actions: {
				create_town: worldAction("create_town", createTownSchema),
				create_arch: worldAction("create_arch", createArchSchema),
				create_staircase: worldAction("create_staircase", createStaircaseSchema),
				create_pyramid: worldAction("create_pyramid", createPyramidSchema),
				create_maze: worldAction("create_maze", createMazeSchema),
			},
		},
		{
			name: "manage_geometry",
			description: describeTool("manage_geometry"),
			actions: {
				create_wall: worldAction("create_wall", createWallSchema),
				create_arch: worldAction("create_arch", createArchSchema),
				create_staircase: worldAction("create_staircase", createStaircaseSchema),
				create_pyramid: worldAction("create_pyramid", createPyramidSchema),
			},
		},
	]
}
