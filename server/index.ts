import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { createRegistrationContext } from "./registration-context.js"
import { registerDirectTools } from "./register-direct-tools.js"
import { registerToolNamespaces } from "./register-namespaces.js"
import { shutdownRemoteExecution } from "./remote-execution.js"
import { projectVersion } from "./version.js"

export { shutdownRemoteExecution }

export const server = new McpServer({
	name: "UnrealMCP-UE4",
	description: "Unreal Engine MCP for UE4.25.4 (Operation Harsh Doorstop mod kit) with UE4 editor scripting compatibility helpers",
	version: projectVersion,
})

const registrationContext = createRegistrationContext(server)

registerDirectTools(registrationContext)
registerToolNamespaces(registrationContext)

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
