import { z } from "zod"

import {
	colorInputSchema,
	rotatorInputSchema,
	vector2InputSchema,
	vector3InputSchema,
} from "./registration-context-schemas.js"
// ---------------------------------------------------------------------------
// FROZEN ZOD BOUNDARY (report §4.4). Everything Zod in this file stays
// byte-identical: registrars build action paramsSchemas from these helpers
// and shapes, and dispatch derives the registered SDK inputSchema from
// those. Client-visible custom messages below are verbatim contract — the
// surface snapshot plus scripts/check-dispatch-envelope.mjs lock them.
// The effect/Schema forward path for migrated registrars (Phase 5) lives
// in server/effect/schema-patterns.ts (atLeastOneValue/valueGroups) and is
// re-exported at the bottom of this file for registrar convenience.
// ---------------------------------------------------------------------------

const hasMeaningfulValue = (value: unknown): boolean => {
	if (typeof value === "string") {
		return value.trim().length > 0
	}

	if (Array.isArray(value)) {
		return value.some((entry) => hasMeaningfulValue(entry))
	}

	return value !== undefined && value !== null
}

export function requireAtLeastOneValue<T extends z.ZodTypeAny>(schema: T, keys: string[], message: string) {
	return schema.superRefine((params, ctx) => {
		const record = params && typeof params === "object" ? (params as Record<string, unknown>) : {}
		if (keys.some((key) => hasMeaningfulValue(record[key]))) {
			return
		}

		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message,
		})
	})
}

export function strictObject<Shape extends z.ZodRawShape>(shape: Shape) {
	return z.object(shape).strict()
}

export function requireValueGroups<T extends z.ZodTypeAny>(
	schema: T,
	groups: Array<{ keys: string[]; message: string }>,
) {
	return groups.reduce<z.ZodTypeAny>(
		(currentSchema, group) => requireAtLeastOneValue(currentSchema, group.keys, group.message),
		schema,
	)
}

export const assetLookupShape = {
	asset_path: z.string().optional(),
	path: z.string().optional(),
	name: z.string().optional(),
}

export const assetSourceLookupShape = {
	source_asset_path: z.string().optional(),
	source_path: z.string().optional(),
	asset_path: z.string().optional(),
	path: z.string().optional(),
}

export const actorNameShape = {
	name: z.string().optional(),
	actor_name: z.string().optional(),
}

export const blueprintNameShape = {
	blueprint_name: z.string().optional(),
	asset_path: z.string().optional(),
	name: z.string().optional(),
}

export const widgetBlueprintShape = {
	widget_blueprint: z.string().optional(),
	widget_blueprint_path: z.string().optional(),
	widget_path: z.string().optional(),
	asset_path: z.string().optional(),
	widget_name: z.string().optional(),
	blueprint_name: z.string().optional(),
}

export const widgetBlueprintKeys = [
	"widget_blueprint",
	"widget_blueprint_path",
	"widget_path",
	"asset_path",
	"widget_name",
	"blueprint_name",
]
export const widgetBlueprintMessage =
	"Provide widget_blueprint, widget_blueprint_path, widget_path, asset_path, widget_name, or blueprint_name."

export const widgetBlueprintAssetShape = {
	widget_blueprint_path: z.string().optional(),
	widget_blueprint: z.string().optional(),
	widget_path: z.string().optional(),
	asset_path: z.string().optional(),
}
export const widgetBlueprintAssetKeys = ["widget_blueprint_path", "widget_blueprint", "widget_path", "asset_path"]
export const widgetBlueprintAssetMessage =
	"Provide widget_blueprint_path, widget_blueprint, widget_path, or asset_path."

export const widgetNameKeys = ["widget_name", "name"]
export const widgetNameMessage = "Provide widget_name or name."

export const childWidgetNameKeys = ["child_widget_name", "name"]
export const childWidgetNameMessage = "Provide child_widget_name or name."

export const sourceControlFileShape = {
	file: z.string().optional(),
	path: z.string().optional(),
	asset_path: z.string().optional(),
	package: z.string().optional(),
	name: z.string().optional(),
}

export const sourceControlFilesShape = {
	files: z.array(z.string()).optional(),
	paths: z.array(z.string()).optional(),
	asset_paths: z.array(z.string()).optional(),
	packages: z.array(z.string()).optional(),
	file: z.string().optional(),
	path: z.string().optional(),
	asset_path: z.string().optional(),
	package: z.string().optional(),
	name: z.string().optional(),
}

export const sourceControlPackagesShape = {
	packages: z.array(z.string()).optional(),
	package_names: z.array(z.string()).optional(),
	paths: z.array(z.string()).optional(),
	asset_paths: z.array(z.string()).optional(),
	package: z.string().optional(),
	path: z.string().optional(),
}

export const searchAssetsShape = {
	search_term: z.string().optional(),
	query: z.string().optional(),
	pattern: z.string().optional(),
	name: z.string().optional(),
	asset_class: z.string().optional(),
	class_name: z.string().optional(),
	class: z.string().optional(),
	include_engine: z.boolean().optional(),
	limit: z.number().optional(),
}

// Canonical scalar fragments (S4): single shared instances so the next
// validation change lands once. All bare (no .describe) to match the
// call-sites they replace — the surface snapshot pins byte-identity.
export const limitParam = z.number().optional()

export const assetPathParam = z.string().optional()

// Paged-read growth point (S4 for S3): spread into list/search paramsSchemas
// (`...pagedReadParams`). Holds only `limit` today — `offset`/`fields` stay
// out until S3 adds bounded reads, since adding them now would silently widen
// today's `.strict()` objects. Key order is preserved when spread last.
export const pagedReadParams = {
	limit: limitParam,
}

export const vector3TransformShape = {
	location: vector3InputSchema.optional(),
	rotation: rotatorInputSchema.optional(),
	scale: vector3InputSchema.optional(),
}

export const vector2PlacementShape = {
	position: vector2InputSchema.optional(),
	size: vector2InputSchema.optional(),
}

export const materialColorShape = {
	color: colorInputSchema.optional(),
}

export const assetLookupSchema = requireAtLeastOneValue(
	z.object(assetLookupShape).strict(),
	["asset_path", "path", "name"],
	"Provide asset_path, path, or name.",
)

export const assetSourceLookupSchema = requireAtLeastOneValue(
	z.object(assetSourceLookupShape).strict(),
	["source_asset_path", "source_path", "asset_path", "path"],
	"Provide source_asset_path, source_path, asset_path, or path.",
)

export const actorNameSchema = requireAtLeastOneValue(
	z.object(actorNameShape).strict(),
	["name", "actor_name"],
	"Provide name or actor_name.",
)

export const blueprintNameSchema = requireAtLeastOneValue(
	z.object(blueprintNameShape).strict(),
	["blueprint_name", "asset_path", "name"],
	"Provide blueprint_name, asset_path, or name.",
)

export const widgetBlueprintSchema = requireAtLeastOneValue(
	z.object(widgetBlueprintShape).strict(),
	widgetBlueprintKeys,
	widgetBlueprintMessage,
)

export const sourceControlFileSchema = requireAtLeastOneValue(
	z.object(sourceControlFileShape).strict(),
	["file", "path", "asset_path", "package", "name"],
	"Provide file, path, asset_path, package, or name.",
)

export const sourceControlFilesSchema = requireAtLeastOneValue(
	z.object(sourceControlFilesShape).strict(),
	["files", "paths", "asset_paths", "packages", "file", "path", "asset_path", "package", "name"],
	"Provide files, paths, asset_paths, packages, file, path, asset_path, package, or name.",
)

export const sourceControlPackagesSchema = requireAtLeastOneValue(
	z.object(sourceControlPackagesShape).strict(),
	["packages", "package_names", "paths", "asset_paths", "package", "path"],
	"Provide packages, package_names, paths, asset_paths, package, or path.",
)

// ---------------------------------------------------------------------------
// effect/Schema forward path (report §4.1). Migrated registrars (Phase 5)
// compose Schema.Struct validation with these filters instead of the Zod
// helpers above; dispatch validates both forms and renders failures into
// the identical `Invalid params for <tool>.<action>: ...` envelope.
// Excess-property rejection comes from dispatch's strict decode options
// (Schema.Struct strips unknown keys by default), not from the schema
// itself — see strictDecodeSync in server/effect/schema-patterns.ts.
// ---------------------------------------------------------------------------

export { atLeastOneValue, hasMeaningfulValue, valueGroups } from "./effect/schema-patterns.js"
export type { ValueGroup } from "./effect/schema-patterns.js"
