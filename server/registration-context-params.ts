import * as editorTools from "./editor/tools.js"

export function createRegistrationParamHelpers(tools: typeof editorTools) {
	const stringOrStringArrayParam = (params: Record<string, any>, keys: string[]) => {
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

	const requiredStringParam = (params: Record<string, any>, keys: string[]) => {
		for (const key of keys) {
			const value = params[key]
			if (typeof value === "string" && value.trim()) {
				return value.trim()
			}
		}

		throw new Error(`${keys[0]} is required`)
	}

	const optionalStringParam = (params: Record<string, any>, keys: string[]) => {
		for (const key of keys) {
			const value = params[key]
			if (typeof value === "string" && value.trim()) {
				return value.trim()
			}
		}

		return undefined
	}

	const optionalStringListParam = (params: Record<string, any>, keys: string[]) => {
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

	const requiredStringListParam = (params: Record<string, any>, keys: string[]) => {
		const values = optionalStringListParam(params, keys)
		if (values && values.length > 0) {
			return values
		}

		throw new Error(`${keys[0]} is required`)
	}

	const assetPathListParam = (params: Record<string, any>) => stringOrStringArrayParam(params, ["asset_paths", "paths"])

	const searchAssetsCommand = (params: Record<string, any>, defaultAssetClass?: string) =>
		tools.UESearchAssets(
			optionalStringParam(params, ["search_term", "query", "pattern", "name"]) ?? "",
			optionalStringParam(params, ["asset_class", "class_name", "class"]) ?? defaultAssetClass,
			params.include_engine,
			params.limit,
		)

	const actorNameParam = (params: Record<string, any>) =>
		requiredStringParam(params, ["name", "actor_name"])

	const blueprintNameParam = (params: Record<string, any>) =>
		requiredStringParam(params, ["blueprint_name", "asset_path", "name"])

	const widgetBlueprintParam = (params: Record<string, any>) =>
		requiredStringParam(params, [
			"widget_blueprint",
			"widget_blueprint_path",
			"widget_path",
			"asset_path",
			"widget_name",
			"blueprint_name",
		])

	const sourceControlFileParam = (params: Record<string, any>) =>
		requiredStringParam(params, ["file", "path", "asset_path", "package", "name"])

	const sourceControlFileListParam = (params: Record<string, any>) =>
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

	const sourceControlPackageListParam = (params: Record<string, any>) =>
		requiredStringListParam(params, [
			"packages",
			"package_names",
			"paths",
			"asset_paths",
			"package",
			"path",
		])

	const sourceControlFilesCommand = (
		files: string[],
		singleOperation?: string,
		multiOperation?: string,
	) => {
		if (singleOperation && files.length === 1) {
			return tools.UESourceControlTool(singleOperation, { file: files[0] })
		}

		return tools.UESourceControlTool(multiOperation ?? singleOperation!, { files })
	}

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
	}
}
