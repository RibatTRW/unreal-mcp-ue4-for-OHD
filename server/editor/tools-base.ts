import { editorPreludes, getDomainDispatchHarness } from "./prelude-loader.js"
import { type EncodedArg, jsonArg as encodeJsonArg, renderEditorScript } from "./script-renderer.js"

export { editorPreludes }
export type { EncodedArg }

export const jsonArg = encodeJsonArg

// Phase 3 (report §4.5): the dispatch harness used to load at import time;
// it now loads once via the memoized prelude service accessor, keeping this
// module a thin pair of pure string -> string wrappers.
// SHIP-S1: both wrappers accept one option flag, cacheable, which switches
// the render from PRELUDE + TAIL to SHIM(hash) + TAIL behind the same seam.
// Callers in tools-domain.ts / tools-direct.ts are unchanged (the flag
// defaults off, so default renders stay byte-identical); the cold-cache
// registering variant lives one layer down on renderEditorScript.
export interface RenderScriptOptions {
	readonly cacheable?: boolean
	readonly registerCache?: boolean
}

export function renderScript(
	filePath: string,
	vars: Record<string, EncodedArg>,
	extraPrelude = "",
	options: RenderScriptOptions = {},
) {
	return renderEditorScript(filePath, vars, {
		extraPrelude,
		cacheable: options.cacheable,
		registerCache: options.registerCache,
	})
}

export function renderDomainScript(
	filePath: string,
	vars: Record<string, EncodedArg>,
	extraPrelude = "",
	options: RenderScriptOptions = {},
) {
	return renderEditorScript(filePath, vars, {
		extraPrelude: [getDomainDispatchHarness(), extraPrelude].filter(Boolean).join("\n\n"),
		cacheable: options.cacheable,
		registerCache: options.registerCache,
	})
}
