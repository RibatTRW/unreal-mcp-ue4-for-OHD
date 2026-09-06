// Effect migration — Zod → effect/Schema pattern catalog (report §4.1).
//
// Canonical mapping, applied mechanically from Phase 4 on. Uses the `effect`
// package `effect/Schema` namespace (v3) — never the legacy `@effect/schema`
// package. Every row is exercised by scripts/check-schema-parity.mjs; the
// client-visible surface it protects is locked by
// scripts/__snapshots__/list-tools.snapshot.json.
//
// Row-by-row mapping:
//   z.object(s).strict()  → Schema.Struct(fields) decoded with
//                            strictDecodeOptions ({ onExcessProperty: "error" }).
//                            Structs strip unknown keys by default, so the
//                            option — not the Struct itself — carries the
//                            `.strict()` rejection. See strictDecodeSync.
//   z.enum([...])         → Schema.Literal(...values)
//   z.literal(v)          → Schema.Literal(v)
//   z.union([...])        → Schema.Union(...members)
//   s.optional()          → Schema.optional(s) for struct fields;
//                            Schema.UndefinedOr(s) for standalone values
//                            — see OPTIONAL NOTE below
//   z.record(z.any())     → Schema.Record({ key: Schema.String,
//                                            value: Schema.Unknown })
//   z.array(z.string()     → Schema.NonEmptyArray(
//     .min(1)).min(1)         Schema.String.pipe(Schema.minLength(1)))
//   requireAtLeastOneValue → atLeastOneValue() — Schema.filter with a
//     (superRefine+custom)    `message` annotation; verbatim user-facing text.
//   requireValueGroups /    → valueGroups() — reduce over atLeastOneValue,
//     nested composition      preserving EVERY group's message verbatim.
//   .describe(text)        → Schema.annotations({ description: text })
//   safeParseAsync fail    → invalidParamsMessage(tool, action, detail):
//     (`Invalid params         `Invalid params for ${tool}.${action}: ...`.
//     for t.a: ...`)          ParseError text comes from parseErrorText()
//                            (TreeFormatter); Effect tree formatting never
//                            leaks to clients verbatim — it is normalized
//                            behind this prefix.
//
// OPTIONAL NOTE: `Schema.optional` is a struct-field constructor — used
// top-level it is not directly decodable (probe: "parser is not a function").
// For struct fields always use `Schema.optional(field)` inside `Schema.Struct`;
// for a standalone value whose Zod source is a bare `.optional()` outside an
// object, use `Schema.UndefinedOr(s)`. The parity harness pins both.
//
// SDK BOUNDARY (report §4.4): the MCP SDK accepts ONLY Zod at the
// registerTool call-site (it throws otherwise), so Zod inputSchema objects
// stay frozen at that line permanently. Everything behind it — validation,
// handlers, dispatch — migrates to these Schema forms. Zod is therefore a
// permanent (small) dependency, not a migration leftover.

import { Schema } from "effect"
import { TreeFormatter, isParseError } from "effect/ParseResult"

// Decode options that reproduce `z.object(...).strict()` rejection of
// excess properties. Pass on every decode of a migrated Struct.
export const strictDecodeOptions = {
	onExcessProperty: "error",
	errors: "all",
} as const

// Strict equivalent of `schema.safeParseAsync(params)` for migrated
// Struct schemas: unknown keys are parse ERRORS, not stripped keys.
export const strictDecodeSync = <A, I>(schema: Schema.Schema<A, I, never>, input: unknown): A =>
	Schema.decodeUnknownSync(schema, {
		errors: strictDecodeOptions.errors,
		onExcessProperty: strictDecodeOptions.onExcessProperty,
	})(input)

// Mirrors hasMeaningfulValue in
// server/namespace-action-schema-fragments.ts: non-empty trimmed strings,
// arrays containing at least one meaningful entry, otherwise non-nullish.
export const hasMeaningfulValue = (value: unknown): boolean => {
	if (typeof value === "string") {
		return value.trim().length > 0
	}

	if (Array.isArray(value)) {
		return value.some((entry) => hasMeaningfulValue(entry))
	}

	return value !== undefined && value !== null
}

// Replacement for requireAtLeastOneValue(schema, keys, message): the custom
// message is preserved verbatim via the filter `message` annotation.
export const atLeastOneValue = <A, I, R>(
	schema: Schema.Schema<A, I, R>,
	keys: ReadonlyArray<string>,
	message: string,
): Schema.filter<Schema.Schema<A, I, R>> =>
	schema.pipe(
		Schema.filter(
			(value) => {
				const record = (value ?? {}) as Record<string, unknown>
				return keys.some((key) => hasMeaningfulValue(record[key]))
			},
			{ message: () => message },
		),
	)

export interface ValueGroup {
	readonly keys: ReadonlyArray<string>
	readonly message: string
}

// Replacement for requireValueGroups(schema, groups) — including nested
// composition (e.g. register-content-asset-namespaces.ts asset-mutation
// schema). This MUST be a single filter, not stacked filters: stacked filters
// short-circuit on the innermost failure, so only the first missing group's
// message would survive, while Zod's superRefine collects every group's
// issue. The predicate returns `true` when all groups pass, otherwise the
// space-joined verbatim messages of the failing groups (a string return
// becomes the filter message), so EVERY user-facing message is preserved.
export const valueGroups = <A, I, R>(
	schema: Schema.Schema<A, I, R>,
	groups: ReadonlyArray<ValueGroup>,
): Schema.filter<Schema.Schema<A, I, R>> =>
	schema.pipe(
		Schema.filter((value) => {
			const record = (value ?? {}) as Record<string, unknown>
			const missing = groups.filter((group) => !group.keys.some((key) => hasMeaningfulValue(record[key])))
			return missing.length === 0 ? true : missing.map((group) => group.message).join(" ")
		}),
	)

// Renders an Effect ParseError to the single detail string embedded in the
// invalid-params envelope. Keeps Effect tree formatting internal: callers
// embed the result via invalidParamsMessage, never raw.
export const parseErrorText = (error: unknown): string => {
	if (isParseError(error)) {
		return TreeFormatter.formatErrorSync(error)
	}

	return error instanceof Error ? error.message : String(error)
}

// Exact envelope-message prefix built today in
// server/registration-context-dispatch.ts validateNamespaceParams:
// `Invalid params for ${name}.${action}: ${zodError.message}`.
export const invalidParamsMessage = (tool: string, action: string, detail: string): string =>
	`Invalid params for ${tool}.${action}: ${detail}`

// Zod's `${keys[0]} is required` from requiredStringParam /
// requiredStringListParam (registration-context-params.ts:56,98). Handler
// code migrated to MissingParamError renders through this so the
// user-visible text never changes.
export const missingParamMessage = (key: string): string => `${key} is required`
