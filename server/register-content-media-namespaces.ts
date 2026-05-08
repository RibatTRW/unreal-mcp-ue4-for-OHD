import { z } from "zod"

import {
	assetLookupSchema,
	requireAtLeastOneValue,
	searchAssetsShape,
} from "./namespace-action-schema-fragments.js"
import { RegistrationContext } from "./registration-context.js"

export function registerContentMediaNamespaces(ctx: RegistrationContext) {
	const {
		editorTools,
		optionalStringParam,
		pythonDispatch,
		registerToolNamespace,
		requiredStringParam,
		searchAssetsCommand,
	} = ctx

	registerToolNamespace("manage_sequence", ctx.toolDescription("manage_sequence"), {
		create_sequence: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						name: z.string().optional(),
						asset_name: z.string().optional(),
						path: z.string().optional(),
					})
					.strict(),
				["name", "asset_name"],
				"Provide name or asset_name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEContentFactoryTool("create_level_sequence", {
						name: requiredStringParam(params, ["name", "asset_name"]),
						path: optionalStringParam(params, ["path"]),
					}),
				),
		},
		search_sequences: {
			paramsSchema: z.object(searchAssetsShape).strict(),
			handler: (params) => pythonDispatch(searchAssetsCommand(params, "LevelSequence")),
		},
		sequence_info: {
			paramsSchema: assetLookupSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"])),
				),
		},
	})

	registerToolNamespace("manage_audio", ctx.toolDescription("manage_audio"), {
		import_audio: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						source_file: z.string().optional(),
						file_path: z.string().optional(),
						local_path: z.string().optional(),
						destination_path: z.string().optional(),
						content_path: z.string().optional(),
						path: z.string().optional(),
						asset_name: z.string().optional(),
						name: z.string().optional(),
						replace_existing: z.boolean().optional(),
						save: z.boolean().optional(),
						auto_create_cue: z.boolean().optional(),
						cue_suffix: z.string().optional(),
					})
					.strict(),
				["source_file", "file_path", "local_path"],
				"Provide source_file, file_path, or local_path.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEContentFactoryTool("import_audio", {
						source_file: requiredStringParam(params, ["source_file", "file_path", "local_path"]),
						destination_path: optionalStringParam(params, [
							"destination_path",
							"content_path",
							"path",
						]),
						asset_name: optionalStringParam(params, ["asset_name", "name"]),
						replace_existing:
							typeof params.replace_existing === "boolean" ? params.replace_existing : true,
						save: typeof params.save === "boolean" ? params.save : true,
						auto_create_cue:
							typeof params.auto_create_cue === "boolean" ? params.auto_create_cue : true,
						cue_suffix: optionalStringParam(params, ["cue_suffix"]),
					}),
				),
		},
		search_audio_assets: {
			paramsSchema: z.object(searchAssetsShape).strict(),
			handler: (params) => pythonDispatch(searchAssetsCommand(params, "SoundCue")),
		},
		audio_info: {
			paramsSchema: assetLookupSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"])),
				),
		},
	})
}
