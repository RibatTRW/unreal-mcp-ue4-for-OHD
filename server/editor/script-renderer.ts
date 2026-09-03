import { Template } from "../utils.js"
import { editorPreludes, readEditorScript } from "./prelude-loader.js"

/**
 * A base64(JSON) argument blob produced by {@link jsonArg}. The brand keeps
 * raw strings out of `renderScript` and `renderEditorScript`: every value
 * crossing the TS → Python seam must go through the one codec, so bypasses
 * fail typecheck instead of detonating inside the editor.
 */
declare const encodedArgBrand: unique symbol
export type EncodedArg = string & { readonly [encodedArgBrand]: true }

function readWithPrelude(filePath: string, extraPrelude = ""): string {
	return [editorPreludes.compat, extraPrelude, readEditorScript(filePath)].filter(Boolean).join("\n\n")
}

export function renderEditorScript(
	filePath: string,
	vars: Record<string, EncodedArg>,
	options: { extraPrelude?: string } = {},
) {
	return Template(readWithPrelude(filePath, options.extraPrelude), vars)
}

export function jsonArg(value: unknown): EncodedArg {
	return Buffer.from(JSON.stringify(value === undefined ? null : value), "utf8").toString("base64") as EncodedArg
}
