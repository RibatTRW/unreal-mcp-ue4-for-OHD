import { Effect } from "effect"
import type { IRemoteExecutionMessageCommandOutputData, RemoteExecutionNode } from "unreal-remote-execution"

import {
	type ConnectionSessionServiceShape,
	makeConnectionSessionService,
	runCompatPromise,
	withCompatErrors,
} from "./effect/connection-service.js"

// Explicit connection session over an injected transport seam
// (candidate 8). All retry/backoff/stale-connection policy moved here
// verbatim from remote-execution.ts — behavior identical.
//
// Phase 2 (Effect migration): the policy implementation lives in
// server/effect/connection-service.ts (Effect.retry over a custom 1.5x
// schedule, Clock sleeps, cached acquisitions, one Schedule.once stale
// retry). This module keeps the Promise-typed class API, the pure
// recoverable-error predicate, and the policy constants. Phase 6 removed
// the module-global singleton shims, but the class stays as the
// injectable Promise-compat boundary (driven by the scripted scenarios
// in scripts/check-connection-session.mjs).

export const DEFAULT_RETRY_COUNT = 3
export const DEFAULT_RETRY_DELAY_MS = 2000
export const INIT_PROBE_COMMAND = 'print("rrmcp:init")'
export const MAX_RETRY_DELAY_MS = 10000

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
		typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined
	return code === "ECONNRESET"
}

export class ConnectionSession {
	private readonly service: ConnectionSessionServiceShape

	constructor(options: ConnectionSessionOptions) {
		this.service = Effect.runSync(makeConnectionSessionService(options))
	}

	async shutdown(): Promise<void> {
		await runCompatPromise(this.service.shutdown)
	}

	async runCommand(command: string): Promise<string> {
		return runCompatPromise(withCompatErrors(this.service.runCommand(command)))
	}

	async discoverPath(command: string, errorMessage: string): Promise<string> {
		return runCompatPromise(withCompatErrors(this.service.discoverPath(command, errorMessage)))
	}
}
