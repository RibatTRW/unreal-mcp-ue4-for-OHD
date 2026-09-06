import type { RegistrationDispatch, RegistrationParams, RegistrationSchemas } from "./registration-context.js"
import { sharedReadOnlyActions } from "./shared-read-only-actions.js"
import type { ToolCatalogEntry } from "./tool-catalog-types.js"
import { createToolDescriptionLookup } from "./tool-catalog-types.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

/**
 * Catalog entries co-located with the namespace registration below.
 * Adding a tool here needs no edit to a separate catalog file.
 */
export const coreSystemEntries: ToolCatalogEntry[] = [
	{
		name: "manage_system",
		category: "Core Tool Namespaces",
		description: "System tool namespace for console commands and asset validation actions.",
	},
]

const describeTool = createToolDescriptionLookup(coreSystemEntries)

export function coreSystemDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const shared = sharedReadOnlyActions(ctx)

	return [
		{
			name: "manage_system",
			description: describeTool("manage_system"),
			actions: {
				console_command: shared.console_command,
				get_console_variable: shared.get_console_variable,
				validate_assets: shared.validate_assets,
			},
		},
	]
}
