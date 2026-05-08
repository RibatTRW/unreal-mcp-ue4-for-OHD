import { z } from "zod"

import {
	actorNameShape,
	actorNameSchema,
	assetLookupSchema,
	blueprintNameShape,
	materialColorShape,
	requireAtLeastOneValue,
	searchAssetsShape,
} from "./namespace-action-schema-fragments.js"
import { RegistrationContext } from "./registration-context.js"

export function registerContentAssetNamespaces(ctx: RegistrationContext) {
	const {
		actorNameParam,
		blueprintNameParam,
		editorTools,
		optionalStringParam,
		pythonDispatch,
		registerToolNamespace,
		requiredStringParam,
		searchAssetsCommand,
		toColorArray,
	} = ctx

	registerToolNamespace("manage_skeleton", ctx.toolDescription("manage_skeleton"), {
		search_skeletons: {
			paramsSchema: z.object(searchAssetsShape).strict(),
			handler: (params) => pythonDispatch(searchAssetsCommand(params, "Skeleton")),
		},
		search_skeletal_meshes: {
			paramsSchema: z.object(searchAssetsShape).strict(),
			handler: (params) => pythonDispatch(searchAssetsCommand(params, "SkeletalMesh")),
		},
		asset_info: {
			paramsSchema: assetLookupSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"])),
				),
		},
	})

	registerToolNamespace("manage_material", ctx.toolDescription("manage_material"), {
		list_materials: {
			paramsSchema: z
				.object({
					search_term: z.string().optional(),
					query: z.string().optional(),
					include_engine: z.boolean().optional(),
					limit: z.number().optional(),
				})
				.strict(),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEMaterialTool("get_available_materials", {
						search_term: optionalStringParam(params, ["search_term", "query"]),
						include_engine: params.include_engine,
						limit: params.limit,
					}),
				),
		},
		apply_to_actor: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...actorNameShape,
						component_name: z.string().optional(),
						material_path: z.string(),
						slot_index: z.number().optional(),
					})
					.strict(),
				["name", "actor_name"],
				"Provide name or actor_name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEMaterialTool("apply_material_to_actor", {
						actor_name: actorNameParam(params),
						component_name: optionalStringParam(params, ["component_name"]),
						material_path: requiredStringParam(params, ["material_path"]),
						slot_index: params.slot_index,
					}),
				),
		},
		apply_to_blueprint: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...blueprintNameShape,
						component_name: z.string(),
						material_path: z.string(),
						slot_index: z.number().optional(),
					})
					.strict(),
				["blueprint_name", "asset_path", "name"],
				"Provide blueprint_name, asset_path, or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEMaterialTool("apply_material_to_blueprint", {
						blueprint_name: blueprintNameParam(params),
						component_name: requiredStringParam(params, ["component_name"]),
						material_path: requiredStringParam(params, ["material_path"]),
						slot_index: params.slot_index,
					}),
				),
		},
		tint_material: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...materialColorShape,
						actor_name: z.string().optional(),
						name: z.string().optional(),
						blueprint_name: z.string().optional(),
						asset_path: z.string().optional(),
						component_name: z.string().optional(),
						material_path: z.string().optional(),
						slot_index: z.number().optional(),
						parameter_name: z.string().optional(),
						instance_name: z.string().optional(),
						instance_path: z.string().optional(),
					})
					.strict(),
				["actor_name", "name", "blueprint_name", "asset_path", "material_path"],
				"Provide actor_name, name, blueprint_name, asset_path, or material_path.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEMaterialTool("set_mesh_material_color", {
						actor_name: optionalStringParam(params, ["actor_name", "name"]),
						blueprint_name: optionalStringParam(params, ["blueprint_name", "asset_path"]),
						component_name: optionalStringParam(params, ["component_name"]),
						material_path: optionalStringParam(params, ["material_path"]),
						slot_index: params.slot_index,
						color: toColorArray(params.color as any),
						parameter_name: optionalStringParam(params, ["parameter_name"]),
						instance_name: optionalStringParam(params, ["instance_name"]),
						instance_path: optionalStringParam(params, ["instance_path"]),
					}),
				),
		},
	})

	registerToolNamespace("manage_texture", ctx.toolDescription("manage_texture"), {
		search_textures: {
			paramsSchema: z.object(searchAssetsShape).strict(),
			handler: (params) => pythonDispatch(searchAssetsCommand(params, "Texture")),
		},
		texture_info: {
			paramsSchema: assetLookupSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"])),
				),
		},
		import_texture: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						source_file: z.string().optional(),
						file_path: z.string().optional(),
						local_path: z.string().optional(),
						destination_path: z.string().optional(),
						content_path: z.string().optional(),
						path: z.string().optional(),
						asset_name: z.string().optional(),
						name: z.string().optional(),
						replace_existing: z.boolean().optional(),
						save: z.boolean().optional(),
					})
					.strict(),
				["source_file", "file_path", "local_path"],
				"Provide source_file, file_path, or local_path.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UETextureTool("import_texture", {
						source_file: requiredStringParam(params, ["source_file", "file_path", "local_path"]),
						destination_path: optionalStringParam(params, [
							"destination_path",
							"content_path",
							"path",
						]),
						asset_name: optionalStringParam(params, ["asset_name", "name"]),
						replace_existing:
							typeof params.replace_existing === "boolean" ? params.replace_existing : true,
						save: typeof params.save === "boolean" ? params.save : true,
					}),
				),
		},
	})

	registerToolNamespace("manage_data", ctx.toolDescription("manage_data"), {
		search_data_assets: {
			paramsSchema: z
				.object({
					search_term: z.string().optional(),
					query: z.string().optional(),
					pattern: z.string().optional(),
					name: z.string().optional(),
					include_engine: z.boolean().optional(),
					limit: z.number().optional(),
				})
				.strict(),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEDataTool("search_data_assets", {
						search_term:
							optionalStringParam(params, ["search_term", "query", "pattern", "name"]) ?? "",
						include_engine: Boolean(params.include_engine),
						limit: params.limit,
					}),
				),
		},
		asset_info: {
			paramsSchema: assetLookupSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"])),
				),
		},
		create_data_asset: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						name: z.string().optional(),
						asset_name: z.string().optional(),
						path: z.string().optional(),
						data_asset_class: z.string().optional(),
						class_name: z.string().optional(),
					})
					.strict(),
				["name", "asset_name"],
				"Provide name or asset_name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEDataTool("create_data_asset", {
						name: requiredStringParam(params, ["name", "asset_name"]),
						path: optionalStringParam(params, ["path"]),
						data_asset_class: optionalStringParam(params, ["data_asset_class", "class_name"]),
					}),
				),
		},
		create_data_table: {
			paramsSchema: requireAtLeastOneValue(
				requireAtLeastOneValue(
					z
						.object({
							name: z.string().optional(),
							asset_name: z.string().optional(),
							path: z.string().optional(),
							row_struct: z.string().optional(),
							struct: z.string().optional(),
						})
						.strict(),
					["name", "asset_name"],
					"Provide name or asset_name.",
				),
				["row_struct", "struct"],
				"Provide row_struct or struct.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEDataTool("create_data_table", {
						name: requiredStringParam(params, ["name", "asset_name"]),
						path: optionalStringParam(params, ["path"]),
						row_struct: requiredStringParam(params, ["row_struct", "struct"]),
					}),
				),
		},
		create_string_table: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						name: z.string().optional(),
						asset_name: z.string().optional(),
						path: z.string().optional(),
					})
					.strict(),
				["name", "asset_name"],
				"Provide name or asset_name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEDataTool("create_string_table", {
						name: requiredStringParam(params, ["name", "asset_name"]),
						path: optionalStringParam(params, ["path"]),
					}),
				),
		},
	})
}
