import { z } from "zod"

import {
	requireAtLeastOneValue,
	sourceControlFileSchema,
	sourceControlFilesSchema,
	sourceControlFilesShape,
	sourceControlPackagesSchema,
	sourceControlPackagesShape,
} from "./namespace-action-schema-fragments.js"
import { RegistrationDispatch, RegistrationParams } from "./registration-context.js"

export function registerCoreSourceControlNamespaces(ctx: RegistrationParams & RegistrationDispatch) {
	const {
		editorTools,
		pythonDispatch,
		registerToolNamespace,
		requiredStringParam,
		sourceControlFileListParam,
		sourceControlFileParam,
		sourceControlFilesCommand,
		sourceControlPackageListParam,
	} = ctx

	registerToolNamespace(
		"manage_source_control",
		ctx.toolDescription("manage_source_control"),
		{
			provider_info: {
				handler: () =>
					pythonDispatch(editorTools.UESourceControlTool("get_source_control_provider")),
			},
			query_state: {
				paramsSchema: sourceControlFileSchema,
				handler: (params) =>
					pythonDispatch(
						editorTools.UESourceControlTool("query_source_control_state", {
							file: sourceControlFileParam(params),
						}),
					),
			},
			query_states: {
				paramsSchema: sourceControlFilesSchema,
				handler: (params) =>
					pythonDispatch(
						editorTools.UESourceControlTool("query_source_control_states", {
							files: sourceControlFileListParam(params),
						}),
					),
			},
			checkout: {
				paramsSchema: sourceControlFilesSchema,
				handler: (params) =>
					pythonDispatch(
						sourceControlFilesCommand(
							sourceControlFileListParam(params),
							"check_out_file",
							"check_out_files",
						),
					),
			},
			checkout_or_add: {
				paramsSchema: sourceControlFilesSchema,
				handler: (params) =>
					pythonDispatch(
						sourceControlFilesCommand(
							sourceControlFileListParam(params),
							"check_out_or_add_file",
							"check_out_or_add_files",
						),
					),
			},
			add: {
				paramsSchema: sourceControlFilesSchema,
				handler: (params) =>
					pythonDispatch(
						sourceControlFilesCommand(
							sourceControlFileListParam(params),
							"mark_file_for_add",
							"mark_files_for_add",
						),
					),
			},
			delete: {
				paramsSchema: sourceControlFilesSchema,
				handler: (params) =>
					pythonDispatch(
						sourceControlFilesCommand(
							sourceControlFileListParam(params),
							"mark_file_for_delete",
							"mark_files_for_delete",
						),
					),
			},
			revert: {
				paramsSchema: sourceControlFilesSchema,
				handler: (params) =>
					pythonDispatch(
						sourceControlFilesCommand(
							sourceControlFileListParam(params),
							"revert_file",
							"revert_files",
						),
					),
			},
			revert_unchanged: {
				paramsSchema: sourceControlFilesSchema,
				handler: (params) =>
					pythonDispatch(
						editorTools.UESourceControlTool("revert_unchanged_files", {
							files: sourceControlFileListParam(params),
						}),
					),
			},
			sync: {
				paramsSchema: sourceControlFilesSchema,
				handler: (params) =>
					pythonDispatch(
						sourceControlFilesCommand(
							sourceControlFileListParam(params),
							"sync_file",
							"sync_files",
						),
					),
			},
			submit: {
				paramsSchema: requireAtLeastOneValue(
					requireAtLeastOneValue(
						z
							.object({
								...sourceControlFilesShape,
								description: z.string().optional(),
								message: z.string().optional(),
								keep_checked_out: z.boolean().optional(),
							})
							.strict(),
						["files", "paths", "asset_paths", "packages", "file", "path", "asset_path", "package", "name"],
						"Provide files, paths, asset_paths, packages, file, path, asset_path, package, or name.",
					),
					["description", "message"],
					"Provide description or message.",
				),
				handler: (params) =>
					pythonDispatch(
						editorTools.UESourceControlTool("check_in_files", {
							files: sourceControlFileListParam(params),
							description: requiredStringParam(params, ["description", "message"]),
							keep_checked_out: Boolean(params.keep_checked_out),
						}),
					),
			},
			revert_and_reload_packages: {
				paramsSchema: requireAtLeastOneValue(
					z
						.object({
							...sourceControlPackagesShape,
							revert_all: z.boolean().optional(),
							reload_world: z.boolean().optional(),
						})
						.strict(),
					["packages", "package_names", "paths", "asset_paths", "package", "path"],
					"Provide packages, package_names, paths, asset_paths, package, or path.",
				),
				handler: (params) =>
					pythonDispatch(
						editorTools.UESourceControlTool("revert_and_reload_packages", {
							packages: sourceControlPackageListParam(params),
							revert_all: Boolean(params.revert_all),
							reload_world: Boolean(params.reload_world),
						}),
					),
			},
		},
	)
}
