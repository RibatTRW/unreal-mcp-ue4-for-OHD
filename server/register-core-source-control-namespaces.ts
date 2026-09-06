import { Effect } from "effect"
import { z } from "zod"

import type { ToolError } from "./effect/errors.js"

import {
	requireAtLeastOneValue,
	sourceControlFileSchema,
	sourceControlFilesSchema,
	sourceControlFilesShape,
	sourceControlPackagesSchema,
	sourceControlPackagesShape,
} from "./namespace-action-schema-fragments.js"
import type { RegistrationDispatch, RegistrationParams } from "./registration-context.js"
import type { ToolCatalogEntry } from "./tool-catalog-types.js"
import { createToolDescriptionLookup } from "./tool-catalog-types.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

/**
 * Catalog entries co-located with the namespace registration below.
 * Adding a tool here needs no edit to a separate catalog file.
 */
export const coreSourceControlEntries: ToolCatalogEntry[] = [
	{
		name: "manage_source_control",
		category: "Core Tool Namespaces",
		description: "Source-control tool namespace for provider inspection and file or package source-control operations.",
	},
]

const describeTool = createToolDescriptionLookup(coreSourceControlEntries)

export function coreSourceControlDescriptors(
	ctx: RegistrationParams & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const {
		editorTools,
		pythonDispatch,
		requiredStringParam,
		sourceControlFileListParam,
		sourceControlFileParam,
		sourceControlFilesCommand,
		sourceControlPackageListParam,
	} = ctx

	return [
		{
			name: "manage_source_control",
			description: describeTool("manage_source_control"),
			actions: {
				provider_info: {
					// Phase 5b (report §5): handler returns Effect; param-helper
					// and builder throws become channel failures via Effect.try
					// (Effect.sync would defect past dispatch's catchAll and break
					// the identical envelope), rendered verbatim downstream.
					handler: () =>
						Effect.try({
							try: () => pythonDispatch(editorTools.UESourceControlTool("get_source_control_provider")),
							catch: (cause) => cause as ToolError,
						}),
				},
				query_state: {
					paramsSchema: sourceControlFileSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UESourceControlTool("query_source_control_state", {
										file: sourceControlFileParam(params),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				query_states: {
					paramsSchema: sourceControlFilesSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UESourceControlTool("query_source_control_states", {
										files: sourceControlFileListParam(params),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				checkout: {
					paramsSchema: sourceControlFilesSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									sourceControlFilesCommand(sourceControlFileListParam(params), "check_out_file", "check_out_files"),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				checkout_or_add: {
					paramsSchema: sourceControlFilesSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									sourceControlFilesCommand(
										sourceControlFileListParam(params),
										"check_out_or_add_file",
										"check_out_or_add_files",
									),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				add: {
					paramsSchema: sourceControlFilesSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									sourceControlFilesCommand(
										sourceControlFileListParam(params),
										"mark_file_for_add",
										"mark_files_for_add",
									),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				delete: {
					paramsSchema: sourceControlFilesSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									sourceControlFilesCommand(
										sourceControlFileListParam(params),
										"mark_file_for_delete",
										"mark_files_for_delete",
									),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				revert: {
					paramsSchema: sourceControlFilesSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									sourceControlFilesCommand(sourceControlFileListParam(params), "revert_file", "revert_files"),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				revert_unchanged: {
					paramsSchema: sourceControlFilesSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UESourceControlTool("revert_unchanged_files", {
										files: sourceControlFileListParam(params),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
				sync: {
					paramsSchema: sourceControlFilesSchema,
					handler: (params) =>
						Effect.try({
							try: () =>
								pythonDispatch(
									sourceControlFilesCommand(sourceControlFileListParam(params), "sync_file", "sync_files"),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UESourceControlTool("check_in_files", {
										files: sourceControlFileListParam(params),
										description: requiredStringParam(params, ["description", "message"]),
										keep_checked_out: Boolean(params.keep_checked_out),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
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
						Effect.try({
							try: () =>
								pythonDispatch(
									editorTools.UESourceControlTool("revert_and_reload_packages", {
										packages: sourceControlPackageListParam(params),
										revert_all: Boolean(params.revert_all),
										reload_world: Boolean(params.reload_world),
									}),
								),
							catch: (cause) => cause as ToolError,
						}),
				},
			},
		},
	]
}
