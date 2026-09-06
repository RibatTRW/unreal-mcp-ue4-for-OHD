import { z } from "zod"

import type { RegistrationDispatch } from "./registration-context.js"
import { discoverPath } from "./remote-execution.js"
import type { ToolCatalogEntry } from "./tool-catalog-types.js"
import { createToolDescriptionLookup } from "./tool-catalog-types.js"

/**
 * Catalog entries co-located with the direct-tool registration below.
 * Adding a tool here needs no edit to a separate catalog file.
 */
export const directToolEntries: ToolCatalogEntry[] = [
	{
		name: "get_unreal_engine_path",
		category: "Editor Session Info",
		description: "Get the active Unreal Engine root path from the connected editor session",
	},
	{
		name: "get_unreal_project_path",
		category: "Editor Session Info",
		description: "Get the active Unreal project file path from the connected editor session",
	},
	{
		name: "get_unreal_version",
		category: "Editor Session Info",
		description: "Get the active Unreal Engine version string from the connected editor session",
	},
	{
		name: "editor_create_object",
		category: "Core Direct Tools",
		description:
			"Create a new object/actor in the world\n\nExample output: {'success': true, 'actor_name': 'StaticMeshActor_1', 'actor_label': 'MyCube', 'class': 'StaticMeshActor', 'location': {'x': 100.0, 'y': 200.0, 'z': 0.0}, 'rotation': {'pitch': 0.0, 'yaw': 45.0, 'roll': 0.0}, 'scale': {'x': 1.0, 'y': 1.0, 'z': 1.0}}\n\nReturns created actor details with final transform values.",
	},
	{
		name: "editor_update_object",
		category: "Core Direct Tools",
		description:
			"Update an existing object/actor in the world\n\nExample output: {'success': true, 'actor_name': 'StaticMeshActor_1', 'actor_label': 'UpdatedCube', 'class': 'StaticMeshActor', 'location': {'x': 150.0, 'y': 200.0, 'z': 50.0}, 'rotation': {'pitch': 0.0, 'yaw': 90.0, 'roll': 0.0}, 'scale': {'x': 2.0, 'y': 2.0, 'z': 2.0}}\n\nReturns updated actor details with new transform values.",
	},
	{
		name: "editor_delete_object",
		category: "Core Direct Tools",
		description:
			"Delete an object/actor from the world\n\nExample output: {'success': true, 'message': 'Successfully deleted actor: MyCube', 'deleted_actor': {'actor_name': 'StaticMeshActor_1', 'actor_label': 'MyCube', 'class': 'StaticMeshActor', 'location': {'x': 100.0, 'y': 200.0, 'z': 0.0}}}\n\nReturns deletion confirmation with details of the deleted actor.",
	},
]

const describeTool = createToolDescriptionLookup(directToolEntries)

export function registerDirectTools(ctx: RegistrationDispatch) {
	const { editorTools, rawServerTool, registerPythonTool, textResponse } = ctx

	rawServerTool("get_unreal_engine_path", describeTool("get_unreal_engine_path"), async () => {
		const enginePath = await discoverPath(
			[
				"import os",
				"import unreal",
				'engine_dir = unreal.Paths.engine_dir() or ""',
				"full_engine_dir = unreal.Paths.convert_relative_path_to_full(engine_dir) if engine_dir else ''",
				"normalized = os.path.normpath(full_engine_dir) if full_engine_dir else ''",
				"if normalized and os.path.basename(normalized).lower() == 'engine':",
				"    print(os.path.dirname(normalized))",
				"else:",
				"    print(normalized)",
			].join("\n"),
			"Unable to resolve the active Unreal Engine path",
		)

		return textResponse(`Unreal Engine path: ${enginePath}`)
	})

	rawServerTool("get_unreal_project_path", describeTool("get_unreal_project_path"), async () => {
		const projectPath = await discoverPath(
			[
				"import os",
				"import unreal",
				'project_file = unreal.Paths.get_project_file_path() or ""',
				"full_project_file = unreal.Paths.convert_relative_path_to_full(project_file) if project_file else ''",
				"print(os.path.normpath(full_project_file) if full_project_file else '')",
			].join("\n"),
			"Unable to resolve the active Unreal project path",
		)

		return textResponse(`Unreal Project path: ${projectPath}`)
	})

	rawServerTool("get_unreal_version", describeTool("get_unreal_version"), async () => {
		const engineVersion = await discoverPath(
			["import unreal", "print(unreal.SystemLibrary.get_engine_version() or '')"].join("\n"),
			"Unable to resolve the active Unreal Engine version",
		)

		return textResponse(`Unreal version: ${engineVersion}`)
	})

	/// Core Direct Tools
	registerPythonTool(
		"editor_create_object",
		describeTool("editor_create_object"),
		{
			object_class: z.string().describe("Unreal class name (e.g., 'StaticMeshActor', 'DirectionalLight')"),
			object_name: z.string().describe("Name/label for the created object"),
			location: z
				.object({
					x: z.number().default(0),
					y: z.number().default(0),
					z: z.number().default(0),
				})
				.optional()
				.describe("World position coordinates"),
			rotation: z
				.object({
					pitch: z.number().default(0),
					yaw: z.number().default(0),
					roll: z.number().default(0),
				})
				.optional()
				.describe("Rotation in degrees"),
			scale: z
				.object({
					x: z.number().default(1),
					y: z.number().default(1),
					z: z.number().default(1),
				})
				.optional()
				.describe("Scale multipliers"),
			properties: z
				.record(z.any())
				.optional()
				.describe(
					'Additional actor properties. For StaticMeshActor: use \'StaticMesh\' for mesh path, \'Material\' for single material path, or \'Materials\' for array of material paths. Example: {"StaticMesh": "/Game/Meshes/Cube", "Material": "/Game/Materials/M_Basic"}',
				),
		},
		({ object_class, object_name, location, rotation, scale, properties }) =>
			// SDK Zod-validates args before buildCommand runs; the casts recover
			// the static types with zero runtime change (Phase-4 retype). Same below.
			editorTools.UECreateObject(
				object_class as string,
				object_name as string,
				location as { x: number; y: number; z: number } | undefined,
				rotation as { pitch: number; yaw: number; roll: number } | undefined,
				scale as { x: number; y: number; z: number } | undefined,
				properties as Record<string, unknown> | undefined,
			),
	)

	registerPythonTool(
		"editor_update_object",
		describeTool("editor_update_object"),
		{
			actor_name: z.string().describe("Name or label of the actor to update"),
			location: z
				.object({
					x: z.number(),
					y: z.number(),
					z: z.number(),
				})
				.optional()
				.describe("New world position coordinates"),
			rotation: z
				.object({
					pitch: z.number(),
					yaw: z.number(),
					roll: z.number(),
				})
				.optional()
				.describe("New rotation in degrees"),
			scale: z
				.object({
					x: z.number(),
					y: z.number(),
					z: z.number(),
				})
				.optional()
				.describe("New scale multipliers"),
			properties: z
				.record(z.any())
				.optional()
				.describe(
					'Additional actor properties to update. For StaticMeshActor: use \'StaticMesh\' for mesh path, \'Material\' for single material path, or \'Materials\' for array of material paths. Example: {"StaticMesh": "/Game/Meshes/Cube", "Material": "/Game/Materials/M_Basic"}',
				),
			new_name: z.string().optional().describe("New name/label for the actor"),
		},
		({ actor_name, location, rotation, scale, properties, new_name }) =>
			editorTools.UEUpdateObject(
				actor_name as string,
				location as { x: number; y: number; z: number } | undefined,
				rotation as { pitch: number; yaw: number; roll: number } | undefined,
				scale as { x: number; y: number; z: number } | undefined,
				properties as Record<string, unknown> | undefined,
				new_name as string | undefined,
			),
	)

	registerPythonTool(
		"editor_delete_object",
		describeTool("editor_delete_object"),
		{
			actor_names: z.string(),
		},
		({ actor_names }) => editorTools.UEDeleteObject(actor_names as string),
	)
}
