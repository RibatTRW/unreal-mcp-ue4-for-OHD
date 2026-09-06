#!/usr/bin/env node

// Phase-0 frozen surface snapshot (Effect migration report §5 Phase 0, §6).
// Boots the real server over stdio, captures every tool's
// name/description/inputSchema via listTools, and diffs against the committed
// snapshot. Any tool-surface change — renamed tool, edited description,
// altered inputSchema — fails here BEFORE the migration touches validation.
//
// Usage:
//   node scripts/check-tool-surface.mjs            # compare against snapshot
//   node scripts/check-tool-surface.mjs --update   # regenerate snapshot
//
// The snapshot file is committed: scripts/__snapshots__/list-tools.snapshot.json
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const serverEntry = path.join(repoRoot, "dist", "bin.js")
const snapshotPath = path.join(repoRoot, "scripts", "__snapshots__", "list-tools.snapshot.json")

const stableStringify = (value) => {
	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableStringify(entry)).join(",")}]`
	}

	if (value && typeof value === "object") {
		const entries = Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
		return `{${entries.join(",")}}`
	}

	return JSON.stringify(value) ?? "null"
}

const fail = (message) => {
	console.error(`check-tool-surface: FAIL: ${message}`)
	process.exit(1)
}

async function captureSurface() {
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [serverEntry],
		cwd: repoRoot,
		stderr: "pipe",
	})
	const client = new Client({ name: "unreal-mcp-ue4-tool-surface", version: "0.1.0" })

	try {
		await client.connect(transport)
		const toolsResult = await client.listTools()
		const tools = (toolsResult.tools ?? []).map((tool) => ({
			description: tool.description ?? "",
			inputSchema: tool.inputSchema ?? {},
			name: tool.name,
		}))
		tools.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
		return tools
	} finally {
		try {
			await client.close()
		} catch {
			// Best effort shutdown only.
		}
	}
}

async function main() {
	if (!fs.existsSync(serverEntry)) {
		fail("dist/bin.js is missing — run `npm run build` first.")
	}

	const update = process.argv.includes("--update")
	const tools = await captureSurface()

	if (tools.length === 0) {
		fail("server returned zero tools.")
	}

	if (update) {
		fs.mkdirSync(path.dirname(snapshotPath), { recursive: true })
		fs.writeFileSync(snapshotPath, `${stableStringify(tools)}\n`)
		console.log(`[PASS] check-tool-surface: snapshot updated (${tools.length} tools)`)
		return
	}

	if (!fs.existsSync(snapshotPath)) {
		fail(`snapshot missing at ${snapshotPath} — run with --update to create it.`)
	}

	const expected = JSON.parse(fs.readFileSync(snapshotPath, "utf8"))
	const expectedByName = new Map(expected.map((tool) => [tool.name, tool]))
	const actualByName = new Map(tools.map((tool) => [tool.name, tool]))
	const problems = []

	for (const tool of tools) {
		if (!expectedByName.has(tool.name)) {
			problems.push(`added tool: ${tool.name}`)
		}
	}

	for (const tool of expected) {
		if (!actualByName.has(tool.name)) {
			problems.push(`removed tool: ${tool.name}`)
		}
	}

	for (const tool of tools) {
		const frozen = expectedByName.get(tool.name)
		if (!frozen) {
			continue
		}

		if (tool.description !== frozen.description) {
			problems.push(`description changed: ${tool.name}`)
		}

		if (stableStringify(tool.inputSchema) !== stableStringify(frozen.inputSchema)) {
			problems.push(`inputSchema changed: ${tool.name}`)
		}
	}

	if (problems.length > 0) {
		fail(`tool surface drifted (${problems.length}):\n  - ${problems.join("\n  - ")}`)
	}

	console.log(`[PASS] check-tool-surface: tool surface frozen (${tools.length} tools)`)
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error)
	fail(`runner crashed: ${message}`)
})
