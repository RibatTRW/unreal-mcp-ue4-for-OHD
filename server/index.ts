import { McpServer } from "@modelcontextprotocol/server"
import { serveStdio } from "@modelcontextprotocol/server/stdio"
import { Effect, Layer } from "effect"

import { ConnectionSessionService } from "./effect/connection-service.js"
import { PreludeService, PreludeServiceLive } from "./effect/prelude-service.js"
import { registerDirectTools } from "./register-direct-tools.js"
import { createRegistrationContext } from "./registration-context.js"
import { SharedConnectionSessionLive } from "./remote-execution.js"
import { registerAllToolNamespaces } from "./tool-namespaces.js"
import { projectVersion } from "./version.js"

// Composition root (Phase 6, report §5): server construction over the
// live services. PreludeService is required here so the prelude files
// load once, fail-fast, at startup; the ConnectionSessionService is
// threaded into registration (dispatch and direct tools run its Effects
// per call). The docs resource is not a tool (no schema) — it stays
// registered as-is.
const makeServer = Effect.gen(function* () {
	const commands = yield* ConnectionSessionService
	yield* PreludeService

	const server = new McpServer({
		name: "UnrealMCP-UE4",
		description:
			"Unreal Engine MCP for UE4.25.4 (Operation Harsh Doorstop mod kit) with UE4 editor scripting compatibility helpers",
		version: projectVersion,
	})

	const registrationContext = createRegistrationContext(server, commands)

	registerDirectTools(registrationContext)
	registerAllToolNamespaces(registrationContext)

	// MCP 2026-07-28 (SDK v2): the removed `resource()` becomes
	// `registerResource()` with an explicit (here empty) metadata config.
	server.registerResource("docs", "docs://unreal_python", {}, async () => {
		return {
			contents: [
				{
					uri: "https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/?application_version=4.25",
					text: "Unreal Engine 4.25 Python API Documentation",
				},
			],
		}
	})

	// MCP 2026-07-28 (SDK v2): `serveStdio` owns the era decision for the
	// stdio connection — the opening exchange pins it to 2026-07-28 when the
	// client speaks it, else to the 2025-era handshake (default `legacy:
	// 'serve'`). A hand-wired `server.connect(transport)` would serve the
	// 2025 era only. The factory returns the service-wired instance built
	// above (stdio carries exactly one connection, so it is called once).
	// serveStdio returns a handle, not a promise, so park the fiber here:
	// scope finalizers (connection shutdown) run when a signal interrupts it.
	const handle = yield* Effect.try({
		try: () => serveStdio(() => server),
		catch: (cause) => cause,
	})
	// The release must be infallible for acquireRelease: a stdio-teardown
	// failure at shutdown is ignored (process exit tears down the pipes).
	yield* Effect.acquireRelease(Effect.succeed(handle), (entry) =>
		Effect.tryPromise({
			try: () => entry.close(),
			catch: (cause) => cause,
		}).pipe(Effect.ignore),
	)
	yield* Effect.never
})

// The launched server owns no service of its own — it only holds the
// scope (connection shutdown runs as the shared layer's finalizer) —
// so the layer discards its output.
const ServerLive = Layer.scopedDiscard(makeServer)

export const MainLive: Layer.Layer<never, unknown, never> = Layer.provide(
	ServerLive,
	Layer.merge(PreludeServiceLive, SharedConnectionSessionLive),
)
