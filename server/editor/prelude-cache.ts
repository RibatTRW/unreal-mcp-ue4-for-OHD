import { createHash } from "node:crypto"
import { Effect } from "effect"

import { RenderError } from "../effect/errors.js"
import { readEditorScript } from "./prelude-loader.js"

// SHIP-S1 editor-side prelude cache: TS-side half of the protocol.
//
// The editor holds a content-hash-keyed store of exec'd prelude
// namespaces in its session (`sys.modules["rrmcp_preludes"]`, written by
// ue_prelude_cache_register.py, guarded by ue_prelude_cache_shim.py).
// This module owns the TS side: hashing the static prefix, stamping the
// two snippet templates, detecting the miss marker, and the exactly-once
// full-prelude resend. Everything here is a pure sync string -> string
// helper plus one generic Effect combinator — no dispatch, validation,
// transport, or listTools-surface involvement.
//
// Wire shapes (built by script-renderer.ts, never here):
//   default    PRELUDE + TAIL                    (byte-identical to today)
//   cached     SHIM(hash) + TAIL                 (warm path, no prelude)
//   registering PRELUDE + TAIL + REGISTER(hash)  (cold path, stores entry)

export const PRELUDE_CACHE_VERSION = 1
export const PRELUDE_CACHE_MISS_MARKER = "rrmcp:cache-miss"

const HASH_PLACEHOLDER = "__RRMCP_PRELUDE_HASH__"
const HASH_PATTERN = "[0-9a-f]{40}"

// sha1 of the exact static prefix a full render would ship (common
// preludes + extraPrelude joined with the same "\n\n" seam). Content
// addressing doubles as the staleness guard: any prelude edit re-hashes,
// so a stale entry can never match — it misses instead.
export function hashPreludeContent(staticPrefix: string): string {
	return createHash("sha1").update(staticPrefix, "utf8").digest("hex")
}

// Memoized-once template cells, same pattern as prelude-loader.ts: no
// filesystem reads at import time, one read per process afterwards.
// scripts/build.mjs copies server/editor/scripts into dist/editor/scripts,
// so the relative reads resolve identically under tsx and built dist.
let memoizedShim: string | undefined
let memoizedRegister: string | undefined

export function getPreludeCacheShimTemplate(): string {
	if (memoizedShim === undefined) {
		memoizedShim = readEditorScript("./scripts/ue_prelude_cache_shim.py")
	}
	return memoizedShim
}

export function getPreludeCacheRegisterTemplate(): string {
	if (memoizedRegister === undefined) {
		memoizedRegister = readEditorScript("./scripts/ue_prelude_cache_register.py")
	}
	return memoizedRegister
}

function stampTemplate(template: string, file: string, hash: string): string {
	if (!template.includes(HASH_PLACEHOLDER)) {
		const detail = `Prelude cache template ${file} is missing its ${HASH_PLACEHOLDER} placeholder`
		const error = new RenderError({ file, detail })
		error.message = detail
		throw error
	}
	return template.split(HASH_PLACEHOLDER).join(hash)
}

export function renderCacheShim(hash: string): string {
	return stampTemplate(getPreludeCacheShimTemplate(), "./scripts/ue_prelude_cache_shim.py", hash)
}

export function renderCacheRegistration(hash: string): string {
	return stampTemplate(getPreludeCacheRegisterTemplate(), "./scripts/ue_prelude_cache_register.py", hash)
}

export interface CachedScriptParts {
	readonly hash: string
	readonly tail: string
}

// Inverse of the cached render for harness use (codec checks, byte
// assertions): recovers the hash from the shim's miss marker, re-renders
// the expected shim, and splits the substituted action tail back off.
// Throws RenderError when the payload is not a cached render — a corrupt
// or default-path payload must fail loudly, never parse as a hit.
export function splitCachedScript(rendered: string): CachedScriptParts {
	const file = "<cached-script>"
	const match = new RegExp(`${PRELUDE_CACHE_MISS_MARKER}:(${HASH_PATTERN})`).exec(rendered)
	if (!match) {
		const detail = "Cached script has no rrmcp:cache-miss marker with a content hash"
		const error = new RenderError({ file, detail })
		error.message = detail
		throw error
	}
	const hash = match[1]
	const shim = renderCacheShim(hash)
	if (!rendered.startsWith(shim)) {
		const detail = `Cached script does not start with the shim stamped for hash ${hash}`
		const error = new RenderError({ file, detail })
		error.message = detail
		throw error
	}
	const tail = rendered.slice(shim.length).replace(/^\n\n/, "")
	return { hash, tail }
}

// Miss detection over joined command output. The shim prints exactly one
// `rrmcp:cache-miss:<hash>` line and never runs the tail, so any line
// carrying the marker means the editor needs the full prelude once.
// Without a hash argument any marker matches; with one, only that entry.
export function isPreludeCacheMiss(output: string, hash?: string): boolean {
	const needle = hash ? `${PRELUDE_CACHE_MISS_MARKER}:${hash}` : PRELUDE_CACHE_MISS_MARKER
	return output.split(/\r?\n/).some((line) => line.includes(needle))
}

// Cold-cache fallback: run the cached (tail-only) payload; on the miss
// marker — and only then — resend once with the full registering payload
// and return whatever it yields. Generic over the failure channel so it
// composes with ConnectionSessionService.runCommand without touching the
// service, dispatch, or envelope code: a clean output returns after one
// send, a miss costs exactly one resend, and non-miss failures surface
// untouched with no extra send.
export const runWithPreludeCacheFallback = <E>(
	runCommand: (command: string) => Effect.Effect<string, E>,
	cachedPayload: string,
	fullPayload: string,
): Effect.Effect<string, E> =>
	Effect.flatMap(runCommand(cachedPayload), (output) =>
		isPreludeCacheMiss(output) ? runCommand(fullPayload) : Effect.succeed(output),
	)
