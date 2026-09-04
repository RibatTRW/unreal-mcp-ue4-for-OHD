#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { isRecoverableConnectionError } from "./connection-session.js"
import { projectVersion } from "./version.js"

const cliArgs = process.argv.slice(2)
if (cliArgs.includes("--version") || cliArgs.includes("-v")) {
	console.log(projectVersion)
	process.exit(0)
}

let shutdownInProgress = false
let shutdownRemoteExecution: (() => Promise<void>) | undefined

// The remote-execution library leaves its command TCP socket without an
// 'error' listener, so an editor-side connection drop (editor crash,
// restart, or a wedged PIE start) surfaces as an uncaught ECONNRESET that
// kills the whole server process — taking every in-flight tool call and all
// cleanup with it. Convert exactly that case into a logged, survivable
// event; the retry logic in connection-session.ts re-establishes the command
// connection on the next command. Anything else still crashes loudly.
// Which errors count as recoverable is session policy
// (isRecoverableConnectionError); this wiring just delivers the verdict.
process.on("uncaughtException", (error: unknown) => {
	if (isRecoverableConnectionError(error)) {
		console.error(
			"Unreal editor connection was reset (ECONNRESET). Staying alive; the next command will reconnect. Detail:",
			error instanceof Error ? error.message : String(error),
		)
		return
	}
	console.error("Uncaught exception, exiting:", error)
	process.exit(1)
})

async function main() {
	const serverModule = await import("./")
	shutdownRemoteExecution = serverModule.shutdownRemoteExecution

	const transport = new StdioServerTransport()
	await serverModule.server.connect(transport)
}

const shutdown = async () => {
	if (shutdownInProgress) {
		return
	}

	shutdownInProgress = true
	if (shutdownRemoteExecution) {
		await shutdownRemoteExecution()
	}
}

process.once("SIGINT", () => {
	void shutdown().finally(() => process.exit(0))
})

process.once("SIGTERM", () => {
	void shutdown().finally(() => process.exit(0))
})

process.once("beforeExit", () => {
	void shutdown()
})

process.once("exit", () => {
	void shutdown()
})

void main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error(`Failed to start unreal-mcp-ue4: ${message}`)
	process.exit(1)
})
