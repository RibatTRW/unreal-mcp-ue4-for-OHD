import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as editorTools from "./editor/tools.js"
import {
	createDispatchHelpers,
	NamespaceActionRegistration,
	NamespaceDispatchResult,
	RegistrationDispatch,
} from "./registration-context-dispatch.js"
import { createRegistrationParamHelpers, RegistrationParams } from "./registration-context-params.js"
import { createRegistrationSchemaHelpers, RegistrationSchemas } from "./registration-context-schemas.js"
import { toolDescription } from "./tool-catalog.js"

export type { NamespaceActionRegistration, NamespaceDispatchResult, RegistrationDispatch, RegistrationParams, RegistrationSchemas }

export interface RegistrationContext extends RegistrationParams, RegistrationSchemas, RegistrationDispatch {}

export function createRegistrationContext(server: McpServer): RegistrationContext {
	const rawServerRegisterTool = server.registerTool.bind(server) as (
		name: string,
		config: Record<string, unknown>,
		cb: (...args: any[]) => unknown,
	) => unknown
	const rawServerTool = server.tool.bind(server) as (...args: any[]) => unknown

	const textResponse = (text: string) => ({
		content: [{ type: "text" as const, text }],
	})

	const toolNamespaceRegistry = new Map<string, { description: string; supportedActions: string[] }>()
	const schemaHelpers = createRegistrationSchemaHelpers()
	const paramHelpers = createRegistrationParamHelpers(editorTools, schemaHelpers)
	const dispatchHelpers = createDispatchHelpers({
		editorTools,
		rawServerRegisterTool,
		rawServerTool,
		recordSchema: schemaHelpers.recordSchema,
		textResponse,
		toolDescription,
		toolNamespaceRegistry,
	})

	return {
		...schemaHelpers,
		...paramHelpers,
		...dispatchHelpers,
	}
}
