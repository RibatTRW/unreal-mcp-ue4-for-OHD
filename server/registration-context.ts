import type { McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import * as editorTools from "./editor/tools.js"
import type { ConnectionSessionServiceShape } from "./effect/connection-service.js"
import {
	type DispatchHelperOptions,
	type NamespaceActionRegistration,
	type NamespaceDispatchResult,
	type RegistrationDispatch,
	type TextResponse,
	createDispatchHelpers,
} from "./registration-context-dispatch.js"
import {
	type ActionParams,
	type RegistrationParams,
	createRegistrationParamHelpers,
} from "./registration-context-params.js"
import { type RegistrationSchemas, createRegistrationSchemaHelpers } from "./registration-context-schemas.js"

export type {
	ActionParams,
	DispatchHelperOptions,
	NamespaceActionRegistration,
	NamespaceDispatchResult,
	RegistrationDispatch,
	RegistrationParams,
	RegistrationSchemas,
	TextResponse,
}

export interface RegistrationContext extends RegistrationParams, RegistrationSchemas, RegistrationDispatch {}

// Minimal structural SDK seams (report §4.4). The SDK's ToolCallback is a
// deep conditional type over its generics — resolving our callbacks against
// it directly sends tsc into excessively-deep instantiation. These seams
// keep that check shallow: schemas/config stay precise (the frozen Zod
// surface is still type-checked), while the SDK-provided-args position is
// never — sound by contravariance, since dispatch only ever passes its own
// callbacks in, never consumes args out through these types. No `any`.
type SdkRegisterToolLike = (
	name: string,
	config: { description: string; inputSchema?: z.ZodTypeAny },
	cb: (args: never) => unknown,
) => unknown

// Phase 6: the live ConnectionSessionService is threaded in from the
// composition root (index.ts MainLive) — dispatch and direct tools run
// its Effects per call instead of reaching a module-global singleton.
export function createRegistrationContext(
	server: McpServer,
	commands: ConnectionSessionServiceShape,
): RegistrationContext {
	// Typed SDK-boundary wrappers (report §4.4): the old `bind` + `as` casts
	// that erased SDK types down to `any` are gone. Zod stays at this exact
	// call-site permanently (locked by the list-tools surface snapshot).
	// MCP 2026-07-28 (SDK v2): the deprecated variadic `tool()` is removed,
	// so every path below routes through `registerTool` — raw shapes are
	// wrapped with `z.object()` explicitly (never the deprecated auto-wrap).
	const sdkRegisterTool = server.registerTool.bind(server) as SdkRegisterToolLike

	const rawServerRegisterTool: DispatchHelperOptions["rawServerRegisterTool"] = (name, config, cb) =>
		sdkRegisterTool(name, config, cb)

	function rawServerTool(
		name: string,
		description: string,
		schema: Record<string, z.ZodTypeAny>,
		cb: (args: ActionParams) => Promise<TextResponse>,
	): unknown
	function rawServerTool(name: string, description: string, cb: () => Promise<TextResponse>): unknown
	function rawServerTool(
		name: string,
		description: string,
		schemaOrCb: Record<string, z.ZodTypeAny> | (() => Promise<TextResponse>),
		cb?: (args: ActionParams) => Promise<TextResponse>,
	): unknown {
		if (cb === undefined) {
			if (typeof schemaOrCb !== "function") {
				throw new Error(`rawServerTool(${name}): missing callback`)
			}
			// No inputSchema: v2 passes the request context as the single
			// callback arg; our zero-arg callbacks simply ignore it.
			return sdkRegisterTool(name, { description }, schemaOrCb)
		}
		if (typeof schemaOrCb === "function") {
			throw new Error(`rawServerTool(${name}): missing params schema`)
		}
		return sdkRegisterTool(name, { description, inputSchema: z.object(schemaOrCb) }, cb)
	}

	const textResponse = (text: string) => ({
		content: [{ type: "text" as const, text }],
	})

	const toolNamespaceRegistry = new Map<string, { description: string; supportedActions: string[] }>()
	const schemaHelpers = createRegistrationSchemaHelpers()
	const paramHelpers = createRegistrationParamHelpers(editorTools, schemaHelpers)
	const dispatchHelpers = createDispatchHelpers({
		commands,
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
