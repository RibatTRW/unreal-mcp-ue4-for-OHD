import { RenderError } from "../effect/errors.js"
import { hashPreludeContent, renderCacheRegistration, renderCacheShim } from "./prelude-cache.js"
import { editorPreludes, readEditorScript } from "./prelude-loader.js"

/**
 * A base64(JSON) argument blob produced by {@link jsonArg}. The brand keeps
 * raw strings out of `renderScript` and `renderEditorScript`: every value
 * crossing the TS → Python seam must go through the one codec, so bypasses
 * fail typecheck instead of detonating inside the editor.
 */
declare const encodedArgBrand: unique symbol
export type EncodedArg = string & { readonly [encodedArgBrand]: true }

/**
 * Literal `${name}` tokens over bare identifiers. Every payload uses bare
 * identifiers only, so substitution needs no evaluation — and gets none.
 * Single replace pass: `String.replace` manages the global pattern's state
 * itself, and missing names are collected (not fail-fast) so one error
 * lists them all. Presence uses an own-property check so tokens matching
 * inherited member names still throw instead of stringifying them.
 */
const templateTokenPattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g

function substituteTemplateArgs(filePath: string, source: string, vars: Record<string, EncodedArg>): string {
	const missing = new Set<string>()
	const rendered = source.replace(templateTokenPattern, (token, name: string) => {
		if (!Object.prototype.hasOwnProperty.call(vars, name)) {
			missing.add(name)
			return token
		}
		return vars[name]
	})
	if (missing.size > 0) {
		const detail = `Missing template arg(s) ${[...missing].join(", ")} for ${filePath}`
		// Phase 3 (report §4.2, §4.5): the missing-arg throw is a RenderError,
		// still thrown synchronously so renderEditorScript stays a pure
		// string -> string function with no Effect in its signature.
		// Data.TaggedError defaults .message to "", so it is aligned onto
		// detail — the codec harness and legacy catch sites keep reading the
		// exact legacy text naming the file and the missing arg(s).
		const error = new RenderError({ file: filePath, detail })
		error.message = detail
		throw error
	}
	return rendered
}

function renderStaticPrefix(extraPrelude = ""): string {
	return [
		editorPreludes.textCodec,
		editorPreludes.objectAccess,
		editorPreludes.assetResolution,
		editorPreludes.widgetTree,
		extraPrelude,
	]
		.filter(Boolean)
		.join("\n\n")
}

function joinSections(head: string, tail: string): string {
	return [head, tail].filter(Boolean).join("\n\n")
}

function readWithPrelude(filePath: string, extraPrelude = ""): string {
	return joinSections(renderStaticPrefix(extraPrelude), readEditorScript(filePath))
}

export interface RenderEditorScriptOptions {
	readonly extraPrelude?: string
	// SHIP-S1: emit SHIM(hash) + TAIL instead of PRELUDE + TAIL. The
	// editor runs the tail against its cached prelude namespace on a
	// hit, or prints rrmcp:cache-miss (without running the tail) on a
	// miss for the TS fallback to resend the full prelude once.
	readonly cacheable?: boolean
	// SHIP-S1: append the registration trailer so a cold editor stores
	// the exec'd namespace under the prefix hash. Mutually exclusive
	// with cacheable; the default path (both false) is byte-identical
	// to the pre-S1 render.
	readonly registerCache?: boolean
}

export function renderEditorScript(
	filePath: string,
	vars: Record<string, EncodedArg>,
	options: RenderEditorScriptOptions = {},
) {
	const { extraPrelude = "", cacheable = false, registerCache = false } = options
	if (cacheable && registerCache) {
		const detail = `Conflicting cache options for ${filePath}: cacheable and registerCache are mutually exclusive`
		const error = new RenderError({ file: filePath, detail })
		error.message = detail
		throw error
	}
	if (cacheable) {
		const prefix = renderStaticPrefix(extraPrelude)
		const tail = substituteTemplateArgs(filePath, readEditorScript(filePath), vars)
		return joinSections(renderCacheShim(hashPreludeContent(prefix)), tail)
	}
	const full = substituteTemplateArgs(filePath, readWithPrelude(filePath, extraPrelude), vars)
	if (registerCache) {
		const hash = hashPreludeContent(renderStaticPrefix(extraPrelude))
		return joinSections(full, renderCacheRegistration(hash))
	}
	return full
}

export function jsonArg(value: unknown): EncodedArg {
	return Buffer.from(JSON.stringify(value === undefined ? null : value), "utf8").toString("base64") as EncodedArg
}
