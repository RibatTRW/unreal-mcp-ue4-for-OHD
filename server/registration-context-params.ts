import type * as editorTools from "./editor/tools.js"
import { MissingParamError } from "./effect/errors.js"
import { missingParamMessage } from "./effect/schema-patterns.js"
import type { RegistrationSchemas } from "./registration-context-schemas.js"

export type ActionParams = Record<string, unknown>

export interface RegistrationParams {
	actorNameParam: (params: ActionParams) => string
	assetPathListParam: (params: ActionParams) => string | string[] | undefined
	blueprintNameParam: (params: ActionParams) => string
	optionalStringListParam: (params: ActionParams, keys: string[]) => string[] | undefined
	optionalStringParam: (params: ActionParams, keys: string[]) => string | undefined
	requiredStringListParam: (params: ActionParams, keys: string[]) => string[]
	requiredStringParam: (params: ActionParams, keys: string[]) => string
	searchAssetsCommand: (params: ActionParams, defaultAssetClass?: string) => string
	sourceControlFileListParam: (params: ActionParams) => string[]
	sourceControlFileParam: (params: ActionParams) => string
	sourceControlFilesCommand: (files: string[], singleOperation?: string, multiOperation?: string) => string
	sourceControlPackageListParam: (params: ActionParams) => string[]
	widgetBlueprintParam: (params: ActionParams) => string
	worldBuildCommand: (operation: string, params: ActionParams) => string
}

export function createRegistrationParamHelpers(
	tools: typeof editorTools,
	codecs: Pick<RegistrationSchemas, "toVector3Array">,
): RegistrationParams {
	const { toVector3Array } = codecs
	const stringOrStringArrayParam = (params: ActionParams, keys: string[]) => {
		for (const key of keys) {
			const value = params[key]
			if (Array.isArray(value)) {
				const normalizedValues = value
					.filter((entry) => typeof entry === "string")
					.map((entry) => entry.trim())
					.filter(Boolean)

				if (normalizedValues.length > 0) {
					return normalizedValues
				}
			}

			if (typeof value === "string" && value.trim()) {
				return value.trim()
			}
		}

		return undefined
	}

	// Phase 4 (report §4.2): required-param throws are MissingParamError, not
	// plain Errors. Sync signatures are unchanged so unmigrated registrars
	// keep compiling; dispatch renders these through the identical envelope
	// via missingParamMessage(key). .message is set explicitly because
	// Data.TaggedError defaults it to "" (Phase-2/3 precedent).
	const missingParam = (key: string): MissingParamError => {
		const error = new MissingParamError({ key })
		error.message = missingParamMessage(key)
		return error
	}

	const requiredStringParam = (params: ActionParams, keys: string[]) => {
		for (const key of keys) {
			const value = params[key]
			if (typeof value === "string" && value.trim()) {
				return value.trim()
			}
		}

		throw missingParam(keys[0])
	}

	const optionalStringParam = (params: ActionParams, keys: string[]) => {
		for (const key of keys) {
			const value = params[key]
			if (typeof value === "string" && value.trim()) {
				return value.trim()
			}
		}

		return undefined
	}

	const optionalStringListParam = (params: ActionParams, keys: string[]) => {
		for (const key of keys) {
			const value = params[key]
			if (Array.isArray(value)) {
				const normalizedValues = value
					.filter((entry) => typeof entry === "string")
					.map((entry) => entry.trim())
					.filter(Boolean)

				if (normalizedValues.length > 0) {
					return normalizedValues
				}
			}

			if (typeof value === "string" && value.trim()) {
				return [value.trim()]
			}
		}

		return undefined
	}

	const requiredStringListParam = (params: ActionParams, keys: string[]) => {
		const values = optionalStringListParam(params, keys)
		if (values && values.length > 0) {
			return values
		}

		throw missingParam(keys[0])
	}

	const assetPathListParam = (params: ActionParams) => stringOrStringArrayParam(params, ["asset_paths", "paths"])

	const searchAssetsCommand = (params: ActionParams, defaultAssetClass?: string) =>
		tools.UESearchAssets(
			optionalStringParam(params, ["search_term", "query", "pattern", "name"]) ?? "",
			optionalStringParam(params, ["asset_class", "class_name", "class"]) ?? defaultAssetClass,
			// Zod-validated at the boundary (boolean | undefined at runtime);
			// the casts only recover the static type, never change values.
			params.include_engine as boolean | undefined,
			params.limit as number | undefined,
		)

	const actorNameParam = (params: ActionParams) => requiredStringParam(params, ["name", "actor_name"])

	const blueprintNameParam = (params: ActionParams) =>
		requiredStringParam(params, ["blueprint_name", "asset_path", "name"])

	const widgetBlueprintParam = (params: ActionParams) =>
		requiredStringParam(params, [
			"widget_blueprint",
			"widget_blueprint_path",
			"widget_path",
			"asset_path",
			"widget_name",
			"blueprint_name",
		])

	const sourceControlFileParam = (params: ActionParams) =>
		requiredStringParam(params, ["file", "path", "asset_path", "package", "name"])

	const sourceControlFileListParam = (params: ActionParams) =>
		requiredStringListParam(params, [
			"files",
			"paths",
			"asset_paths",
			"packages",
			"file",
			"path",
			"asset_path",
			"package",
			"name",
		])

	const sourceControlPackageListParam = (params: ActionParams) =>
		requiredStringListParam(params, ["packages", "package_names", "paths", "asset_paths", "package", "path"])

	const sourceControlFilesCommand = (files: string[], singleOperation?: string, multiOperation?: string) => {
		if (singleOperation && files.length === 1) {
			return tools.UESourceControlTool(singleOperation, { file: files[0] })
		}

		return tools.UESourceControlTool(multiOperation ?? singleOperation!, { files })
	}

	const worldBuildCommand = (operation: string, params: ActionParams) =>
		tools.UEWorldBuildingTool(operation, {
			...params,
			location: toVector3Array(params.location),
		})

	return {
		actorNameParam,
		assetPathListParam,
		blueprintNameParam,
		optionalStringListParam,
		optionalStringParam,
		requiredStringListParam,
		requiredStringParam,
		searchAssetsCommand,
		sourceControlFileListParam,
		sourceControlFileParam,
		sourceControlFilesCommand,
		sourceControlPackageListParam,
		widgetBlueprintParam,
		worldBuildCommand,
	}
}
