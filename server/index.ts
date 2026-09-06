import { Effect, Layer } from "effect"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

import { ConnectionSessionService } from "./effect/connection-service.js"
import { PreludeService, PreludeServiceLive } from "./effect/prelude-service.js"
import { SharedConnectionSessionLive } from "./remote-execution.js"
import { registerDirectTools } from "./register-direct-tools.js"
import { createRegistrationContext } from "./registration-context.js"
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

	server.resource("docs", "docs://unreal_python", async () => {
		return {
			contents: [
				{
					uri: "https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/?application_version=4.25",
					text: "Unreal Engine 4.25 Python API Documentation",
				},
			],
		}
	})

	const transport = new StdioServerTransport()
	yield* Effect.tryPromise({
		try: () => server.connect(transport),
		catch: (cause) => cause,
	})
})

// The launched server owns no service of its own — it only holds the
// scope (connection shutdown runs as the shared layer's finalizer) —
// so the layer discards its output.
const ServerLive = Layer.scopedDiscard(makeServer)

export const MainLive: Layer.Layer<never, unknown, never> = Layer.provide(
	ServerLive,
	Layer.merge(PreludeServiceLive, SharedConnectionSessionLive),
)
