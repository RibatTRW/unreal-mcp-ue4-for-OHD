import { Effect } from "effect"
import { z } from "zod"

import type { ToolError } from "./effect/errors.js"
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
					// Phase 5a (report §5): handler returns Effect; param-helper
					// and builder throws become channel failures via Effect.try
					// (Effect.sync would defect past dispatch's catchAll and break
					// the identical envelope), rendered verbatim downstream.
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"]))),
							catch: (cause) => cause as ToolError,
						}),
				},
				asset_references: {
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
				actor: {
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
				actor_materials: {
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UEBlueprintAnalysisTool("read_blueprint_content", {
										blueprint_name: blueprintNameParam(params),
										include_nodes: Boolean(params.include_nodes),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				map: shared.map_info,
			},
		},
	]
}
