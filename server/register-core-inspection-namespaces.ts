import { z } from "zod"

import {
	actorNameSchema,
	assetLookupSchema,
	blueprintNameShape,
	requireAtLeastOneValue,
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
export const coreInspectionEntries: ToolCatalogEntry[] = [
	{
		name: "manage_inspection",
		category: "Core Tool Namespaces",
		description: "Inspection tool namespace for asset, actor, map, and basic Blueprint summary actions.",
	},
]

const describeTool = createToolDescriptionLookup(coreInspectionEntries)

export function coreInspectionDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const { actorNameParam, blueprintNameParam, editorTools, pythonDispatch, requiredStringParam } = ctx
	const shared = sharedReadOnlyActions(ctx)

	return [
		{
			name: "manage_inspection",
			description: describeTool("manage_inspection"),
			actions: {
				asset: {
					paramsSchema: assetLookupSchema,
					handler: (params) =>
						pythonDispatch(editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"]))),
				},
				asset_references: {
					paramsSchema: assetLookupSchema,
					handler: (params) =>
						pythonDispatch(
							editorTools.UEGetAssetReferences(requiredStringParam(params, ["asset_path", "path", "name"])),
						),
				},
				actor: {
					paramsSchema: actorNameSchema,
					handler: (params) =>
						pythonDispatch(
							editorTools.UEActorTool("get_actor_properties", {
								name: actorNameParam(params),
							}),
						),
				},
				actor_materials: {
					paramsSchema: actorNameSchema,
					handler: (params) =>
						pythonDispatch(
							editorTools.UEActorTool("get_actor_material_info", {
								name: actorNameParam(params),
							}),
						),
				},
				blueprint: {
					paramsSchema: requireAtLeastOneValue(
						z
							.object({
								...blueprintNameShape,
								include_nodes: z.boolean().optional(),
							})
							.strict(),
						["blueprint_name", "asset_path", "name"],
						"Provide blueprint_name, asset_path, or name.",
					),
					handler: (params) =>
						pythonDispatch(
							editorTools.UEBlueprintAnalysisTool("read_blueprint_content", {
								blueprint_name: blueprintNameParam(params),
								include_nodes: Boolean(params.include_nodes),
							}),
						),
				},
				map: shared.map_info,
			},
		},
	]
}
