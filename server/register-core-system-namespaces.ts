import type { RegistrationDispatch, RegistrationParams, RegistrationSchemas } from "./registration-context.js"
import { sharedReadOnlyActions } from "./shared-read-only-actions.js"
import type { ToolNamespaceDescriptor } from "./tool-namespaces.js"

export function coreSystemDescriptors(
	ctx: RegistrationParams & RegistrationSchemas & RegistrationDispatch,
): ToolNamespaceDescriptor[] {
	const shared = sharedReadOnlyActions(ctx)

	return [
		{
			name: "manage_system",
			actions: {
				console_command: shared.console_command,
				get_console_variable: shared.get_console_variable,
				validate_assets: shared.validate_assets,
			},
		},
	]
}
