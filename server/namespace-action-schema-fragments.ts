import { z } from "zod"

import {
	colorInputSchema,
	rotatorInputSchema,
	vector2InputSchema,
	vector3InputSchema,
} from "./registration-context-schemas.js"

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
	widget_name: z.string().optional(),
	blueprint_name: z.string().optional(),
}

export const widgetBlueprintKeys = ["widget_blueprint", "widget_blueprint_path", "widget_name", "blueprint_name"]
export const widgetBlueprintMessage = "Provide widget_blueprint, widget_blueprint_path, widget_name, or blueprint_name."

export const widgetBlueprintAssetShape = {
	widget_blueprint_path: z.string().optional(),
	widget_blueprint: z.string().optional(),
}
export const widgetBlueprintAssetKeys = ["widget_blueprint_path", "widget_blueprint"]
export const widgetBlueprintAssetMessage = "Provide widget_blueprint_path or widget_blueprint."

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
	["widget_blueprint", "widget_blueprint_path", "widget_name", "blueprint_name"],
	"Provide widget_blueprint, widget_blueprint_path, widget_name, or blueprint_name.",
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
