import { z } from "zod"

import {
	actorNameShape,
	actorNameSchema,
	assetLookupShape,
	assetLookupSchema,
	assetSourceLookupShape,
	blueprintNameShape,
	requireAtLeastOneValue,
	searchAssetsShape,
	vector3TransformShape,
} from "./namespace-action-schema-fragments.js"
import {
	RegistrationDispatch,
	RegistrationParams,
	RegistrationSchemas,
} from "./registration-context.js"

const assetMutationParamsSchema = requireAtLeastOneValue(
	requireAtLeastOneValue(
		z
			.object({
				...assetSourceLookupShape,
				destination_asset_path: z.string().optional(),
				target_asset_path: z.string().optional(),
				destination_path: z.string().optional(),
				new_name: z.string().optional(),
				name: z.string().optional(),
			})
			.strict(),
		["source_asset_path", "source_path", "asset_path", "path"],
		"Provide source_asset_path, source_path, asset_path, or path.",
	),
	["destination_asset_path", "target_asset_path", "destination_path", "new_name", "name"],
	"Provide destination_asset_path, target_asset_path, destination_path, new_name, or name for the destination.",
).describe(
	"Provide one of source_asset_path, source_path, asset_path, or path. Provide destination_asset_path, target_asset_path, destination_path, new_name, or name for the new asset location.",
)

export function registerCoreAssetActorNamespaces(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
) {
	const {
		actorNameParam,
		assetPathListParam,
		blueprintNameParam,
		editorTools,
		optionalStringParam,
		pythonDispatch,
		registerToolNamespace,
		requiredStringParam,
		searchAssetsCommand,
		toRotatorArray,
		toVector3Array,
	} = ctx

	const blueprintTargetNoNameShape = {
		blueprint_name: z.string().optional(),
		asset_path: z.string().optional(),
	}

	const assetMutationPayload = (params: Record<string, any>) => ({
		source_asset_path: requiredStringParam(params, ["source_asset_path", "source_path", "asset_path", "path"]),
		destination_asset_path: optionalStringParam(params, ["destination_asset_path", "target_asset_path"]),
		destination_path: optionalStringParam(params, ["destination_path"]),
		new_name: optionalStringParam(params, ["new_name", "name"]),
	})
	const assetPathListInputSchema = z.union([z.string(), z.array(z.string())])

	const assetMutationHandler = (operation: "duplicate" | "rename" | "move") => (params: Record<string, any>) =>
		pythonDispatch(editorTools.UEAssetManagementTool(operation, assetMutationPayload(params)))

	registerToolNamespace("manage_asset", ctx.toolDescription("manage_asset"), {
		list: {
			paramsSchema: z
				.object({
					root_path: z.string().optional(),
					path: z.string().optional(),
					recursive: z.boolean().optional(),
					limit: z.number().optional(),
				})
				.strict(),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEListAssets(
						optionalStringParam(params, ["root_path", "path"]) ?? "/Game",
						typeof params.recursive === "boolean" ? params.recursive : true,
						typeof params.limit === "number" ? params.limit : undefined,
					),
				),
		},
		search: {
			paramsSchema: z.object(searchAssetsShape).strict(),
			handler: (params) => pythonDispatch(searchAssetsCommand(params)),
		},
		info: {
			paramsSchema: assetLookupSchema,
			handler: (params) =>
				pythonDispatch(editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"]))),
		},
		references: {
			paramsSchema: assetLookupSchema,
			handler: (params) =>
				pythonDispatch(editorTools.UEGetAssetReferences(requiredStringParam(params, ["asset_path", "path", "name"]))),
		},
		exists: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...assetLookupShape,
						asset_paths: z.array(z.string()).optional(),
					})
					.strict(),
				["asset_path", "path", "name", "asset_paths"],
				"Provide asset_path, path, name, or asset_paths.",
			).describe("Provide asset_path/path/name for one asset, or asset_paths for multiple assets."),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEAssetManagementTool("exists", {
						asset_path: optionalStringParam(params, ["asset_path", "path", "name"]),
						asset_paths: params.asset_paths,
					}),
				),
		},
		duplicate: {
			paramsSchema: assetMutationParamsSchema,
			handler: assetMutationHandler("duplicate"),
		},
		rename: {
			paramsSchema: assetMutationParamsSchema,
			handler: assetMutationHandler("rename"),
		},
		move: {
			paramsSchema: assetMutationParamsSchema,
			handler: assetMutationHandler("move"),
		},
		delete: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...assetLookupShape,
						asset_paths: z.array(z.string()).optional(),
					})
					.strict(),
				["asset_path", "path", "name", "asset_paths"],
				"Provide asset_path, path, name, or asset_paths.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEAssetManagementTool("delete", {
						asset_path: optionalStringParam(params, ["asset_path", "path", "name"]),
						asset_paths: params.asset_paths,
					}),
				),
		},
		save: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...assetLookupShape,
						asset_paths: z.array(z.string()).optional(),
						only_if_is_dirty: z.boolean().optional(),
					})
					.strict(),
				["asset_path", "path", "name", "asset_paths"],
				"Provide asset_path, path, name, or asset_paths.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEAssetManagementTool("save", {
						asset_path: optionalStringParam(params, ["asset_path", "path", "name"]),
						asset_paths: params.asset_paths,
						only_if_is_dirty: typeof params.only_if_is_dirty === "boolean" ? params.only_if_is_dirty : undefined,
					}),
				),
		},
		create_folder: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						directory_path: z.string().optional(),
						folder_path: z.string().optional(),
						path: z.string().optional(),
					})
					.strict(),
				["directory_path", "folder_path", "path"],
				"Provide directory_path, folder_path, or path.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEAssetManagementTool("create_folder", {
						directory_path: requiredStringParam(params, ["directory_path", "folder_path", "path"]),
					}),
				),
		},
		list_folder: {
			paramsSchema: z
				.object({
					directory_path: z.string().optional(),
					folder_path: z.string().optional(),
					path: z.string().optional(),
					recursive: z.boolean().optional(),
				})
				.strict(),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEAssetManagementTool("list_folder", {
						directory_path: optionalStringParam(params, ["directory_path", "folder_path", "path"]) ?? "/Game",
						recursive: typeof params.recursive === "boolean" ? params.recursive : undefined,
					}),
				),
		},
		delete_folder: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						directory_path: z.string().optional(),
						folder_path: z.string().optional(),
						path: z.string().optional(),
					})
					.strict(),
				["directory_path", "folder_path", "path"],
				"Provide directory_path, folder_path, or path.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEAssetManagementTool("delete_folder", {
						directory_path: requiredStringParam(params, ["directory_path", "folder_path", "path"]),
					}),
				),
		},
		export: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...assetLookupShape,
						destination_path: z.string().optional(),
						file_path: z.string().optional(),
						output_path: z.string().optional(),
						overwrite: z.boolean().optional(),
					})
					.strict(),
				["asset_path", "path", "name"],
				"Provide asset_path, path, or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEExportAsset(
						requiredStringParam(params, ["asset_path", "path", "name"]),
						optionalStringParam(params, ["destination_path", "file_path", "output_path"]),
						typeof params.overwrite === "boolean" ? params.overwrite : true,
					),
				),
		},
		validate: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						asset_paths: assetPathListInputSchema.optional(),
						paths: assetPathListInputSchema.optional(),
					})
					.strict(),
				["asset_paths", "paths"],
				"Provide asset_paths or paths as a string, comma-separated string, or string array.",
			),
			handler: (params) =>
				pythonDispatch(editorTools.UEValidateAssets(assetPathListParam(params))),
		},
	})

	registerToolNamespace("manage_actor", ctx.toolDescription("manage_actor"), {
		list: {
			handler: () => pythonDispatch(editorTools.UEActorTool("get_actors_in_level")),
		},
		find: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						pattern: z.string().optional(),
						name: z.string().optional(),
					})
					.strict(),
				["pattern", "name"],
				"Provide pattern or name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("find_actors_by_name", {
						pattern: requiredStringParam(params, ["pattern", "name"]),
					}),
				),
		},
		spawn: {
			paramsSchema: z
				.object({
					type: z.string().optional(),
					actor_type: z.string().optional(),
					class_name: z.string().optional(),
					...actorNameShape,
					location: z
						.union([
							z.object({ x: z.number(), y: z.number(), z: z.number() }),
							z.tuple([z.number(), z.number(), z.number()]),
						])
						.optional(),
					rotation: z
						.union([
							z.object({ pitch: z.number(), yaw: z.number(), roll: z.number() }),
							z.tuple([z.number(), z.number(), z.number()]),
						])
						.optional(),
				})
				.strict(),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("spawn_actor", {
						type: optionalStringParam(params, ["type", "actor_type", "class_name"]) ?? "StaticMeshActor",
						name: optionalStringParam(params, ["name", "actor_name"]),
						location: toVector3Array(params.location),
						rotation: toRotatorArray(params.rotation),
					}),
				),
		},
		spawn_blueprint: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...blueprintTargetNoNameShape,
						...actorNameShape,
						...vector3TransformShape,
						properties: z.record(z.any()).optional(),
					})
					.strict(),
				["blueprint_name", "asset_path"],
				"Provide blueprint_name or asset_path.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("spawn_blueprint_actor", {
						blueprint_name: requiredStringParam(params, ["blueprint_name", "asset_path"]),
						name: optionalStringParam(params, ["name", "actor_name"]),
						location: toVector3Array(params.location),
						rotation: toRotatorArray(params.rotation),
						scale: toVector3Array(params.scale),
						properties: params.properties,
					}),
				),
		},
		delete: {
			paramsSchema: actorNameSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("delete_actor", {
						name: actorNameParam(params),
					}),
				),
		},
		transform: {
			paramsSchema: requireAtLeastOneValue(
				z.object({ ...actorNameShape, ...vector3TransformShape }).strict(),
				["name", "actor_name"],
				"Provide name or actor_name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("set_actor_transform", {
						name: actorNameParam(params),
						location: toVector3Array(params.location),
						rotation: toRotatorArray(params.rotation),
						scale: toVector3Array(params.scale),
					}),
				),
		},
		get_properties: {
			paramsSchema: actorNameSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("get_actor_properties", {
						name: actorNameParam(params),
					}),
				),
		},
		set_property: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						...actorNameShape,
						property_name: z.string(),
						property_value: z.any().optional(),
					})
					.strict(),
				["name", "actor_name"],
				"Provide name or actor_name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("set_actor_property", {
						name: actorNameParam(params),
						property_name: requiredStringParam(params, ["property_name"]),
						property_value: params.property_value,
					}),
				),
		},
		get_material_info: {
			paramsSchema: actorNameSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEActorTool("get_actor_material_info", {
						name: actorNameParam(params),
					}),
				),
		},
	})
}
