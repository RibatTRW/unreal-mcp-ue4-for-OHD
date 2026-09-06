// Effect migration — Phase 1 error channel, codified in Phase 0.
//
// Typed replacement for every `throw` site in server/ (see mapping below).
// Phase 0 only declares the channel; no caller uses it yet, so runtime
// behavior is unchanged. Phase 1 wires producers, Phase 4 renders these into
// the identical `{success:false, tool, action, message}` envelope in dispatch.
//
// Throw-site sources (report §4.2):
//   ConnectionError    connection-session.ts:121,192,209 (connect/command)
//   DiscoveryError     connection-session.ts:225 (discoverPath empty/"None")
//   MissingParamError  registration-context-params.ts:56,98 (required*Param)
//   RenderError        script-renderer.ts:32 (missing template args)
//   PreludeError       prelude-loader.ts:75,84,88 (manifest mismatch)
//   CommandFailedError remote command failures surfaced via tryRunCommand
//
// Interop note: the dispatch `catch` becomes `Effect.catchAll` over this
// union. Source-control/blueprint degraded paths that return `success:false`
// *payloads* (tool-support.ts) stay payloads — they never enter this channel.

import { Data } from "effect"

export class ConnectionError extends Data.TaggedError("ConnectionError")<{
	readonly cause: unknown
	readonly attempt: number
}> {}

export class CommandFailedError extends Data.TaggedError("CommandFailedError")<{
	readonly result: unknown
}> {}

export class DiscoveryError extends Data.TaggedError("DiscoveryError")<{
	readonly message: string
}> {}

export class MissingParamError extends Data.TaggedError("MissingParamError")<{
	readonly key: string
}> {}

export class RenderError extends Data.TaggedError("RenderError")<{
	readonly file: string
	readonly detail: string
}> {}

export class PreludeError extends Data.TaggedError("PreludeError")<{
	readonly detail: string
}> {}

export type ToolError =
	| ConnectionError
	| CommandFailedError
	| DiscoveryError
	| MissingParamError
	| RenderError
	| PreludeError
