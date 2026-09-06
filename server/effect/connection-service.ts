// Effect migration — Phase 2 transport/session service (report §4.3, §5).
//
// Effect-backed implementation of the connection-session.ts policy:
//   - connect retry as Effect.retry over a custom 1.5x capped schedule
//     (Schedule.unfold — deliberately NOT Schedule.exponential, which
//     doubles; timing must match the legacy loop exactly),
//   - sleeps via Clock.sleep and logs via Effect.logError (the sleep/log
//     constructor options remain as overrides so scripted fake-transport
//     scenarios keep driving the built output deterministically),
//   - memoized acquisitions via cached effects with explicit invalidation
//     (Duration.infinity TTL — only manual invalidation fires), preserving
//     the lazy-recreate quirk (the replacement transport is built on the
//     NEXT ensure, never inside the failure),
//   - the single stale retry governed by one Schedule.once, gated so a
//     failed ensure does NOT trigger an extra connect cycle,
//   - isRecoverableConnectionError stays pure in connection-session.ts.
//
// connection-session.ts keeps the Promise-typed class API as a thin
// boundary over this module (and remote-execution.ts keeps Promise-typed
// shims over a Layer-built singleton) so unmigrated callers keep
// compiling. Failures flow as the typed ToolError channel
// (ConnectionError/CommandFailedError/DiscoveryError) and are unwrapped to
// the legacy plain Errors at the boundary via withCompatErrors.

import { Cause, Clock, Context, Duration, Effect, Exit, Layer, Ref, Schedule, SynchronizedRef } from "effect"

import {
	type ConnectionSessionOptions,
	type ConnectionTransport,
	DEFAULT_RETRY_COUNT,
	DEFAULT_RETRY_DELAY_MS,
	INIT_PROBE_COMMAND,
	MAX_RETRY_DELAY_MS,
} from "../connection-session.js"
import { CommandFailedError, ConnectionError, DiscoveryError } from "./errors.js"

const sleepEffect = (options: ConnectionSessionOptions, ms: number): Effect.Effect<void> => {
	const sleepOverride = options.sleep
	return sleepOverride ? Effect.promise(() => sleepOverride(ms)) : Clock.sleep(Duration.millis(ms))
}

const logEffect = (options: ConnectionSessionOptions, ...args: Array<unknown>): Effect.Effect<void> => {
	const logOverride = options.log
	if (logOverride) {
		return Effect.sync(() => {
			logOverride(...args)
		})
	}
	return Effect.logError(...args)
}

// Custom 1.5x backoff capped at MAX_RETRY_DELAY_MS. The unfold state
// carries the current delay plus the 0-based step index: the first retry
// waits initialDelayMs, then ×1.5 each step. The driver steps the schedule
// once per failure INCLUDING the final one (that is how it learns the
// policy is exhausted), and tapOutput runs on every step — even the
// terminal Done step — so the sleep+log are guarded by the same
// `step < maxRetries - 1` bound that halts the schedule. Without the
// guard, the final failure would sleep and log "Retrying..." once more.
export interface ConnectionRetryState {
	readonly delayMs: number
	readonly step: number
}

export const makeConnectionRetrySchedule = (
	initialDelayMs: number,
	maxRetries: number,
	options: ConnectionSessionOptions,
): Schedule.Schedule<ConnectionRetryState, unknown, never> =>
	Schedule.unfold({ delayMs: initialDelayMs, step: 0 }, (state: ConnectionRetryState) => ({
		delayMs: Math.min(state.delayMs * 1.5, MAX_RETRY_DELAY_MS),
		step: state.step + 1,
	})).pipe(
		Schedule.whileOutput((state) => state.step < maxRetries - 1),
		Schedule.tapOutput((state) =>
			state.step < maxRetries - 1
				? Effect.zipRight(logEffect(options, `Retrying in ${state.delayMs}ms...`), sleepEffect(options, state.delayMs))
				: Effect.void,
		),
	)

// The single stale retry: exactly one Schedule.once, allowed to fire only
// when a command actually ran on an acquired connection (ensured). A failed
// ensure leaves the flag down, so the schedule halts and the connect error
// surfaces without an extra connect cycle — matching the legacy runCommand,
// whose stale catch only wraps the post-ensure run.
export const makeStaleRetrySchedule = (ensured: Ref.Ref<boolean>): Schedule.Schedule<void, unknown, never> =>
	Schedule.once.pipe(Schedule.whileOutputEffect(() => Ref.get(ensured)))

export interface ConnectionSessionServiceShape {
	readonly runCommand: (command: string) => Effect.Effect<string, ConnectionError | CommandFailedError | unknown>
	readonly discoverPath: (
		command: string,
		errorMessage: string,
	) => Effect.Effect<string, ConnectionError | CommandFailedError | DiscoveryError | unknown>
	readonly shutdown: Effect.Effect<void>
}

export class ConnectionSessionService extends Context.Tag("ConnectionSessionService")<
	ConnectionSessionService,
	ConnectionSessionServiceShape
>() {}

interface ConnectContext {
	readonly options: ConnectionSessionOptions
	readonly transportCell: SynchronizedRef.SynchronizedRef<ConnectionTransport>
	readonly ensureStarted: Effect.Effect<void, unknown>
}

const closeAfterFailedAttempt = (context: ConnectContext): Effect.Effect<void> =>
	Effect.catchAll(
		Effect.flatMap(SynchronizedRef.get(context.transportCell), (transport) =>
			Effect.sync(() => {
				if (transport.hasCommandConnection()) {
					transport.closeCommandConnection()
				}
			}),
		),
		(closeError) =>
			logEffect(context.options, "Failed to close Unreal command connection after a failed attempt:", closeError),
	)

const connectAttempt = (context: ConnectContext): Effect.Effect<ConnectionTransport, unknown> =>
	Effect.gen(function* () {
		const transport = yield* SynchronizedRef.get(context.transportCell)
		const node = yield* Effect.tryPromise({
			try: () => transport.getFirstRemoteNode(1000, 5000),
			catch: (error) => error,
		})
		yield* Effect.tryPromise({
			try: () => transport.openCommandConnection(node),
			catch: (error) => error,
		})
		const result = yield* Effect.tryPromise({
			try: () => transport.runCommand(INIT_PROBE_COMMAND),
			catch: (error) => error,
		})
		if (!result.success) {
			return yield* Effect.fail(new Error(`Failed to run command: ${JSON.stringify(result.result)}`))
		}
		return transport
	})

const readRetryPolicy = (options: ConnectionSessionOptions): { maxRetries: number; retryDelayMs: number } => {
	if (options.readRetryPolicy) {
		return options.readRetryPolicy()
	}
	return {
		maxRetries: options.retryCount ?? DEFAULT_RETRY_COUNT,
		retryDelayMs: options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
	}
}

const connectWithRetry = (context: ConnectContext): Effect.Effect<ConnectionTransport, ConnectionError | unknown> =>
	Effect.gen(function* () {
		yield* context.ensureStarted
		const policy = readRetryPolicy(context.options)
		if (policy.maxRetries < 1) {
			return yield* Effect.fail(
				new ConnectionError({
					cause: new Error("Unable to connect to your Unreal Engine Editor after multiple attempts"),
					attempt: 0,
				}),
			)
		}
		const attemptCount = yield* Ref.make(0)
		const attempt = Effect.flatMap(
			Ref.updateAndGet(attemptCount, (count) => count + 1),
			(attemptNumber) =>
				connectAttempt(context).pipe(
					Effect.tapError((rawError) =>
						Effect.zipRight(
							logEffect(context.options, `Connection attempt ${attemptNumber} failed:`, rawError),
							closeAfterFailedAttempt(context),
						),
					),
					Effect.mapError((rawError) => new ConnectionError({ cause: rawError, attempt: attemptNumber })),
				),
		)
		return yield* Effect.retry(
			attempt,
			makeConnectionRetrySchedule(policy.retryDelayMs, policy.maxRetries, context.options),
		)
	})

const closeStaleConnection = (options: ConnectionSessionOptions, runtime: ConnectionTransport): Effect.Effect<void> =>
	Effect.catchAll(
		Effect.sync(() => {
			if (runtime.hasCommandConnection()) {
				runtime.closeCommandConnection()
			}
		}),
		(closeError) => logEffect(options, "Failed to close stale Unreal command connection:", closeError),
	)

const runOnRuntime = (
	runtime: ConnectionTransport,
	command: string,
): Effect.Effect<string, CommandFailedError | unknown> =>
	Effect.flatMap(
		Effect.tryPromise({
			try: () => runtime.runCommand(command),
			catch: (error) => error,
		}),
		(result) =>
			result.success
				? Effect.succeed(result.output.map((line) => line.output).join("\n"))
				: Effect.fail(new CommandFailedError({ result: result.result })),
	)

export const makeConnectionSessionService = (
	options: ConnectionSessionOptions,
): Effect.Effect<ConnectionSessionServiceShape> =>
	Effect.gen(function* () {
		const transportCell = yield* SynchronizedRef.make(options.transport)
		const needsTransportRecreate = yield* Ref.make(false)

		// Lazy recreation mirrors the legacy quirk exactly: a failed start
		// arms the flag, and the replacement is built on the NEXT ensure —
		// never synchronously inside the failure.
		const ensureStartedBody = Effect.gen(function* () {
			if ((yield* Ref.get(needsTransportRecreate)) && options.createTransport) {
				const createTransport = options.createTransport
				yield* SynchronizedRef.set(transportCell, createTransport())
				yield* Ref.set(needsTransportRecreate, false)
			}
			const transport = yield* SynchronizedRef.get(transportCell)
			yield* Effect.tryPromise({
				try: () => transport.start(),
				catch: (error) => error,
			}).pipe(
				Effect.tapError(() =>
					Effect.gen(function* () {
						if ((yield* SynchronizedRef.get(transportCell)) === transport && options.createTransport) {
							yield* Ref.set(needsTransportRecreate, true)
						}
					}),
				),
			)
		})
		// Single-flight memo: concurrent ensures join the running start, and
		// the memo clears on settle (success or failure) so the next ensure
		// starts fresh — the legacy startPromise.finally reset.
		const [startCached, invalidateStart] = yield* Effect.cachedInvalidateWithTTL(ensureStartedBody, Duration.infinity)
		const ensureStarted: Effect.Effect<void, unknown> = Effect.tapBoth(startCached, {
			onFailure: () => invalidateStart,
			onSuccess: () => invalidateStart,
		})
		const connectContext: ConnectContext = { options, transportCell, ensureStarted }

		// Kept on success, cleared when the transport has no command
		// connection after settle — the legacy connectionPromise.finally
		// reset. Concurrent callers join the in-flight connect.
		const [connectionCached, invalidateConnection] = yield* Effect.cachedInvalidateWithTTL(
			connectWithRetry(connectContext),
			Duration.infinity,
		)
		const ensureConnection: Effect.Effect<ConnectionTransport, ConnectionError | unknown> = Effect.flatMap(
			SynchronizedRef.get(transportCell),
			(transport) =>
				Effect.flatMap(
					Effect.sync(() => transport.hasCommandConnection()),
					(connected) =>
						connected ? Effect.succeed(transport) : Effect.tapError(connectionCached, () => invalidateConnection),
				),
		)

		const runCommand = (command: string): Effect.Effect<string, ConnectionError | CommandFailedError | unknown> =>
			Effect.gen(function* () {
				const ensured = yield* Ref.make(false)
				const staleHandled = yield* Ref.make(false)
				// Every pass re-acquires: the first pass takes the
				// ensureConnection fast path (already connected), while the
				// retry re-acquires after invalidation (reconnect) — matching
				// the legacy ensure / close+clear / re-ensure sequence.
				const program = Effect.flatMap(ensureConnection, (acquired) =>
					Effect.zipRight(Ref.set(ensured, true), runOnRuntime(acquired, command)).pipe(
						Effect.tapError(() =>
							Effect.flatMap(Ref.getAndSet(staleHandled, true), (already) =>
								already ? Effect.void : Effect.zipRight(closeStaleConnection(options, acquired), invalidateConnection),
							),
						),
					),
				)
				return yield* Effect.retry(program, makeStaleRetrySchedule(ensured))
			})

		const discoverPath = (
			command: string,
			errorMessage: string,
		): Effect.Effect<string, ConnectionError | CommandFailedError | DiscoveryError | unknown> =>
			Effect.flatMap(runCommand(command), (output) => {
				const lines = output
					.split(/\r?\n/)
					.map((line) => line.trim())
					.filter(Boolean)
				const discoveredPath = lines.length > 0 ? lines[lines.length - 1] : ""
				return !discoveredPath || discoveredPath === "None"
					? Effect.fail(new DiscoveryError({ message: errorMessage }))
					: Effect.succeed(discoveredPath)
			})

		const shutdown: Effect.Effect<void> = Effect.gen(function* () {
			const transport = yield* SynchronizedRef.get(transportCell)
			yield* invalidateStart
			yield* invalidateConnection
			yield* Effect.catchAll(
				Effect.sync(() => {
					if (transport.hasCommandConnection()) {
						transport.closeCommandConnection()
					}
				}),
				(error) => logEffect(options, "Failed to close Unreal command connection during shutdown:", error),
			)
			yield* Effect.catchAll(
				Effect.sync(() => {
					transport.stop()
				}),
				(error) => logEffect(options, "Failed to stop Unreal Remote Execution during shutdown:", error),
			)
		})

		return { runCommand, discoverPath, shutdown }
	})

// Singleton-ready Layer: the module-level shared service in
// remote-execution.ts is built from this layer.
export const makeConnectionSessionLayer = (options: ConnectionSessionOptions): Layer.Layer<ConnectionSessionService> =>
	Layer.effect(ConnectionSessionService, makeConnectionSessionService(options))

// Boundary runner: Effect.runPromise rejects with FiberFailure, but the
// legacy API rejects with the raw thrown value (scenarios assert
// `thrown === lastError`). runPromiseExit + Cause.squash preserves the
// exact rejection identity for Fail values (and surfaces defects raw,
// as a plain throw would).
export const runCompatPromise = <A>(effect: Effect.Effect<A, unknown>): Promise<A> =>
	Effect.runPromiseExit(effect).then((exit) => {
		if (Exit.isSuccess(exit)) {
			return exit.value
		}
		throw Cause.squash(exit.cause)
	})

// Boundary unwrap: the Promise-typed shims (class methods, singleton
// shims) speak legacy plain Errors. ConnectionError unwraps to its cause
// (preserving rejection identity for connect failures); command/discovery
// failures re-render the exact legacy messages.
export const withCompatErrors = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<A, unknown> =>
	Effect.catchAll(effect, (error) => {
		if (error instanceof ConnectionError) {
			return Effect.fail(error.cause)
		}
		if (error instanceof CommandFailedError) {
			return Effect.fail(new Error(`Command failed with: ${error.result}`))
		}
		if (error instanceof DiscoveryError) {
			return Effect.fail(new Error(error.message))
		}
		return Effect.fail(error)
	})
