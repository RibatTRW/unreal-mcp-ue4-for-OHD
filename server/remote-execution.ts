import os from "node:os"

import { Effect } from "effect"
import { RemoteExecution, RemoteExecutionConfig } from "unreal-remote-execution"
import type { IRemoteExecutionMessageCommandOutputData, RemoteExecutionNode } from "unreal-remote-execution"

import { type ConnectionTransport, DEFAULT_RETRY_COUNT, DEFAULT_RETRY_DELAY_MS } from "./connection-session.js"
import {
	type ConnectionSessionServiceShape,
	makeConnectionSessionLayer,
	makeConnectionSessionService,
	runCompatPromise,
	withCompatErrors,
} from "./effect/connection-service.js"

export const DEFAULT_MULTICAST_TTL = 1
export const DEFAULT_MULTICAST_ADDRESS = "239.0.0.1"
export const DEFAULT_MULTICAST_PORT = 6766
export const DEFAULT_COMMAND_PORT = 6776

const readIntegerEnv = (name: string, fallback: number) => {
	const value = process.env[name]
	if (!value) {
		return fallback
	}

	const parsedValue = Number.parseInt(value, 10)
	return Number.isFinite(parsedValue) ? parsedValue : fallback
}

const readStringEnv = (name: string) => {
	const value = process.env[name]
	return typeof value === "string" && value.trim() ? value.trim() : undefined
}

const resolveRemoteExecutionBindAddress = () => {
	const override = readStringEnv("UNREAL_MCP_BIND_ADDRESS")
	if (override) {
		return override
	}

	const interfaces = os.networkInterfaces()
	for (const networkInterface of Object.values(interfaces)) {
		for (const addressInfo of networkInterface ?? []) {
			if (addressInfo.family === "IPv4" && !addressInfo.internal) {
				return addressInfo.address
			}
		}
	}

	return "0.0.0.0"
}

const createRemoteExecutionConfig = () => {
	const multicastTTL = readIntegerEnv("UNREAL_MCP_MULTICAST_TTL", DEFAULT_MULTICAST_TTL)
	const multicastAddress = readStringEnv("UNREAL_MCP_MULTICAST_ADDRESS") ?? DEFAULT_MULTICAST_ADDRESS
	const multicastPort = readIntegerEnv("UNREAL_MCP_MULTICAST_PORT", DEFAULT_MULTICAST_PORT)
	const bindAddress = resolveRemoteExecutionBindAddress()
	const commandAddress = readStringEnv("UNREAL_MCP_COMMAND_ADDRESS") ?? bindAddress
	const commandPort = readIntegerEnv("UNREAL_MCP_COMMAND_PORT", DEFAULT_COMMAND_PORT)

	return {
		bindAddress,
		commandAddress,
		commandPort,
		config: new RemoteExecutionConfig(multicastTTL, [multicastAddress, multicastPort], bindAddress, [
			commandAddress,
			commandPort,
		]),
	}
}

// Real-transport adapter: thin wrapper satisfying the session's transport
// seam with the live editor library. All policy lives in
// connection-session.ts; this file owns config + singleton lifecycle only.
class RealRemoteExecutionTransport implements ConnectionTransport {
	private readonly runtime: RemoteExecution

	constructor(runtime: RemoteExecution) {
		this.runtime = runtime
	}

	start(): Promise<void> {
		return this.runtime.start()
	}

	stop(): void {
		this.runtime.stop()
	}

	hasCommandConnection(): boolean {
		return this.runtime.hasCommandConnection()
	}

	async openCommandConnection(node: RemoteExecutionNode): Promise<void> {
		await this.runtime.openCommandConnection(node)
	}

	closeCommandConnection(): void {
		this.runtime.closeCommandConnection()
	}

	async getFirstRemoteNode(pingInterval?: number, timeoutMs?: number): Promise<RemoteExecutionNode> {
		return this.runtime.getFirstRemoteNode(pingInterval, timeoutMs)
	}

	async runCommand(command: string): Promise<IRemoteExecutionMessageCommandOutputData> {
		return this.runtime.runCommand(command)
	}
}

const createSessionTransport = () => {
	const { bindAddress, commandAddress, commandPort, config } = createRemoteExecutionConfig()
	console.error(
		`Using Unreal Remote Execution bind address: ${bindAddress} (command: ${commandAddress}:${commandPort})`,
	)
	return new RealRemoteExecutionTransport(new RemoteExecution(config))
}

const createSharedServiceOptions = () => ({
	transport: createSessionTransport(),
	createTransport: createSessionTransport,
	readRetryPolicy: () => ({
		maxRetries: readIntegerEnv("UNREAL_MCP_RETRY_COUNT", DEFAULT_RETRY_COUNT),
		retryDelayMs: readIntegerEnv("UNREAL_MCP_RETRY_DELAY_MS", DEFAULT_RETRY_DELAY_MS),
	}),
})

// Singleton as a Layer (Phase 2, report §4.3): the shared service is built
// from this layer. Kept lazy — the layer (and its transport) is only
// constructed on first tryRunCommand/discoverPath, never at import.
export const makeSharedConnectionSessionLayer = () => makeConnectionSessionLayer(createSharedServiceOptions())

let session: ConnectionSessionServiceShape | undefined = undefined

const getSharedSession = () => {
	if (!session) {
		session = Effect.runSync(makeConnectionSessionService(createSharedServiceOptions()))
	}

	return session
}

export const shutdownRemoteExecution = async () => {
	const runtime = session
	session = undefined

	if (!runtime) {
		return
	}

	await runCompatPromise(runtime.shutdown)
}

export const tryRunCommand = async (command: string): Promise<string> => {
	return runCompatPromise(withCompatErrors(getSharedSession().runCommand(command)))
}

export const discoverPath = async (command: string, errorMessage: string) => {
	return runCompatPromise(withCompatErrors(getSharedSession().discoverPath(command, errorMessage)))
}
