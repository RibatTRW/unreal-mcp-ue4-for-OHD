#!/usr/bin/env node

import { Effect, Fiber, Layer } from "effect"
import { isRecoverableConnectionError } from "./connection-session.js"
import { runCompatPromise } from "./effect/connection-service.js"
import { projectVersion } from "./version.js"

const cliArgs = process.argv.slice(2)
if (cliArgs.includes("--version") || cliArgs.includes("-v")) {
	console.log(projectVersion)
	process.exit(0)
}

let serverFiber: Fiber.RuntimeFiber<never, unknown> | undefined
let shutdownRequested = false

// Scoped shutdown (Phase 6, report §5): the launched layer owns the
// shutdown finalizer (connection close/stop), so interrupting its fiber
// closes the scope and runs teardown. Interrupt is idempotent, which
// replaces the shutdownInProgress flag — concurrent signals/exit hooks
// all join the same teardown.
const shutdown = () => {
	shutdownRequested = true
	const fiber = serverFiber
	serverFiber = undefined

	if (!fiber) {
		return Promise.resolve()
	}

	return Effect.runPromise(Fiber.interrupt(fiber))
}

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
	const serverModule = await import("./index.js")

	// forkDaemon (not fork): the fiber must outlive this runPromise scope —
	// a scope-attached child would be interrupted when the fork effect
	// completes (structured concurrency). The daemon fiber lives until a
	// signal/exit handler interrupts it or the layer build fails.
	// Layer.launch builds MainLive in its own scope, then serves forever;
	// joining surfaces a startup/build failure exactly like the old
	// `await server.connect` throw did.
	const fiber = await Effect.runPromise(Effect.forkDaemon(Layer.launch(serverModule.MainLive)))
	serverFiber = fiber
	await runCompatPromise(Fiber.join(fiber))
}

const shutdownHandler = () => {
	void shutdown().finally(() => process.exit(0))
}

process.once("SIGINT", shutdownHandler)

process.once("SIGTERM", shutdownHandler)

process.once("beforeExit", () => {
	void shutdown()
})

process.once("exit", () => {
	void shutdown()
})

void main().catch((error) => {
	if (shutdownRequested) {
		return
	}

	const message = error instanceof Error ? error.message : String(error)
	console.error(`Failed to start unreal-mcp-ue4: ${message}`)
	process.exit(1)
})
