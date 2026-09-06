#!/usr/bin/env node

// Zod ↔ effect/Schema parity matrix (Effect migration report §4.1, §5 Phase 0).
// For every mapping row in the pattern catalog (server/effect/schema-patterns.ts)
// this harness asserts behavioral parity: the Zod form and the Schema form
// accept/reject the SAME inputs, with the SAME custom messages verbatim —
// including strict excess-property rejection and the invalid-params envelope
// prefix. Phase-4+ migrations must keep this green; any divergence fails.
//
// Runs against dist/ (like check-payload-codec.mjs): run `npm run build` first.
// The canonical Schema helpers come from dist/effect/ so this also proves the
// new target emits runnable Effect code.
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { Schema } from "effect"
import { z } from "zod"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const effectDistPath = path.join(repoRoot, "dist", "effect", "index.js")

if (!fs.existsSync(effectDistPath)) {
	console.error("check-schema-parity: dist/effect/ is missing — run `npm run build` first.")
	process.exit(2)
}

const require = createRequire(import.meta.url)
const patterns = require(effectDistPath)
const {
	atLeastOneValue,
	hasMeaningfulValue,
	invalidParamsMessage,
	missingParamMessage,
	parseErrorText,
	strictDecodeSync,
	valueGroups,
} = patterns

let checks = 0
const failures = []

const check = (label, condition, detail = "") => {
	checks += 1
	if (!condition) {
		failures.push(`${label}${detail ? ` — ${detail}` : ""}`)
	}
}

const zodFailsWith = async (schema, input) => {
	const result = await schema.safeParseAsync(input)
	return result.success ? null : result.error.message
}

const schemaFailsWith = (schema, input, strict = false) => {
	try {
		if (strict) {
			strictDecodeSync(schema, input)
		} else {
			Schema.decodeUnknownSync(schema)(input)
		}
		return null
	} catch (error) {
		return parseErrorText(error)
	}
}

// Both sides must agree on accept/reject for every probe input.
const parity = async (label, zodSchema, effectSchema, inputs, { strict = false } = {}) => {
	for (const input of inputs) {
		const zodError = await zodFailsWith(zodSchema, input)
		const effectError = schemaFailsWith(effectSchema, input, strict)
		const same = (zodError === null) === (effectError === null)
		check(`${label} accept/reject ${JSON.stringify(input)}`, same, `zod=${zodError} effect=${effectError}`)
	}
}

async function main() {
	// 1. strict object: excess keys rejected, clean input accepted.
	{
		const zodSchema = z.object({ a: z.string() }).strict()
		const effectSchema = Schema.Struct({ a: Schema.String })
		await parity("strict-object", zodSchema, effectSchema, [{ a: "x" }, { a: "x", extra: 1 }, {}], {
			strict: true,
		})
		// The option is load-bearing: default Effect decode STRIPS excess keys.
		const stripped = Schema.decodeUnknownSync(effectSchema)({ a: "x", extra: 1 })
		check("strict-object default decode strips excess", JSON.stringify(stripped) === '{"a":"x"}')
		// ...and default decode must NOT be used for migrated structs.
		check(
			"strict-object strict decode rejects excess",
			schemaFailsWith(effectSchema, { a: "x", extra: 1 }, true) !== null,
		)
	}
	await parity("enum", z.enum(["a", "b"]), Schema.Literal("a", "b"), ["a", "b", "c", 1, null])
	await parity("literal", z.literal("go"), Schema.Literal("go"), ["go", "stop", 1])

	// 3. union (vector2 object-or-tuple, the shared-schema shape).
	{
		const zodSchema = z.union([z.object({ x: z.number(), y: z.number() }), z.tuple([z.number(), z.number()])])
		const effectSchema = Schema.Union(
			Schema.Struct({ x: Schema.Number, y: Schema.Number }),
			Schema.Tuple(Schema.Number, Schema.Number),
		)
		await parity("union", zodSchema, effectSchema, [{ x: 1, y: 2 }, [1, 2], { x: 1 }, "nope", [1], null], {
			strict: true,
		})
	}

	// 4. optional: struct field and standalone.
	{
		await parity(
			"optional-field",
			z.object({ a: z.string().optional() }),
			Schema.Struct({ a: Schema.optional(Schema.String) }),
			[{}, { a: "x" }, { a: 1 }],
			{ strict: true },
		)
		const zodOpt = z.string().optional()
		const effectOpt = Schema.UndefinedOr(Schema.String)
		await parity("optional-standalone", zodOpt, effectOpt, [undefined, "x", 1])
	}

	// 5. record(z.any()): permissive by design (compactParamsSchema namespaces).
	{
		const zodSchema = z.record(z.any())
		const effectSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown })
		await parity("record", zodSchema, effectSchema, [{ action: "list" }, { nested: { deep: [1, 2] } }, {}, { n: null }])
	}

	// 6. stringList: z.array(z.string().min(1)).min(1).
	{
		const zodSchema = z.array(z.string().min(1)).min(1)
		const effectSchema = Schema.NonEmptyArray(Schema.String.pipe(Schema.minLength(1)))
		await parity("string-list", zodSchema, effectSchema, [["a"], ["a", "b"], [], [""], ["ok", ""], "nope", null])
	}

	// 7. requireAtLeastOneValue: verbatim message + meaningful-value semantics.
	{
		const message = "Provide asset_path, path, or name."
		const zodSchema = z
			.object({ asset_path: z.string().optional(), path: z.string().optional(), name: z.string().optional() })
			.strict()
			.superRefine((params, ctx) => {
				const record = params ?? {}
				const meaningful = (value) =>
					typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null
				if (["asset_path", "path", "name"].some((key) => meaningful(record[key]))) {
					return
				}
				ctx.addIssue({ code: z.ZodIssueCode.custom, message })
			})
		const effectSchema = atLeastOneValue(
			Schema.Struct({
				asset_path: Schema.optional(Schema.String),
				path: Schema.optional(Schema.String),
				name: Schema.optional(Schema.String),
			}),
			["asset_path", "path", "name"],
			message,
		)
		const inputs = [{}, { name: "" }, { name: "  " }, { name: "x" }, { path: "p" }]
		// Excess keys reject on BOTH sides (strictness parity) but the failure is
		// the strictness issue, not the custom message — checked separately.
		await parity("at-least-one strict", zodSchema, effectSchema, [{ asset_path: "a", extra: 0 }], {
			strict: true,
		})
		for (const input of inputs) {
			const zodError = await zodFailsWith(zodSchema, input)
			const effectError = schemaFailsWith(effectSchema, input, true)
			const same = (zodError === null) === (effectError === null)
			check(`at-least-one accept/reject ${JSON.stringify(input)}`, same, `zod=${zodError} effect=${effectError}`)
			if (zodError !== null && effectError !== null) {
				check(
					`at-least-one verbatim message ${JSON.stringify(input)}`,
					zodError.includes(message) && effectError.includes(message),
					`zod=${zodError} effect=${effectError}`,
				)
			}
		}
		// hasMeaningfulValue parity incl. array nesting (fragments.ts semantics).
		for (const [value, expected] of [
			["x", true],
			["  ", false],
			["", false],
			[["", "ok"], true],
			[[], false],
			[["  "], false],
			[undefined, false],
			[null, false],
			[0, true],
		]) {
			check(`hasMeaningfulValue ${JSON.stringify(value)}`, hasMeaningfulValue(value) === expected)
		}
	}

	// 8. requireValueGroups / nested composition: EVERY message survives.
	{
		const g1 = { keys: ["a", "b"], message: "Provide a or b." }
		const g2 = { keys: ["c"], message: "Provide c." }
		const baseShape = { a: z.string().optional(), b: z.string().optional(), c: z.string().optional() }
		const refineOnce = (schema, group) =>
			schema.superRefine((params, ctx) => {
				const record = params ?? {}
				if (group.keys.some((key) => hasMeaningfulValue(record[key]))) {
					return
				}
				ctx.addIssue({ code: z.ZodIssueCode.custom, message: group.message })
			})
		const zodSchema = refineOnce(refineOnce(z.object(baseShape).strict(), g1), g2)
		const effectSchema = valueGroups(
			Schema.Struct({
				a: Schema.optional(Schema.String),
				b: Schema.optional(Schema.String),
				c: Schema.optional(Schema.String),
			}),
			[g1, g2],
		)
		const bothMissing = {}
		const zodBoth = await zodFailsWith(zodSchema, bothMissing)
		const effectBoth = schemaFailsWith(effectSchema, bothMissing, true)
		check("value-groups both missing rejected by zod", zodBoth !== null)
		check("value-groups both missing rejected by effect", effectBoth !== null)
		for (const message of [g1.message, g2.message]) {
			check(`value-groups zod keeps "${message}"`, zodBoth?.includes(message) ?? false, zodBoth ?? "")
			check(`value-groups effect keeps "${message}"`, effectBoth?.includes(message) ?? false, effectBoth ?? "")
		}
		// Satisfying one group still fails on the other, on both sides.
		const oneMissing = { a: "x" }
		const zodOne = await zodFailsWith(zodSchema, oneMissing)
		const effectOne = schemaFailsWith(effectSchema, oneMissing, true)
		check(
			"value-groups partial keeps other message",
			zodOne?.includes(g2.message) === true && effectOne?.includes(g2.message) === true,
			`zod=${zodOne} effect=${effectOne}`,
		)
		await parity("value-groups satisfied", zodSchema, effectSchema, [{ a: "x", c: "y" }], { strict: true })
	}

	// 9. describe → annotations: descriptions flow into JSON Schema.
	{
		const zodDescribed = z.string().describe("Optional actor label prefix")
		check("describe sets zod description", zodDescribed.description === "Optional actor label prefix")
		const { make } = require("effect/JSONSchema")
		const effectDescribed = Schema.String.pipe(Schema.annotations({ description: "Optional actor label prefix" }))
		const jsonSchema = make(effectDescribed)
		check(
			"annotations flow to JSON Schema",
			jsonSchema.description === "Optional actor label prefix",
			JSON.stringify(jsonSchema),
		)
	}

	// 10. invalid-params envelope: identical prefix on both sides.
	{
		const tool = "manage_asset"
		const action = "rename"
		const zodError = await zodFailsWith(z.object({ target: z.string() }).strict(), {})
		check("envelope zod side fails", zodError !== null)
		const zodEnvelope = invalidParamsMessage(tool, action, zodError ?? "")
		check("envelope zod prefix", zodEnvelope.startsWith(`Invalid params for ${tool}.${action}: `), zodEnvelope)
		let effectDetail = ""
		try {
			strictDecodeSync(Schema.Struct({ target: Schema.String }), {})
		} catch (error) {
			effectDetail = parseErrorText(error)
		}
		check("envelope effect detail non-empty", effectDetail.length > 0, effectDetail)
		const effectEnvelope = invalidParamsMessage(tool, action, effectDetail)
		check("envelope effect prefix", effectEnvelope.startsWith(`Invalid params for ${tool}.${action}: `), effectEnvelope)
		// parseErrorText never throws on foreign input.
		check("parseErrorText foreign error", parseErrorText(new Error("boom")) === "boom")
		check("parseErrorText foreign value", parseErrorText("plain") === "plain")
		// requiredStringParam messages flow through missingParamMessage.
		check("missing-param message", missingParamMessage("blueprint_name") === "blueprint_name is required")
	}

	if (failures.length > 0) {
		console.error(`check-schema-parity: FAIL (${failures.length}/${checks} checks):`)
		for (const failure of failures) {
			console.error(`  - ${failure}`)
		}
		process.exit(1)
	}

	console.log(`[PASS] check-schema-parity: zod/schema parity matrix (${checks} checks)`)
}

main().catch((error) => {
	console.error(`check-schema-parity: runner crashed: ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
