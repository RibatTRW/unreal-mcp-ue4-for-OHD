#!/usr/bin/env node

// One-shot run_python probe: sends raw Python 2.7 code to the live editor
// through the already-built MCP server and prints whatever comes back.
// Bypasses the in-editor console box entirely.
//
// Usage:
//   node scripts/probe-once.mjs --file <py-file> [--timeout-ms 20000] [--verbose]
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

import { extractTextContent, withTimeout } from "./e2e/harness-utils.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")

function argValue(flag) {
	const index = process.argv.indexOf(flag)
	return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : undefined
}

const file = argValue("--file")
const inline = argValue("--code")
const timeoutMs = Number(argValue("--timeout-ms") ?? 20000)
const verbose = process.argv.includes("--verbose")
const serverEntry = argValue("--server-entry") ?? path.join(repoRoot, "dist", "bin.js")

if (!file && !inline) {
	console.error("probe-once: pass --file <py-file> or --code <python-code>")
	process.exit(1)
}

if (!fs.existsSync(serverEntry)) {
	console.error(`probe-once: built server not found at ${serverEntry}. Run "npm run build" first.`)
	process.exit(1)
}

const code = file ? fs.readFileSync(path.resolve(repoRoot, file), "utf8") : inline

const transport = new StdioClientTransport({
	command: process.execPath,
	args: [serverEntry],
	cwd: repoRoot,
	stderr: "pipe",
})

if (verbose && transport.stderr) {
	transport.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk.toString()}`))
}

const client = new Client({ name: "unreal-mcp-ue4-probe", version: "0.1.0" })

try {
	await withTimeout(client.connect(transport), timeoutMs, "MCP connect")
	const result = await withTimeout(
		client.callTool({
			name: "manage_editor",
			arguments: { action: "run_python", params: { code } },
		}),
		timeoutMs,
		"run_python",
	)
	console.log(extractTextContent(result) || "(empty response)")
} catch (error) {
	console.error(`probe-once failed: ${error instanceof Error ? error.message : String(error)}`)
	process.exitCode = 1
} finally {
	try {
		await transport.close()
	} catch {
		// Ignore close errors during teardown.
	}
}
