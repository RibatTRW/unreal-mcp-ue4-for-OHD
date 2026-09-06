import { z } from "zod"

import { requireAtLeastOneValue } from "./namespace-action-schema-fragments.js"
import type { RegistrationDispatch, RegistrationParams, RegistrationSchemas } from "./registration-context.js"
import type { NamespaceActionRegistration } from "./registration-context.js"

export function sharedReadOnlyActions(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): Record<string, NamespaceActionRegistration> {
	const { assetPathListParam, editorTools, pythonDispatch, requiredStringParam } = ctx
	const assetPathListInputSchema = z.union([z.string(), z.array(z.string())])

	return {
		console_command: {
			paramsSchema: z
				.object({
					command: z.string(),
				})
				.strict(),
			handler: (params) => pythonDispatch(editorTools.UEConsoleCommand(requiredStringParam(params, ["command"]))),
		},
		get_console_variable: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						variable_name: z.string().optional(),
						name: z.string().optional(),
						console_variable: z.string().optional(),
					})
					.strict(),
				["variable_name", "name", "console_variable"],
				"Provide variable_name, name, or console_variable.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetConsoleVariable(requiredStringParam(params, ["variable_name", "name", "console_variable"])),
				),
		},
		map_info: {
			handler: () => pythonDispatch(editorTools.UEGetMapInfo()),
		},
		validate_assets: {
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
			handler: (params) => pythonDispatch(editorTools.UEValidateAssets(assetPathListParam(params))),
		},
		world_outliner: {
			handler: () => pythonDispatch(editorTools.UEGetWorldOutliner()),
		},
	}
}
