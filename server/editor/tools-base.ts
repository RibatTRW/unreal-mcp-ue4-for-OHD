import { editorPreludes } from "./prelude-loader.js"
import { jsonArg as encodeJsonArg, renderEditorScript, type EncodedArg } from "./script-renderer.js"

export { editorPreludes }
export type { EncodedArg }

export const jsonArg = encodeJsonArg

export function renderScript(
	filePath: string,
	vars: Record<string, EncodedArg>,
	extraPrelude = "",
) {
	return renderEditorScript(filePath, vars, { extraPrelude })
}
