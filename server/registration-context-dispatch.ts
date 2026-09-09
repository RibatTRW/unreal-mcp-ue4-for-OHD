// Registration dispatch — Phase-4 Effect migration (report §4.2, §4.4, §5).
//
// What migrated:
//   - Handler params are ActionParams (Record<string, unknown>); no `any`
//     leaks into the Effect pipeline (report §4.4).
//   - Per-action paramsSchema accepts Zod (frozen SDK surface, unmigrated
//     registrars) OR effect/Schema (migrated validation). Zod validates via
//     safeParseAsync as before; Schemas decode via strictDecodeSync so
//     `.strict()` excess rejection is preserved (Structs strip unknown keys
//     by default — report §4.1). ParseError text is normalized behind the
//     identical `Invalid params for <tool>.<action>: ...` envelope prefix;
//     Effect tree formatting never leaks to clients raw.
//   - The namespace callback runs as an Effect program with Effect.catchAll
//     rendering the identical {success:false, tool, action, message} JSON
//     envelope for validation failures, MissingParamError (param helpers),
//     sync handler throws, async rejections, Effect-handler failures, and
//     command-execution failures.
//   - Handlers may also return Effect directly (Phase-5 pattern); such
//     effects run inline so their ToolError failures hit the same envelope.
//
// What stayed (report §4.4):
//   - Zod at the exact SDK call-site: the registered inputSchema union is
//     still built from Zod (frozen surface, locked by the list-tools
//     snapshot). Schema-validated actions contribute a permissive record
//     member there because the SDK pre-validates args before our callback
//     runs — strict validation happens inside the callback. (Unreachable
//     until Phase 5 migrates the first action; flagged loudly in the code.)
//   - Phase 6: the remote-execution.ts Promise shims are gone. Dispatch
//     runs the injected ConnectionSessionService Effects directly
//     (failures still unwrapped to the legacy Errors via withCompatErrors,
//     so envelopes are byte-identical); the SDK boundary stays
//     Promise-typed via runCompatPromise.
//   - registerPythonTool/registerZeroArgPythonTool keep their exact
//     promise semantics (a buildCommand throw propagates to the SDK as
//     today — there is no envelope on that path, so catchAll must not
//     invent one); only their types were de-any-ed.

import { Effect, type Schema } from "effect"
import { z } from "zod"

import { runWithPreludeCacheFallback } from "./editor/prelude-cache.js"
import type * as editorTools from "./editor/tools.js"
import { type ConnectionSessionServiceShape, runCompatPromise, withCompatErrors } from "./effect/connection-service.js"
import { InvalidParamsError, MissingParamError, type ToolError } from "./effect/errors.js"
import {
	invalidParamsMessage,
	missingParamMessage,
	parseErrorText,
	strictDecodeSync,
} from "./effect/schema-patterns.js"
import type { ActionParams } from "./registration-context-params.js"

export type NamespaceDispatchResult =
	| { kind: "python"; command: string; fullCommand?: string }
	| { kind: "direct"; payload: unknown }

export type NamespaceActionHandler = (
	params: ActionParams,
) => NamespaceDispatchResult | Promise<NamespaceDispatchResult> | Effect.Effect<NamespaceDispatchResult, ToolError>

// Per-action validation schema: frozen Zod for the SDK surface and
// unmigrated registrars, or effect/Schema for migrated validation.
// The Schema side uses Effect's canonical "any schema without context"
// alias (Schema<any, any, never>): Schema is invariant, so no precise
// supertype exists; decoding goes through the generic
// Schema.decodeUnknownSync, keeping the Phase-5 authoring pattern as a
// plain Schema expression.
export type NamespaceActionParamsSchema = z.ZodTypeAny | Schema.Schema.AnyNoContext

export interface NamespaceActionDefinition {
	description?: string
	handler: NamespaceActionHandler
	paramsSchema?: NamespaceActionParamsSchema
}

export type NamespaceActionRegistration = NamespaceActionDefinition | NamespaceActionHandler
export interface ToolNamespaceRegistrationOptions {
	compactParamsSchema?: boolean
}

export type TextResponse = { content: Array<{ type: "text"; text: string }> }

export interface NamespaceToolArgs {
	action: string
	params?: ActionParams
}

export interface RawServerTool {
	(
		name: string,
		description: string,
		schema: Record<string, z.ZodTypeAny>,
		cb: (args: ActionParams) => Promise<TextResponse>,
	): unknown
	(name: string, description: string, cb: () => Promise<TextResponse>): unknown
}

export interface RegistrationDispatch {
	commands: ConnectionSessionServiceShape
	directDispatch: (payload: unknown) => NamespaceDispatchResult
	editorTools: typeof editorTools
	pythonAction: (build: (params: ActionParams) => string) => NamespaceActionHandler
	cacheablePythonAction: (build: (params: ActionParams) => { cached: string; full: string }) => NamespaceActionHandler
	pythonDispatch: (command: string) => NamespaceDispatchResult
	rawServerTool: RawServerTool
	registerPythonTool: (
		name: string,
		description: string,
		schema: Record<string, z.ZodTypeAny>,
		buildCommand: (args: ActionParams) => string,
	) => void
	registerToolNamespace: (
		name: string,
		description: string,
		actions: Record<string, NamespaceActionRegistration>,
		options?: { compactParamsSchema?: boolean },
	) => void
	registerZeroArgPythonTool: (name: string, description: string, buildCommand: () => string) => void
	textResponse: (text: string) => TextResponse
	toolNamespaceRegistry: Map<string, { description: string; supportedActions: string[] }>
}

export interface DispatchHelperOptions {
	commands: ConnectionSessionServiceShape
	editorTools: typeof editorTools
	rawServerRegisterTool: (
		name: string,
		config: { description: string; inputSchema: z.ZodTypeAny },
		cb: (args: NamespaceToolArgs) => Promise<TextResponse>,
	) => unknown
	rawServerTool: RegistrationDispatch["rawServerTool"]
	recordSchema: z.ZodRecord<z.ZodString, z.ZodAny>
	textResponse: (text: string) => TextResponse
	toolNamespaceRegistry: Map<string, { description: string; supportedActions: string[] }>
}

// Duck-typed (not instanceof): the harness imports Zod ESM while dist
// requires Zod CJS, which can be distinct module instances with distinct
// ZodType identities. safeParseAsync exists on Zod schemas and never on
// effect/Schema values, so this discriminates robustly in both worlds.
const isZodParamsSchema = (schema: NamespaceActionParamsSchema): schema is z.ZodTypeAny =>
	typeof (schema as { safeParseAsync?: unknown }).safeParseAsync === "function"

const invalidParams = (tool: string, action: string, detail: string): InvalidParamsError => {
	const error = new InvalidParamsError({ tool, action, detail })
	// Data.TaggedError defaults message to "" — align it onto the legacy
	// envelope text (Phase-2/3 precedent) so generic renderers stay verbatim.
	error.message = invalidParamsMessage(tool, action, detail)
	return error
}

export function createDispatchHelpers(options: DispatchHelperOptions): RegistrationDispatch {
	const {
		commands,
		editorTools,
		rawServerRegisterTool,
		rawServerTool,
		recordSchema,
		textResponse,
		toolNamespaceRegistry,
	} = options

	const pythonDispatch = (command: string): NamespaceDispatchResult => ({ kind: "python", command })
	// Single consolidation point for the namespace python handlers: build the
	// command string, then dispatch it. Sync throws from param helpers and
	// builders need no per-handler Effect wrapper — invokeActionHandler lifts
	// every handler into the failure channel centrally, where catchAll renders
	// the identical envelope (including the MissingParamError branch).
	const pythonAction =
		(build: (params: ActionParams) => string): NamespaceActionHandler =>
		(params) =>
			pythonDispatch(build(params))
	// SHIP-S1 pilot mate to pythonAction: the builder returns the
	// (cached, full) pair (see UEActorToolCommands). fullCommand rides the
	// result to the python-send site, which resends it exactly once on a
	// cache miss. When the kill-switch is off both halves share one
	// reference, so fullCommand stays undefined and dispatch takes its
	// existing send path with no fallback scan.
	const cacheablePythonAction =
		(build: (params: ActionParams) => { cached: string; full: string }): NamespaceActionHandler =>
		(params) => {
			const pair = build(params)
			return {
				kind: "python",
				command: pair.cached,
				fullCommand: pair.full !== pair.cached ? pair.full : undefined,
			}
		}
	const directDispatch = (payload: unknown): NamespaceDispatchResult => ({ kind: "direct", payload })
	const normalizeActionName = (action: string) => action.trim().toLowerCase()
	const normalizeActionDefinition = (actionRegistration: NamespaceActionRegistration): NamespaceActionDefinition =>
		typeof actionRegistration === "function" ? { handler: actionRegistration } : actionRegistration

	const registerPythonTool = (
		name: string,
		description: string,
		schema: Record<string, z.ZodTypeAny>,
		buildCommand: (args: ActionParams) => string,
	) => {
		// buildCommand throws before any Effect is built, so the sync throw
		// still rejects the callback raw (no envelope on this path, as today).
		rawServerTool(name, description, schema, async (args) =>
			textResponse(await runCompatPromise(withCompatErrors(commands.runCommand(buildCommand(args))))),
		)
	}

	const registerZeroArgPythonTool = (name: string, description: string, buildCommand: () => string) => {
		rawServerTool(name, description, async () =>
			textResponse(await runCompatPromise(withCompatErrors(commands.runCommand(buildCommand())))),
		)
	}

	const unsupportedNamespaceAction = (
		toolName: string,
		action: string,
		supportedActions: string[],
	): NamespaceDispatchResult =>
		directDispatch({
			success: false,
			message: `Action '${action}' is not supported by ${toolName} in this UE4.25 port.`,
			supported_actions: supportedActions,
		})

	const runNamespaceDispatchEffect = (result: NamespaceDispatchResult): Effect.Effect<TextResponse, unknown> => {
		if (result.kind === "python") {
			if (result.fullCommand !== undefined) {
				// SHIP-S1 pilot path: run the cached (tail-only) payload; on
				// the miss marker — and only then — resend once with the
				// full registering payload. Only reachable when the
				// UNREAL_MCP_PRELUDE_CACHE kill-switch is on.
				return runWithPreludeCacheFallback(
					(command) => withCompatErrors(commands.runCommand(command)),
					result.command,
					result.fullCommand,
				).pipe(Effect.map((output) => textResponse(output)))
			}
			// withCompatErrors unwraps the typed channel to the exact legacy
			// Errors the removed tryRunCommand shim used to reject with, so
			// the catchAll envelope below renders byte-identical text.
			return withCompatErrors(commands.runCommand(result.command)).pipe(Effect.map((output) => textResponse(output)))
		}

		return Effect.succeed(textResponse(JSON.stringify(result.payload, null, 2)))
	}

	const invokeActionHandler = (
		handler: NamespaceActionHandler,
		params: ActionParams,
	): Effect.Effect<NamespaceDispatchResult, unknown> =>
		Effect.tryPromise({
			// Promise.resolve().then flattens sync throws into rejections, so
			// sync throws and async rejections both land in the failure
			// channel (never defects).
			try: () => Promise.resolve().then(() => handler(params)),
			catch: (cause) => cause,
		}).pipe(
			Effect.flatMap((result) =>
				Effect.isEffect(result) ? result : Effect.succeed(result as NamespaceDispatchResult),
			),
		)

	const validateNamespaceParams = (
		name: string,
		action: string,
		actionDefinition: NamespaceActionDefinition,
		params: ActionParams,
	): Effect.Effect<ActionParams, InvalidParamsError> => {
		const paramsSchema = actionDefinition.paramsSchema
		if (!paramsSchema) {
			return Effect.succeed(params)
		}

		if (isZodParamsSchema(paramsSchema)) {
			return Effect.tryPromise({
				try: () => paramsSchema.safeParseAsync(params),
				catch: (cause) => invalidParams(name, action, cause instanceof Error ? cause.message : String(cause)),
			}).pipe(
				Effect.flatMap((parseResult) =>
					parseResult.success
						? // safeParseAsync on ZodTypeAny yields any — narrow once
							// at the boundary; downstream stays unknown-typed.
							Effect.succeed(parseResult.data as ActionParams)
						: Effect.fail(invalidParams(name, action, parseResult.error.message)),
				),
			)
		}

		return Effect.try({
			try: () => strictDecodeSync(paramsSchema, params) as ActionParams,
			catch: (cause) => invalidParams(name, action, parseErrorText(cause)),
		})
	}

	// The identical public envelope (report §6): shape and prefix preserved
	// byte-for-byte. InvalidParamsError carries the preformatted text;
	// MissingParamError renders through missingParamMessage so the
	// `${key} is required` text never changes; everything else keeps the
	// legacy Error-message-or-String fallback.
	const renderToolErrorEnvelope = (name: string, action: string, error: unknown): TextResponse => {
		const message =
			error instanceof InvalidParamsError
				? error.message
				: error instanceof MissingParamError
					? missingParamMessage(error.key)
					: error instanceof Error
						? error.message
						: String(error)

		return textResponse(JSON.stringify({ success: false, tool: name, action, message }, null, 2))
	}

	const namespaceActionSchema = (supportedActions: string[]) =>
		supportedActions.length === 1
			? z.literal(supportedActions[0])
			: z.enum(supportedActions as [string, string, ...string[]])

	const namespaceParamsSchema = (
		name: string,
		supportedActions: string[],
		normalizedActions: Record<string, NamespaceActionDefinition>,
		options: ToolNamespaceRegistrationOptions = {},
	) => {
		if (options.compactParamsSchema) {
			return recordSchema.describe(
				`Parameters for the selected ${name} action. Runtime validation is action-specific. Supported actions: ${supportedActions
					.map((actionName) => `${name}.${actionName}`)
					.join(", ")}.`,
			)
		}

		const paramsSchemas = supportedActions.map((actionName) => {
			const actionDefinition = normalizedActions[actionName]
			const paramsSchema = actionDefinition.paramsSchema
			const description = actionDefinition.description
				? `${name}.${actionName}: ${actionDefinition.description}`
				: `Parameters for ${name}.${actionName}`

			if (paramsSchema && !isZodParamsSchema(paramsSchema)) {
				// Migrated (Schema-validated) action: the SDK pre-validates
				// tool args against this inputSchema before our callback runs,
				// so this member must stay permissive — strict validation
				// happens inside the callback via Schema decode. NOTE: this
				// changes the listTools surface for migrated actions (strict
				// per-action JSON Schema becomes a permissive record); the
				// surface snapshot will show it when Phase 5 migrates the
				// first action. Unreachable until then.
				return recordSchema.describe(description)
			}

			return (paramsSchema ?? z.object({}).strict()).describe(description)
		})

		return paramsSchemas.length === 1
			? paramsSchemas[0]
			: z.union(paramsSchemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]])
	}

	const registerToolNamespace = (
		name: string,
		description: string,
		actions: Record<string, NamespaceActionRegistration>,
		options: ToolNamespaceRegistrationOptions = {},
	) => {
		const normalizedActions = Object.fromEntries(
			Object.entries(actions).map(([actionName, actionRegistration]) => [
				normalizeActionName(actionName),
				normalizeActionDefinition(actionRegistration),
			]),
		) as Record<string, NamespaceActionDefinition>
		const supportedActions = Object.keys(normalizedActions).sort()
		toolNamespaceRegistry.set(name, { description, supportedActions })

		const inputSchema = z
			.object({
				action: namespaceActionSchema(supportedActions).describe(`Action to execute inside tool namespace ${name}`),
				params: namespaceParamsSchema(name, supportedActions, normalizedActions, options)
					.optional()
					.describe(
						`Parameters for the selected ${name} action. Supported actions: ${supportedActions
							.map((actionName) => `${name}.${actionName}`)
							.join(", ")}.`,
					),
			})
			.strict()

		rawServerRegisterTool(name, { description, inputSchema }, ({ action, params }) =>
			Effect.runPromise(
				Effect.gen(function* () {
					const normalizedAction = normalizeActionName(action)
					const actionDefinition = normalizedActions[normalizedAction]
					if (!actionDefinition) {
						return yield* runNamespaceDispatchEffect(
							unsupportedNamespaceAction(name, normalizedAction, supportedActions),
						)
					}

					const validated = yield* validateNamespaceParams(name, normalizedAction, actionDefinition, params ?? {})
					const result = yield* invokeActionHandler(actionDefinition.handler, validated)

					return yield* runNamespaceDispatchEffect(result)
				}).pipe(
					Effect.catchAll((error) => Effect.succeed(renderToolErrorEnvelope(name, normalizeActionName(action), error))),
				),
			),
		)
	}

	return {
		commands,
		directDispatch,
		editorTools,
		pythonAction,
		cacheablePythonAction,
		pythonDispatch,
		rawServerTool,
		registerPythonTool,
		registerToolNamespace,
		registerZeroArgPythonTool,
		textResponse,
		toolNamespaceRegistry,
	}
}
