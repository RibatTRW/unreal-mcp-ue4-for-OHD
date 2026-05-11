#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const defaultServerEntry = path.join(repoRoot, "dist", "bin.js")

const fail = (message) => {
	throw new Error(message)
}

const assert = (condition, message) => {
	if (!condition) {
		fail(message)
	}
}

const extractTextContent = (result) => {
	if (!result || !Array.isArray(result.content)) {
		return ""
	}

	return result.content
		.filter((item) => item?.type === "text")
		.map((item) => item.text)
		.join("\n")
		.trim()
}

const parseJsonToolResult = (toolName, result) => {
	const text = extractTextContent(result)
	assert(text, `Tool ${toolName} returned no text content`)

	try {
		return JSON.parse(text)
	} catch {
		fail(`Tool ${toolName} returned non-JSON content: ${text.slice(0, 400)}`)
	}
}

const collectStringValues = (node, values = new Set()) => {
	if (!node || typeof node !== "object") {
		return values
	}

	if (Array.isArray(node.enum)) {
		for (const value of node.enum) {
			if (typeof value === "string") {
				values.add(value)
			}
		}
	}

	if (typeof node.const === "string") {
		values.add(node.const)
	}

	for (const key of ["anyOf", "oneOf", "allOf"]) {
		if (Array.isArray(node[key])) {
			for (const child of node[key]) {
				collectStringValues(child, values)
			}
		}
	}

	return values
}

const collectDescriptions = (node, descriptions = []) => {
	if (!node || typeof node !== "object") {
		return descriptions
	}

	if (typeof node.description === "string") {
		descriptions.push(node.description)
	}

	for (const value of Object.values(node)) {
		if (Array.isArray(value)) {
			for (const child of value) {
				collectDescriptions(child, descriptions)
			}
		} else if (value && typeof value === "object") {
			collectDescriptions(value, descriptions)
		}
	}

	return descriptions
}

const logPass = (name, detail = "") => {
	const suffix = detail ? `: ${detail}` : ""
	console.log(`[PASS] ${name}${suffix}`)
}

async function main() {
	const serverEntry = process.argv[2] ? path.resolve(process.argv[2]) : defaultServerEntry
	if (!fs.existsSync(serverEntry)) {
		fail(`Built MCP server entry not found at ${serverEntry}. Run "npm run build" first.`)
	}

	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [serverEntry],
		cwd: repoRoot,
		stderr: "pipe",
	})
	const client = new Client({
		name: "unreal-mcp-ue4-no-unreal-smoke",
		version: "0.1.0",
	})
	const stderrLines = []

	if (transport.stderr) {
		transport.stderr.on("data", (chunk) => {
			const text = chunk.toString()
			if (!text) {
				return
			}

			stderrLines.push(...text.split(/\r?\n/).filter(Boolean))
			while (stderrLines.length > 40) {
				stderrLines.shift()
			}
		})
	}

	try {
		await client.connect(transport)
		logPass("Connect to MCP server without Unreal")

		const toolsResult = await client.listTools()
		const tools = toolsResult.tools ?? []
		const toolByName = new Map(tools.map((tool) => [tool.name, tool]))
		const namespaceTools = tools.filter((tool) => tool.name.startsWith("manage_"))

		assert(tools.length >= 30, `Expected at least 30 tools, found ${tools.length}`)
		assert(namespaceTools.length >= 20, `Expected at least 20 namespaces, found ${namespaceTools.length}`)
		logPass("List registered MCP tools", `${tools.length} tools, ${namespaceTools.length} namespaces`)

		const widgetTool = toolByName.get("manage_widget")
		assert(widgetTool, "manage_widget namespace tool is missing")
		const widgetSchemaBytes = JSON.stringify(widgetTool.inputSchema ?? {}).length
		assert(
			widgetSchemaBytes < 4000,
			`manage_widget input schema is too large for lazy client discovery (${widgetSchemaBytes} bytes)`,
		)
		logPass("Keep manage_widget schema discoverable", `${widgetSchemaBytes} bytes`)

		const namespacesResult = await client.callTool({
			name: "manage_tools",
			arguments: { action: "list_namespaces" },
		})
		const namespacesPayload = parseJsonToolResult("manage_tools.list_namespaces", namespacesResult)
		assert(namespacesPayload.success === true, "manage_tools.list_namespaces did not report success=true")
		assert(Array.isArray(namespacesPayload.namespaces), "manage_tools.list_namespaces returned no namespaces array")
		logPass("Inspect registered namespaces", `${namespacesPayload.namespaces.length} namespaces`)

		const schemaProblems = []
		let actionCount = 0

		for (const namespaceInfo of namespacesPayload.namespaces) {
			const namespaceName = namespaceInfo.tool_namespace
			const supportedActions = namespaceInfo.supported_actions ?? []
			const tool = toolByName.get(namespaceName)
			if (!tool) {
				schemaProblems.push(`${namespaceName}: missing MCP tool`)
				continue
			}

			const inputSchema = tool.inputSchema ?? {}
			const actionSchema = inputSchema.properties?.action
			const paramsSchema = inputSchema.properties?.params
			const exposedActions = collectStringValues(actionSchema)
			const descriptions = collectDescriptions(paramsSchema).join("\n")

			if (!paramsSchema) {
				schemaProblems.push(`${namespaceName}: missing params schema`)
			}

			for (const actionName of supportedActions) {
				actionCount += 1
				if (!exposedActions.has(actionName)) {
					schemaProblems.push(`${namespaceName}.${actionName}: action is not exposed in input schema`)
				}

				if (!descriptions.includes(`${namespaceName}.${actionName}`)) {
					schemaProblems.push(`${namespaceName}.${actionName}: params schema description is missing`)
				}
			}
		}

		assert(schemaProblems.length === 0, `Namespace schema problems:\n${schemaProblems.join("\n")}`)
		logPass("Verify namespace action schemas", `${actionCount} actions`)

		const invalidRenameResult = await client.callTool({
			name: "manage_asset",
			arguments: {
				action: "rename",
				params: {},
			},
		})
		const invalidRenamePayload = parseJsonToolResult("manage_asset.rename invalid params", invalidRenameResult)
		assert(invalidRenamePayload.success === false, "Invalid params should return success=false")
		assert(
			String(invalidRenamePayload.message ?? "").includes("Invalid params for manage_asset.rename"),
			"Invalid params did not fail during action-specific validation",
		)
		logPass("Validate action params before Unreal execution")

		const missingCodeResult = await client.callTool({
			name: "manage_editor",
			arguments: {
				action: "run_python",
				params: {},
			},
		})
		const missingCodePayload = parseJsonToolResult("manage_editor.run_python invalid params", missingCodeResult)
		assert(missingCodePayload.success === false, "Missing run_python code should return success=false")
		assert(
			String(missingCodePayload.message ?? "").includes("Invalid params for manage_editor.run_python"),
			"Missing run_python code did not fail during action-specific validation",
		)
		logPass("Validate required action params without Unreal")

		console.log("")
		console.log("No-Unreal smoke test completed successfully.")
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error("")
		console.error(`No-Unreal smoke test failed: ${message}`)
		if (stderrLines.length > 0) {
			console.error("")
			console.error("Recent server stderr:")
			for (const line of stderrLines.slice(-20)) {
				console.error(`  ${line}`)
			}
		}
		process.exitCode = 1
	} finally {
		try {
			await client.close()
		} catch {
			// Best effort shutdown only; preserve the smoke-test failure above if one occurred.
		}
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error(`No-Unreal smoke runner crashed: ${message}`)
	process.exit(1)
})
