import { editorPreludes, readEditorScript } from "./prelude-loader.js"
import { type EncodedArg, jsonArg as encodeJsonArg, renderEditorScript } from "./script-renderer.js"

export { editorPreludes }
export type { EncodedArg }

export const jsonArg = encodeJsonArg

const domainDispatchHarness = readEditorScript("./scripts/ue_tools_dispatch.py")

export function renderScript(filePath: string, vars: Record<string, EncodedArg>, extraPrelude = "") {
	return renderEditorScript(filePath, vars, { extraPrelude })
}

export function renderDomainScript(filePath: string, vars: Record<string, EncodedArg>, extraPrelude = "") {
	return renderEditorScript(filePath, vars, {
		extraPrelude: [domainDispatchHarness, extraPrelude].filter(Boolean).join("\n\n"),
	})
}
