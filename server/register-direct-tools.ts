import { z } from "zod"

import { discoverPath } from "./remote-execution.js"
import { RegistrationDispatch } from "./registration-context.js"

export function registerDirectTools(ctx: RegistrationDispatch) {
	const { editorTools, rawServerTool, registerPythonTool, textResponse, toolDescription } = ctx

	rawServerTool("get_unreal_engine_path", toolDescription("get_unreal_engine_path"), async () => {
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

	rawServerTool("get_unreal_project_path", toolDescription("get_unreal_project_path"), async () => {
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

	rawServerTool("get_unreal_version", toolDescription("get_unreal_version"), async () => {
		const engineVersion = await discoverPath(
			["import unreal", "print(unreal.SystemLibrary.get_engine_version() or '')"].join("\n"),
			"Unable to resolve the active Unreal Engine version",
		)

		return textResponse(`Unreal version: ${engineVersion}`)
	})

	/// Core Direct Tools
	registerPythonTool(
		"editor_create_object",
		toolDescription("editor_create_object"),
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
			editorTools.UECreateObject(object_class, object_name, location, rotation, scale, properties),
	)

	registerPythonTool(
		"editor_update_object",
		toolDescription("editor_update_object"),
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
			editorTools.UEUpdateObject(actor_name, location, rotation, scale, properties, new_name),
	)

	registerPythonTool(
		"editor_delete_object",
		toolDescription("editor_delete_object"),
		{
			actor_names: z.string(),
		},
		({ actor_names }) => editorTools.UEDeleteObject(actor_names),
	)
}
