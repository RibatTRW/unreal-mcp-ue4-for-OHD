import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as editorTools from "./editor/tools.js"
import {
	type NamespaceActionRegistration,
	type NamespaceDispatchResult,
	type RegistrationDispatch,
	createDispatchHelpers,
} from "./registration-context-dispatch.js"
import { type RegistrationParams, createRegistrationParamHelpers } from "./registration-context-params.js"
import { type RegistrationSchemas, createRegistrationSchemaHelpers } from "./registration-context-schemas.js"

export type {
	NamespaceActionRegistration,
	NamespaceDispatchResult,
	RegistrationDispatch,
	RegistrationParams,
	RegistrationSchemas,
}

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
		toolNamespaceRegistry,
	})

	return {
		...schemaHelpers,
		...paramHelpers,
		...dispatchHelpers,
	}
}
