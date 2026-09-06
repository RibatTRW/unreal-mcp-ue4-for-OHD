import { editorPreludes, getDomainDispatchHarness } from "./prelude-loader.js"
import { type EncodedArg, jsonArg as encodeJsonArg, renderEditorScript } from "./script-renderer.js"

export { editorPreludes }
export type { EncodedArg }

export const jsonArg = encodeJsonArg

// Phase 3 (report §4.5): the dispatch harness used to load at import time;
// it now loads once via the memoized prelude service accessor, keeping this
// module a thin pair of pure string -> string wrappers.
export function renderScript(filePath: string, vars: Record<string, EncodedArg>, extraPrelude = "") {
	return renderEditorScript(filePath, vars, { extraPrelude })
}

export function renderDomainScript(filePath: string, vars: Record<string, EncodedArg>, extraPrelude = "") {
	return renderEditorScript(filePath, vars, {
		extraPrelude: [getDomainDispatchHarness(), extraPrelude].filter(Boolean).join("\n\n"),
	})
}
