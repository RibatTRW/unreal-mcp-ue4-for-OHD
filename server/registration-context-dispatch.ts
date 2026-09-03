import { z } from "zod"

import { tryRunCommand } from "./remote-execution.js"

export type NamespaceDispatchResult = { kind: "python"; command: string } | { kind: "direct"; payload: unknown }

export type NamespaceActionHandler = (
	params: Record<string, any>,
) => NamespaceDispatchResult | Promise<NamespaceDispatchResult>

export interface NamespaceActionDefinition {
	description?: string
	handler: NamespaceActionHandler
	paramsSchema?: z.ZodTypeAny
}

export type NamespaceActionRegistration = NamespaceActionDefinition | NamespaceActionHandler
export interface ToolNamespaceRegistrationOptions {
	compactParamsSchema?: boolean
}

type TextResponse = { content: Array<{ type: "text"; text: string }> }

interface DispatchHelperOptions {
	rawServerRegisterTool: (name: string, config: Record<string, unknown>, cb: (...args: any[]) => unknown) => unknown
	rawServerTool: (...args: any[]) => unknown
	recordSchema: z.ZodRecord<z.ZodString, z.ZodAny>
	textResponse: (text: string) => TextResponse
	toolNamespaceRegistry: Map<string, { description: string; supportedActions: string[] }>
}

export function createDispatchHelpers(options: DispatchHelperOptions) {
	const { rawServerRegisterTool, rawServerTool, recordSchema, textResponse, toolNamespaceRegistry } = options

	const pythonDispatch = (command: string): NamespaceDispatchResult => ({ kind: "python", command })
	const directDispatch = (payload: unknown): NamespaceDispatchResult => ({ kind: "direct", payload })
	const normalizeActionName = (action: string) => action.trim().toLowerCase()
	const normalizeActionDefinition = (actionRegistration: NamespaceActionRegistration): NamespaceActionDefinition =>
		typeof actionRegistration === "function" ? { handler: actionRegistration } : actionRegistration

	const registerPythonTool = (
		name: string,
		description: string,
		schema: Record<string, z.ZodTypeAny>,
		buildCommand: (args: any) => string,
	) => {
		rawServerTool(name, description, schema, async (args: any) => textResponse(await tryRunCommand(buildCommand(args))))
	}

	const registerZeroArgPythonTool = (name: string, description: string, buildCommand: () => string) => {
		rawServerTool(name, description, async () => textResponse(await tryRunCommand(buildCommand())))
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

	const runNamespaceDispatch = async (result: NamespaceDispatchResult) => {
		if (result.kind === "python") {
			return textResponse(await tryRunCommand(result.command))
		}

		return textResponse(JSON.stringify(result.payload, null, 2))
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
			return (actionDefinition.paramsSchema ?? z.object({}).strict()).describe(
				actionDefinition.description
					? `${name}.${actionName}: ${actionDefinition.description}`
					: `Parameters for ${name}.${actionName}`,
			)
		})

		return paramsSchemas.length === 1
			? paramsSchemas[0]
			: z.union(paramsSchemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]])
	}

	const validateNamespaceParams = async (
		name: string,
		action: string,
		actionDefinition: NamespaceActionDefinition,
		params: Record<string, any>,
	) => {
		if (!actionDefinition.paramsSchema) {
			return { success: true as const, params }
		}

		const parseResult = await actionDefinition.paramsSchema.safeParseAsync(params)
		if (parseResult.success) {
			return { success: true as const, params: parseResult.data }
		}

		return {
			success: false as const,
			response: textResponse(
				JSON.stringify(
					{
						success: false,
						tool: name,
						action,
						message: `Invalid params for ${name}.${action}: ${parseResult.error.message}`,
					},
					null,
					2,
				),
			),
		}
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

		rawServerRegisterTool(
			name,
			{
				description,
				inputSchema,
			},
			async ({ action, params }: { action: string; params?: Record<string, any> }) => {
				const normalizedAction = normalizeActionName(action)

				try {
					const actionDefinition = normalizedActions[normalizedAction]
					if (!actionDefinition) {
						return await runNamespaceDispatch(unsupportedNamespaceAction(name, normalizedAction, supportedActions))
					}

					const validated = await validateNamespaceParams(name, normalizedAction, actionDefinition, params ?? {})
					if (!validated.success) {
						return validated.response
					}

					const result = await actionDefinition.handler(validated.params)

					return await runNamespaceDispatch(result)
				} catch (error) {
					return textResponse(
						JSON.stringify(
							{
								success: false,
								tool: name,
								action: normalizedAction,
								message: error instanceof Error ? error.message : String(error),
							},
							null,
							2,
						),
					)
				}
			},
		)
	}

	return {
		directDispatch,
		pythonDispatch,
		registerPythonTool,
		registerToolNamespace,
		registerZeroArgPythonTool,
	}
}
