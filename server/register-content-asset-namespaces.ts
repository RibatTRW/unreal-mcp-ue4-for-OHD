import { Effect } from "effect"
import { z } from "zod"
import type { ToolError } from "./effect/errors.js"

import {
	actorNameSchema,
	actorNameShape,
	assetLookupSchema,
	assetPathParam,
	blueprintNameShape,
	materialColorShape,
	pagedReadParams,
	requireAtLeastOneValue,
	searchAssetsShape,
} from "./namespace-action-schema-fragments.js"
import type { RegistrationDispatch, RegistrationParams, RegistrationSchemas } from "./registration-context.js"
import type { ToolCatalogEntry } from "./tool-catalog-types.js"
import { createToolDescriptionLookup } from "./tool-catalog-types.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

/**
 * Catalog entries co-located with the namespace registration below.
 * Adding a tool here needs no edit to a separate catalog file.
 */
export const contentAssetEntries: ToolCatalogEntry[] = [
	{
		name: "manage_skeleton",
		category: "Content & Authoring Tool Namespaces",
		description:
			"Skeleton tool namespace for searching Skeleton and SkeletalMesh assets and inspecting their metadata.",
	},
	{
		name: "manage_material",
		category: "Content & Authoring Tool Namespaces",
		description:
			"Material tool namespace for listing materials, applying them to actors or Blueprints, and tinting them with material instances.",
	},
	{
		name: "manage_texture",
		category: "Content & Authoring Tool Namespaces",
		description:
			"Texture tool namespace for searching texture assets, importing image files as textures, and reading their asset metadata.",
	},
	{
		name: "manage_data",
		category: "Content & Authoring Tool Namespaces",
		description:
			"Data tool namespace for searching data assets, creating common data containers, and inspecting their asset metadata.",
	},
]

const describeTool = createToolDescriptionLookup(contentAssetEntries)

export function contentAssetDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const {
		actorNameParam,
		blueprintNameParam,
		editorTools,
		optionalStringParam,
		pythonDispatch,
		requiredStringParam,
		searchAssetsCommand,
		toColorArray,
	} = ctx

	return [
		{
			name: "manage_skeleton",
			description: describeTool("manage_skeleton"),
			actions: {
				search_skeletons: {
					paramsSchema: z.object(searchAssetsShape).strict(),
					// Phase 5d (report §5): handler returns Effect; param-helper
					// and builder throws become channel failures via Effect.try
					// (Effect.sync would defect past dispatch's catchAll and break
					// the identical envelope), rendered verbatim downstream.
					handler: (params) =>
						Effect.try({
							try: () => pythonDispatch(searchAssetsCommand(params, "Skeleton")),
							catch: (cause) => cause as ToolError,
						}),
				},
				search_skeletal_meshes: {
					paramsSchema: z.object(searchAssetsShape).strict(),
					handler: (params) =>
						Effect.try({
							try: () => pythonDispatch(searchAssetsCommand(params, "SkeletalMesh")),
							catch: (cause) => cause as ToolError,
						}),
				},
				asset_info: {
					paramsSchema: assetLookupSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"]))),
							catch: (cause) => cause as ToolError,
						}),
				},
			},
		},
		{
			name: "manage_material",
			description: describeTool("manage_material"),
			actions: {
				list_materials: {
					paramsSchema: z
						.object({
							search_term: z.string().optional(),
							query: z.string().optional(),
							include_engine: z.boolean().optional(),
							...pagedReadParams,
						})
						.strict(),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEMaterialTool("get_available_materials", {
										search_term: optionalStringParam(params, ["search_term", "query"]),
										include_engine: params.include_engine,
										limit: params.limit,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEMaterialTool("apply_material_to_actor", {
										actor_name: actorNameParam(params),
										component_name: optionalStringParam(params, ["component_name"]),
										material_path: requiredStringParam(params, ["material_path"]),
										slot_index: params.slot_index,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEMaterialTool("apply_material_to_blueprint", {
										blueprint_name: blueprintNameParam(params),
										component_name: requiredStringParam(params, ["component_name"]),
										material_path: requiredStringParam(params, ["material_path"]),
										slot_index: params.slot_index,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				tint_material: {
					paramsSchema: requireAtLeastOneValue(
						z
							.object({
								...materialColorShape,
								actor_name: z.string().optional(),
								name: z.string().optional(),
								blueprint_name: z.string().optional(),
								asset_path: assetPathParam,
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEMaterialTool("set_mesh_material_color", {
										actor_name: optionalStringParam(params, ["actor_name", "name"]),
										blueprint_name: optionalStringParam(params, ["blueprint_name", "asset_path"]),
										component_name: optionalStringParam(params, ["component_name"]),
										material_path: optionalStringParam(params, ["material_path"]),
										slot_index: params.slot_index,
										color: toColorArray(params.color),
										parameter_name: optionalStringParam(params, ["parameter_name"]),
										instance_name: optionalStringParam(params, ["instance_name"]),
										instance_path: optionalStringParam(params, ["instance_path"]),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
			},
		},
		{
			name: "manage_texture",
			description: describeTool("manage_texture"),
			actions: {
				search_textures: {
					paramsSchema: z.object(searchAssetsShape).strict(),
					handler: (params) =>
						Effect.try({
							try: () => pythonDispatch(searchAssetsCommand(params, "Texture")),
							catch: (cause) => cause as ToolError,
						}),
				},
				texture_info: {
					paramsSchema: assetLookupSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"]))),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UETextureTool("import_texture", {
										source_file: requiredStringParam(params, ["source_file", "file_path", "local_path"]),
										destination_path: optionalStringParam(params, ["destination_path", "content_path", "path"]),
										asset_name: optionalStringParam(params, ["asset_name", "name"]),
										replace_existing: typeof params.replace_existing === "boolean" ? params.replace_existing : true,
										save: typeof params.save === "boolean" ? params.save : true,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
			},
		},
		{
			name: "manage_data",
			description: describeTool("manage_data"),
			actions: {
				search_data_assets: {
					paramsSchema: z
						.object({
							search_term: z.string().optional(),
							query: z.string().optional(),
							pattern: z.string().optional(),
							name: z.string().optional(),
							include_engine: z.boolean().optional(),
							...pagedReadParams,
						})
						.strict(),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEDataTool("search_data_assets", {
										search_term: optionalStringParam(params, ["search_term", "query", "pattern", "name"]) ?? "",
										include_engine: Boolean(params.include_engine),
										limit: params.limit,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				asset_info: {
					paramsSchema: assetLookupSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"]))),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEDataTool("create_data_asset", {
										name: requiredStringParam(params, ["name", "asset_name"]),
										path: optionalStringParam(params, ["path"]),
										data_asset_class: optionalStringParam(params, ["data_asset_class", "class_name"]),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEDataTool("create_data_table", {
										name: requiredStringParam(params, ["name", "asset_name"]),
										path: optionalStringParam(params, ["path"]),
										row_struct: requiredStringParam(params, ["row_struct", "struct"]),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEDataTool("create_string_table", {
										name: requiredStringParam(params, ["name", "asset_name"]),
										path: optionalStringParam(params, ["path"]),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
			},
		},
	]
}
