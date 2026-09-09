import { Effect } from "effect"
import { z } from "zod"
import type { ToolError } from "./effect/errors.js"

import {
	actorNameSchema,
	actorNameShape,
	assetLookupSchema,
	assetLookupShape,
	assetPathParam,
	assetSourceLookupShape,
	blueprintNameShape,
	pagedReadParams,
	requireAtLeastOneValue,
	searchAssetsShape,
	vector3TransformShape,
} from "./namespace-action-schema-fragments.js"
import type { RegistrationDispatch, RegistrationParams, RegistrationSchemas } from "./registration-context.js"
import { sharedReadOnlyActions } from "./shared-read-only-actions.js"
import type { ToolCatalogEntry } from "./tool-catalog-types.js"
import { createToolDescriptionLookup } from "./tool-catalog-types.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

/**
 * Catalog entries co-located with the namespace registration below.
 * Adding a tool here needs no edit to a separate catalog file.
 */
export const coreAssetActorEntries: ToolCatalogEntry[] = [
	{
		name: "manage_asset",
		category: "Core Tool Namespaces",
		description:
			"Asset tool namespace for listing, searching, inspecting, exporting, validating, duplicating, renaming, moving, deleting, saving, and folder-management actions.",
	},
	{
		name: "manage_actor",
		category: "Core Tool Namespaces",
		description:
			"Actor tool namespace for listing, searching, spawning, deleting, transforming, and inspecting level actors.",
	},
]

const describeTool = createToolDescriptionLookup(coreAssetActorEntries)

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

export function coreAssetActorDescriptors(
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
		toRotatorArray,
		toVector3Array,
	} = ctx
	const shared = sharedReadOnlyActions(ctx)

	const blueprintTargetNoNameShape = {
		blueprint_name: z.string().optional(),
		asset_path: assetPathParam,
	}

	const assetMutationPayload = (params: Record<string, any>) => ({
		source_asset_path: requiredStringParam(params, ["source_asset_path", "source_path", "asset_path", "path"]),
		destination_asset_path: optionalStringParam(params, ["destination_asset_path", "target_asset_path"]),
		destination_path: optionalStringParam(params, ["destination_path"]),
		new_name: optionalStringParam(params, ["new_name", "name"]),
	})

	// Phase 5d (report §5): handler returns Effect; param-helper
	// and builder throws become channel failures via Effect.try
	// (Effect.sync would defect past dispatch's catchAll and break
	// the identical envelope), rendered verbatim downstream.
	const assetMutationHandler = (operation: "duplicate" | "rename" | "move") => (params: Record<string, any>) =>
		Effect.try({
			try: () => pythonDispatch(editorTools.UEAssetManagementTool(operation, assetMutationPayload(params))),
			catch: (cause) => cause as ToolError,
		})

	return [
		{
			name: "manage_asset",
			description: describeTool("manage_asset"),
			actions: {
				list: {
					paramsSchema: z
						.object({
							root_path: z.string().optional(),
							path: z.string().optional(),
							recursive: z.boolean().optional(),
							...pagedReadParams,
						})
						.strict(),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEListAssets(
										optionalStringParam(params, ["root_path", "path"]) ?? "/Game",
										typeof params.recursive === "boolean" ? params.recursive : true,
										typeof params.limit === "number" ? params.limit : undefined,
									),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				search: {
					paramsSchema: z.object(searchAssetsShape).strict(),
					handler: (params) =>
						Effect.try({
							try: () => pythonDispatch(searchAssetsCommand(params)),
							catch: (cause) => cause as ToolError,
						}),
				},
				info: {
					paramsSchema: assetLookupSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"]))),
							catch: (cause) => cause as ToolError,
						}),
				},
				references: {
					paramsSchema: assetLookupSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEGetAssetReferences(requiredStringParam(params, ["asset_path", "path", "name"])),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEAssetManagementTool("exists", {
										asset_path: optionalStringParam(params, ["asset_path", "path", "name"]),
										asset_paths: params.asset_paths,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEAssetManagementTool("delete", {
										asset_path: optionalStringParam(params, ["asset_path", "path", "name"]),
										asset_paths: params.asset_paths,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEAssetManagementTool("save", {
										asset_path: optionalStringParam(params, ["asset_path", "path", "name"]),
										asset_paths: params.asset_paths,
										only_if_is_dirty:
											typeof params.only_if_is_dirty === "boolean" ? params.only_if_is_dirty : undefined,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEAssetManagementTool("create_folder", {
										directory_path: requiredStringParam(params, ["directory_path", "folder_path", "path"]),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEAssetManagementTool("list_folder", {
										directory_path: optionalStringParam(params, ["directory_path", "folder_path", "path"]) ?? "/Game",
										recursive: typeof params.recursive === "boolean" ? params.recursive : undefined,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEAssetManagementTool("delete_folder", {
										directory_path: requiredStringParam(params, ["directory_path", "folder_path", "path"]),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEExportAsset(
										requiredStringParam(params, ["asset_path", "path", "name"]),
										optionalStringParam(params, ["destination_path", "file_path", "output_path"]),
										typeof params.overwrite === "boolean" ? params.overwrite : true,
									),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				validate: shared.validate_assets,
			},
			options: { compactParamsSchema: true },
		},
		{
			name: "manage_actor",
			description: describeTool("manage_actor"),
			actions: {
				list: {
					paramsSchema: z
						.object({
							limit: z.number().int().min(0).max(2000).optional(),
							offset: z.number().int().min(0).optional(),
						})
						.strict(),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("get_actors_in_level", {
										limit: typeof params.limit === "number" ? params.limit : undefined,
										offset: typeof params.offset === "number" ? params.offset : undefined,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				find: {
					paramsSchema: requireAtLeastOneValue(
						z
							.object({
								pattern: z.string().optional(),
								name: z.string().optional(),
								limit: z.number().int().min(0).max(2000).optional(),
								offset: z.number().int().min(0).optional(),
							})
							.strict(),
						["pattern", "name"],
						"Provide pattern or name.",
					),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("find_actors_by_name", {
										pattern: requiredStringParam(params, ["pattern", "name"]),
										limit: typeof params.limit === "number" ? params.limit : undefined,
										offset: typeof params.offset === "number" ? params.offset : undefined,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				spawn: {
					paramsSchema: z
						.object({
							type: z.string().optional(),
							actor_type: z.string().optional(),
							class_name: z.string().optional(),
							...actorNameShape,
							// S4 outlier: these unions are structurally identical to the
							// canonical vector3InputSchema/rotatorInputSchema, but reusing
							// those shared instances would change the rendered surface:
							// the SDK's schema converter dedupes repeat instances into
							// $refs, so spawn_blueprint's location would collapse into a
							// $ref and check-tool-surface would drift. Fresh inline
							// instances keep the snapshot byte-identical; see limitParam.
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("spawn_actor", {
										type: optionalStringParam(params, ["type", "actor_type", "class_name"]) ?? "StaticMeshActor",
										name: optionalStringParam(params, ["name", "actor_name"]),
										location: toVector3Array(params.location),
										rotation: toRotatorArray(params.rotation),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				spawn_blueprint: {
					paramsSchema: requireAtLeastOneValue(
						z
							.object({
								...blueprintTargetNoNameShape,
								...actorNameShape,
								...vector3TransformShape,
								properties: z.record(z.string(), z.any()).optional(),
							})
							.strict(),
						["blueprint_name", "asset_path"],
						"Provide blueprint_name or asset_path.",
					),
					handler: (params) =>
						Effect.try({
							try: () =>
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
							catch: (cause) => cause as ToolError,
						}),
				},
				delete: {
					paramsSchema: actorNameSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("delete_actor", {
										name: actorNameParam(params),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				transform: {
					paramsSchema: requireAtLeastOneValue(
						z.object({ ...actorNameShape, ...vector3TransformShape }).strict(),
						["name", "actor_name"],
						"Provide name or actor_name.",
					),
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("set_actor_transform", {
										name: actorNameParam(params),
										location: toVector3Array(params.location),
										rotation: toRotatorArray(params.rotation),
										scale: toVector3Array(params.scale),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				get_properties: {
					paramsSchema: actorNameSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("get_actor_properties", {
										name: actorNameParam(params),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("set_actor_property", {
										name: actorNameParam(params),
										property_name: requiredStringParam(params, ["property_name"]),
										property_value: params.property_value,
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				get_material_info: {
					paramsSchema: actorNameSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEActorTool("get_actor_material_info", {
										name: actorNameParam(params),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
			},
			options: { compactParamsSchema: true },
		},
	]
}
