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

function substituteTemplateArgs(
	filePath: string,
	source: string,
	vars: Record<string, EncodedArg>,
): string {
	const missing = new Set<string>()
	const rendered = source.replace(templateTokenPattern, (token, name: string) => {
		if (!Object.prototype.hasOwnProperty.call(vars, name)) {
			missing.add(name)
			return token
		}
		return vars[name]
	})
	if (missing.size > 0) {
		throw new Error(`Missing template arg(s) ${[...missing].join(", ")} for ${filePath}`)
	}
	return rendered
}

function readWithPrelude(filePath: string, extraPrelude = ""): string {
	return [editorPreludes.textCodec, editorPreludes.objectAccess, editorPreludes.assetResolution, editorPreludes.widgetTree, extraPrelude, readEditorScript(filePath)].filter(Boolean).join("\n\n")
}

export function renderEditorScript(
	filePath: string,
	vars: Record<string, EncodedArg>,
	options: { extraPrelude?: string } = {},
) {
	return substituteTemplateArgs(filePath, readWithPrelude(filePath, options.extraPrelude), vars)
}

export function jsonArg(value: unknown): EncodedArg {
	return Buffer.from(JSON.stringify(value === undefined ? null : value), "utf8").toString("base64") as EncodedArg
}
