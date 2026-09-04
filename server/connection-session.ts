import type {
	IRemoteExecutionMessageCommandOutputData,
	RemoteExecutionNode,
} from "unreal-remote-execution"

// Explicit connection session over an injected transport seam
// (candidate 8). All retry/backoff/stale-connection policy moved here
// verbatim from remote-execution.ts — behavior identical, including the two
// known smells noted below (follow-ups, NOT fixed here):
// (a) when the stale retry in runCommand returns !success, the throw
//     surfaces the ORIGINAL error, not the retry's;
// (b) backoff state lives in the mutated retryDelay local.

export const DEFAULT_RETRY_COUNT = 3
export const DEFAULT_RETRY_DELAY_MS = 2000
export const INIT_PROBE_COMMAND = 'print("rrmcp:init")'
const MAX_RETRY_DELAY_MS = 10000

// Subset-mirror of the RemoteExecution surface the policy uses: same
// method names/shapes, narrowed to what the session calls. runCommand is
// narrowed to (command) — the session never passes the other options.
export interface ConnectionTransport {
	start(): Promise<void>
	stop(): void
	hasCommandConnection(): boolean
	openCommandConnection(node: RemoteExecutionNode): Promise<void>
	closeCommandConnection(): void
	getFirstRemoteNode(pingInterval?: number, timeoutMs?: number): Promise<RemoteExecutionNode>
	runCommand(command: string): Promise<IRemoteExecutionMessageCommandOutputData>
}

export interface RetryPolicy {
	maxRetries: number
	retryDelayMs: number
}

export interface ConnectionSessionOptions {
	transport: ConnectionTransport
	retryCount?: number
	retryDelayMs?: number
	readRetryPolicy?: () => RetryPolicy
	createTransport?: () => ConnectionTransport
	sleep?: (ms: number) => Promise<void>
	log?: (...args: unknown[]) => void
}

// Owns "which connection errors are transient". bin.ts delegates to this;
// the guard itself stays in bin.ts (uncaught socket errors outside any
// command try/catch can never be caught by retry logic).
export const isRecoverableConnectionError = (error: unknown): boolean => {
	const code =
		typeof error === "object" && error !== null && "code" in error
			? (error as { code?: unknown }).code
			: undefined
	return code === "ECONNRESET"
}

export class ConnectionSession {
	private transport: ConnectionTransport
	private readonly retryCount: number
	private readonly retryDelayMs: number
	private readonly readRetryPolicy?: () => RetryPolicy
	private readonly createTransport?: () => ConnectionTransport
	private readonly sleep: (ms: number) => Promise<void>
	private readonly log: (...args: unknown[]) => void
	private startPromise: Promise<void> | undefined = undefined
	private connectionPromise: Promise<ConnectionTransport> | undefined = undefined
	private needsTransportRecreate = false

	constructor(options: ConnectionSessionOptions) {
		this.transport = options.transport
		this.retryCount = options.retryCount ?? DEFAULT_RETRY_COUNT
		this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
		this.readRetryPolicy = options.readRetryPolicy
		this.createTransport = options.createTransport
		this.sleep =
			options.sleep ??
			((ms) => {
				return new Promise<void>((resolve) => {
					setTimeout(resolve, ms)
				})
			})
		this.log = options.log ?? ((...args: unknown[]) => console.error(...args))
	}

	private async ensureStarted(): Promise<void> {
		// Lazy recreation mirrors today exactly: a failed start drops the
		// runtime (base: remoteExecution = undefined) and the replacement is
		// built on the NEXT ensure — not synchronously inside the failure.
		if (this.needsTransportRecreate && this.createTransport) {
			this.transport = this.createTransport()
			this.needsTransportRecreate = false
		}

		if (!this.startPromise) {
			const transport = this.transport
			this.startPromise = transport
				.start()
				.catch((error) => {
					if (this.transport === transport && this.createTransport) {
						this.needsTransportRecreate = true
					}
					throw error
				})
				.finally(() => {
					this.startPromise = undefined
				})
		}

		await this.startPromise
	}

	private async connectWithRetry(): Promise<ConnectionTransport> {
		await this.ensureStarted()
		const policy = this.readRetryPolicy
			? this.readRetryPolicy()
			: { maxRetries: this.retryCount, retryDelayMs: this.retryDelayMs }
		let retryDelay = policy.retryDelayMs
		let lastError: unknown = undefined

		for (let attempt = 1; attempt <= policy.maxRetries; attempt += 1) {
			try {
				const node = await this.transport.getFirstRemoteNode(1000, 5000)
				await this.transport.openCommandConnection(node)

				const result = await this.transport.runCommand(INIT_PROBE_COMMAND)
				if (!result.success) {
					throw new Error(`Failed to run command: ${JSON.stringify(result.result)}`)
				}

				return this.transport
			} catch (error) {
				lastError = error
				this.log(`Connection attempt ${attempt} failed:`, error)

				try {
					if (this.transport.hasCommandConnection()) {
						this.transport.closeCommandConnection()
					}
				} catch (closeError) {
					this.log("Failed to close Unreal command connection after a failed attempt:", closeError)
				}

				if (attempt < policy.maxRetries) {
					this.log(`Retrying in ${retryDelay}ms...`)
					await this.sleep(retryDelay)
					retryDelay = Math.min(retryDelay * 1.5, MAX_RETRY_DELAY_MS)
				}
			}
		}

		throw lastError instanceof Error
			? lastError
			: new Error("Unable to connect to your Unreal Engine Editor after multiple attempts")
	}

	private async ensureConnection(): Promise<ConnectionTransport> {
		if (this.transport.hasCommandConnection()) {
			return this.transport
		}

		if (!this.connectionPromise) {
			this.connectionPromise = this.connectWithRetry().finally(() => {
				if (!this.transport.hasCommandConnection()) {
					this.connectionPromise = undefined
				}
			})
		}

		return this.connectionPromise
	}

	async shutdown(): Promise<void> {
		const transport = this.transport
		this.startPromise = undefined
		this.connectionPromise = undefined

		try {
			if (transport.hasCommandConnection()) {
				transport.closeCommandConnection()
			}
		} catch (error) {
			this.log("Failed to close Unreal command connection during shutdown:", error)
		}

		try {
			transport.stop()
		} catch (error) {
			this.log("Failed to stop Unreal Remote Execution during shutdown:", error)
		}
	}

	async runCommand(command: string): Promise<string> {
		const runtime = await this.ensureConnection()

		try {
			const result = await runtime.runCommand(command)
			if (!result.success) {
				throw new Error(`Command failed with: ${result.result}`)
			}

			return result.output.map((line) => line.output).join("\n")
		} catch (error) {
			try {
				if (runtime.hasCommandConnection()) {
					runtime.closeCommandConnection()
				}
			} catch (closeError) {
				this.log("Failed to close stale Unreal command connection:", closeError)
			}

			this.connectionPromise = undefined
			const retryRuntime = await this.ensureConnection()
			const retryResult = await retryRuntime.runCommand(command)
			if (!retryResult.success) {
				throw error instanceof Error ? error : new Error(String(error))
			}

			return retryResult.output.map((line) => line.output).join("\n")
		}
	}

	async discoverPath(command: string, errorMessage: string): Promise<string> {
		const output = await this.runCommand(command)
		const lines = output
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean)
		const discoveredPath = lines.length > 0 ? lines[lines.length - 1] : ""

		if (!discoveredPath || discoveredPath === "None") {
			throw new Error(errorMessage)
		}

		return discoveredPath
	}
}
