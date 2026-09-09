import { Schema } from "effect"

import { atLeastOneValue } from "./effect/schema-patterns.js"
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

// Schema pilot: the first namespace migrated end-to-end from frozen Zod to
// effect/Schema paramsSchemas. Behavior contract: same accepted inputs, same
// `.strict()` excess rejection (via dispatch's strict decode options), same
// verbatim custom messages (via atLeastOneValue filter annotations), same
// identical invalid-params envelope. The SDK call-site inputSchema for these
// actions becomes a permissive record (the SDK pre-validates before our
// callback; strict validation runs inside) — that is the one expected
// listTools surface move, scoped to manage_inspection.
const assetLookupSchemaEffect = atLeastOneValue(
	Schema.Struct({
		asset_path: Schema.optional(Schema.String),
		path: Schema.optional(Schema.String),
		name: Schema.optional(Schema.String),
	}),
	["asset_path", "path", "name"],
	"Provide asset_path, path, or name.",
)

const actorNameSchemaEffect = atLeastOneValue(
	Schema.Struct({
		name: Schema.optional(Schema.String),
		actor_name: Schema.optional(Schema.String),
	}),
	["name", "actor_name"],
	"Provide name or actor_name.",
)

const blueprintNameSchemaEffect = atLeastOneValue(
	Schema.Struct({
		blueprint_name: Schema.optional(Schema.String),
		asset_path: Schema.optional(Schema.String),
		name: Schema.optional(Schema.String),
		include_nodes: Schema.optional(Schema.Boolean),
	}),
	["blueprint_name", "asset_path", "name"],
	"Provide blueprint_name, asset_path, or name.",
)

export function coreInspectionDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const { actorNameParam, blueprintNameParam, editorTools, cacheablePythonAction, pythonAction, requiredStringParam } =
		ctx
	const shared = sharedReadOnlyActions(ctx)

	return [
		{
			name: "manage_inspection",
			description: describeTool("manage_inspection"),
			actions: {
				asset: {
					paramsSchema: assetLookupSchemaEffect,
					handler: pythonAction((params) =>
						editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"])),
					),
				},
				asset_references: {
					paramsSchema: assetLookupSchemaEffect,
					handler: pythonAction((params) =>
						editorTools.UEGetAssetReferences(requiredStringParam(params, ["asset_path", "path", "name"])),
					),
				},
				actor: {
					paramsSchema: actorNameSchemaEffect,
					handler: cacheablePythonAction((params) =>
						editorTools.UEActorToolCommands("get_actor_properties", {
							name: actorNameParam(params),
						}),
					),
				},
				actor_materials: {
					paramsSchema: actorNameSchemaEffect,
					handler: cacheablePythonAction((params) =>
						editorTools.UEActorToolCommands("get_actor_material_info", {
							name: actorNameParam(params),
						}),
					),
				},
				blueprint: {
					paramsSchema: blueprintNameSchemaEffect,
					handler: pythonAction((params) =>
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
