import { z } from "zod"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as editorTools from "./editor/tools.js"
import {
	createDispatchHelpers,
	NamespaceActionRegistration,
	NamespaceDispatchResult,
} from "./registration-context-dispatch.js"
import { createRegistrationParamHelpers } from "./registration-context-params.js"
import {
	colorInputSchema,
	recordSchema,
	rotatorInputSchema,
	stringListSchema,
	toColorArray,
	toColorRecord,
	toRotatorArray,
	toRotatorRecord,
	toVector2Array,
	toVector2Record,
	toVector3Array,
	toVector3Record,
	vector2InputSchema,
	vector3InputSchema,
	worldBuildBaseSchema,
} from "./registration-context-schemas.js"
import { toolDescription } from "./tool-catalog.js"

export interface RegistrationContext {
	actorNameParam: (params: Record<string, any>) => string
	blueprintNameParam: (params: Record<string, any>) => string
	colorInputSchema: z.ZodTypeAny
	directDispatch: (payload: unknown) => NamespaceDispatchResult
	editorTools: typeof editorTools
	optionalStringListParam: (params: Record<string, any>, keys: string[]) => string[] | undefined
	optionalStringParam: (params: Record<string, any>, keys: string[]) => string | undefined
	pythonDispatch: (command: string) => NamespaceDispatchResult
	rawServerTool: (...args: any[]) => unknown
	recordSchema: z.ZodRecord<z.ZodString, z.ZodAny>
	registerPythonTool: (
		name: string,
		description: string,
		schema: Record<string, z.ZodTypeAny>,
		buildCommand: (args: any) => string,
	) => void
	registerToolNamespace: (
		name: string,
		description: string,
		actions: Record<string, NamespaceActionRegistration>,
	) => void
	registerZeroArgPythonTool: (
		name: string,
		description: string,
		buildCommand: () => string,
	) => void
	requiredStringListParam: (params: Record<string, any>, keys: string[]) => string[]
	requiredStringParam: (params: Record<string, any>, keys: string[]) => string
	searchAssetsCommand: (params: Record<string, any>, defaultAssetClass?: string) => string
	sourceControlFileListParam: (params: Record<string, any>) => string[]
	sourceControlFileParam: (params: Record<string, any>) => string
	sourceControlFilesCommand: (
		files: string[],
		singleOperation?: string,
		multiOperation?: string,
	) => string
	sourceControlPackageListParam: (params: Record<string, any>) => string[]
	stringListSchema: z.ZodArray<z.ZodString, "many">
	textResponse: (text: string) => { content: Array<{ type: "text"; text: string }> }
	toolDescription: (name: string) => string
	toolNamespaceRegistry: Map<string, { description: string; supportedActions: string[] }>
	toColorArray: (
		value?: { a?: number; b: number; g: number; r: number } | [number, number, number, number],
	) => number[] | undefined
	toColorRecord: (
		value?: { a?: number; b: number; g: number; r: number } | [number, number, number, number],
	) => { a: number; b: number; g: number; r: number } | undefined
	toRotatorArray: (
		value?: { pitch: number; roll: number; yaw: number } | [number, number, number],
	) => number[] | undefined
	toRotatorRecord: (
		value?: { pitch: number; roll: number; yaw: number } | [number, number, number],
	) => { pitch: number; roll: number; yaw: number } | undefined
	toVector2Array: (value?: { x: number; y: number } | [number, number]) => number[] | undefined
	toVector2Record: (
		value?: { x: number; y: number } | [number, number],
	) => { x: number; y: number } | undefined
	toVector3Array: (
		value?: { x: number; y: number; z: number } | [number, number, number],
	) => number[] | undefined
	toVector3Record: (
		value?: { x: number; y: number; z: number } | [number, number, number],
	) => { x: number; y: number; z: number } | undefined
	vector2InputSchema: z.ZodTypeAny
	vector3InputSchema: z.ZodTypeAny
	rotatorInputSchema: z.ZodTypeAny
	worldBuildBaseSchema: {
		location: z.ZodTypeAny
		material_path: z.ZodTypeAny
		prefix: z.ZodTypeAny
	}
	worldBuildCommand: (operation: string, params: Record<string, any>) => string
	widgetBlueprintParam: (params: Record<string, any>) => string
}

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
	const dispatchHelpers = createDispatchHelpers({
		rawServerRegisterTool,
		rawServerTool,
		recordSchema,
		textResponse,
		toolNamespaceRegistry,
	})
	const paramHelpers = createRegistrationParamHelpers(editorTools)

	const worldBuildCommand = (operation: string, params: Record<string, any>) =>
		editorTools.UEWorldBuildingTool(operation, {
			...params,
			location: toVector3Array(params.location),
		})

	return {
		colorInputSchema,
		editorTools,
		rawServerTool,
		recordSchema,
		stringListSchema,
		textResponse,
		toolDescription,
		toolNamespaceRegistry,
		toColorArray,
		toColorRecord,
		toRotatorArray,
		toRotatorRecord,
		toVector2Array,
		toVector2Record,
		toVector3Array,
		toVector3Record,
		vector2InputSchema,
		vector3InputSchema,
		rotatorInputSchema,
		worldBuildBaseSchema,
		worldBuildCommand,
		...dispatchHelpers,
		...paramHelpers,
	}
}
