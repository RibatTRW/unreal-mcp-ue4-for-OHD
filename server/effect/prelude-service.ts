// Effect migration — Phase 3 renderer purity (report §4.5, §5).
//
// PreludeService moves the prelude-loader.ts import-time reads behind a
// memoized Layer: the ~50 .py prelude files plus the domain dispatch
// harness load once (per process, via the module memo cells in
// prelude-loader.ts that this Layer builds on — Layer memoization stacks
// on top, so repeated builds still read nothing twice), with byte-identical
// key ordering and join semantics.
//
// Pure string -> string builders (script-renderer.ts, tools-base.ts,
// tools-direct.ts, tools-domain.ts) keep their signatures and stay
// Effect-free: they share the same memo cells through the sync accessors.
// Effect callers use this service (or the per-file effects below). Phase 6
// will provide PreludeServiceLive once at startup in the composition root;
// until then the cells guarantee at-most-once loading either way.

import { Context, Effect, Layer } from "effect"

import {
	type EditorPreludes,
	buildOrderedPrelude,
	getDomainDispatchHarness,
	getEditorPreludes,
	readEditorScript,
} from "../editor/prelude-loader.js"
import { PreludeError } from "./errors.js"

export interface PreludeServiceShape {
	readonly preludes: EditorPreludes
	readonly dispatchHarness: string
	readonly readScript: (filePath: string) => Effect.Effect<string, PreludeError>
	readonly buildPrelude: (relativeDir: string) => Effect.Effect<string, PreludeError>
}

export class PreludeService extends Context.Tag("PreludeService")<PreludeService, PreludeServiceShape>() {}

const failPrelude = (detail: string): PreludeError => {
	const error = new PreludeError({ detail })
	error.message = detail
	return error
}

const readScript = (filePath: string): Effect.Effect<string, PreludeError> =>
	Effect.try({
		try: () => readEditorScript(filePath),
		catch: (cause) =>
			failPrelude(`Cannot read editor script '${filePath}': ${cause instanceof Error ? cause.message : String(cause)}`),
	})

const buildPrelude = (relativeDir: string): Effect.Effect<string, PreludeError> =>
	Effect.try({
		try: () => buildOrderedPrelude(relativeDir),
		catch: (cause) =>
			cause instanceof PreludeError
				? cause
				: failPrelude(
						`Cannot load prelude package '${relativeDir}': ${cause instanceof Error ? cause.message : String(cause)}`,
					),
	})

export const makePreludeService = (): Effect.Effect<PreludeServiceShape, PreludeError> =>
	Effect.try({
		try: () => ({
			preludes: getEditorPreludes(),
			dispatchHarness: getDomainDispatchHarness(),
			readScript,
			buildPrelude,
		}),
		catch: (cause) =>
			cause instanceof PreludeError
				? cause
				: failPrelude(`Cannot load editor preludes: ${cause instanceof Error ? cause.message : String(cause)}`),
	})

// Singleton-ready Layer: build once at startup (Phase 6 composition root)
// and the memoized cells underneath make repeat builds free.
export const PreludeServiceLive: Layer.Layer<PreludeService, PreludeError> = Layer.effect(
	PreludeService,
	makePreludeService(),
)
