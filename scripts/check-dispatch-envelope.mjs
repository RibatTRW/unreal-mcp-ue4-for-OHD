#!/usr/bin/env node

// Phase-4 envelope-message snapshot (Effect migration report §4.2, §5 Phase 4).
// Locks the user-facing `{success:false, tool, action, message}` envelopes
// byte-identical across the dispatch migration to Effect:
//   Part A (live surface): boots the real server over stdio and snapshots
//     the full invalid-params + handler-throw envelopes.
//   Part B (dispatch unit): imports dist/registration-context-dispatch.js
//     directly with stubbed SDK registration and asserts envelope shape,
//     the exact `Invalid params for <tool>.<action>: ` prefix, excess-prop
//     rejection, verbatim custom messages, and identical handler-throw
//     rendering for sync throws, async rejections, and Effect failures.
//     The Effect/Schema sections cover the Phase-4 migrated paths.
//
// Usage:
//   node scripts/check-dispatch-envelope.mjs            # compare against snapshot
//   node scripts/check-dispatch-envelope.mjs --update   # regenerate snapshot
//
// Runs against dist/ (like check-schema-parity.mjs): run `npm run build` first.

import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { z } from "zod"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const serverEntry = path.join(repoRoot, "dist", "bin.js")
const dispatchDistPath = path.join(repoRoot, "dist", "registration-context-dispatch.js")
const effectDistPath = path.join(repoRoot, "dist", "effect", "index.js")
const snapshotPath = path.join(repoRoot, "scripts", "__snapshots__", "dispatch-envelope.snapshot.json")

const require = createRequire(import.meta.url)

for (const [label, filePath] of [
	["server binary", serverEntry],
	["dispatch module", dispatchDistPath],
	["effect module", effectDistPath],
]) {
	if (!fs.existsSync(filePath)) {
		console.error(`check-dispatch-envelope: ${label} is missing at ${filePath} — run \`npm run build\` first.`)
		process.exit(2)
	}
}

const stableStringify = (value) => {
	if (Array.isArray(value)) {
		return `[${value.map((entry) => stableStringify(entry)).join(",")}]`
	}

	if (value && typeof value === "object") {
		const entries = Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
		return `{${entries.join(",")}}`
	}

	return JSON.stringify(value) ?? "null"
}

let checks = 0
const failures = []

const check = (label, condition, detail = "") => {
	checks += 1
	if (!condition) {
		failures.push(`${label}${detail ? ` — ${detail}` : ""}`)
	}
}

const extractText = (result) =>
	(result?.content ?? [])
		.filter((item) => item?.type === "text")
		.map((item) => item.text)
		.join("\n")
		.trim()

const parseEnvelope = (label, result) => {
	const text = extractText(result)
	check(`${label} returns text content`, text.length > 0)
	try {
		return JSON.parse(text)
	} catch {
		check(`${label} returns JSON envelope`, false, text.slice(0, 400))
		return null
	}
}

const assertEnvelopeShape = (label, envelope, { tool, action }) => {
	check(`${label} success=false`, envelope?.success === false, JSON.stringify(envelope))
	check(`${label} tool field`, envelope?.tool === tool, JSON.stringify(envelope))
	check(`${label} action field`, envelope?.action === action, JSON.stringify(envelope))
	check(`${label} message is a non-empty string`, typeof envelope?.message === "string" && envelope.message.length > 0)
}

// ---------------------------------------------------------------------------
// Part A: live envelopes over stdio.
// ---------------------------------------------------------------------------
async function captureLiveEnvelopes() {
	const transport = new StdioClientTransport({
		command: process.execPath,
		args: [serverEntry],
		cwd: repoRoot,
		stderr: "pipe",
	})
	const client = new Client({ name: "unreal-mcp-ue4-dispatch-envelope", version: "0.1.0" })
	const captured = {}

	try {
		await client.connect(transport)

		// Action-specific validation failure (manage_asset.rename requires a
		// target; {} fails before any Unreal execution).
		const invalidResult = await client.callTool({
			name: "manage_asset",
			arguments: { action: "rename", params: {} },
		})
		captured.invalid_params = parseEnvelope("live invalid-params", invalidResult)

		// Handler throw without Unreal: "  " passes the Zod string check, then
		// requiredStringParam rejects the blank command before tryRunCommand.
		const throwResult = await client.callTool({
			name: "manage_system",
			arguments: { action: "console_command", params: { command: "  " } },
		})
		captured.handler_throw = parseEnvelope("live handler-throw", throwResult)
	} finally {
		try {
			await client.close()
		} catch {
			// Best effort shutdown only.
		}
	}

	return captured
}

// ---------------------------------------------------------------------------
// Part B: dispatch-unit envelopes via stubbed SDK registration.
// ---------------------------------------------------------------------------
async function runDispatchUnit() {
	const { Schema, Effect } = await import("effect")
	const patterns = require(effectDistPath)
	const { createDispatchHelpers } = require(dispatchDistPath)
	const editorTools = require(path.join(repoRoot, "dist", "editor", "tools.js"))

	const textResponse = (text) => ({ content: [{ type: "text", text }] })
	const toolNamespaceRegistry = new Map()
	const captured = new Map()

	// Phase 6: dispatch runs the injected command service for the python
	// path. These unit namespaces never touch it (direct/validation/throw
	// only), so a never-called stub proves the wiring without an editor.
	const unreachableCommands = (label) => () =>
		Effect.fail(new Error(`unit scope must not reach ${label} without an editor`))
	const dispatch = createDispatchHelpers({
		commands: {
			runCommand: unreachableCommands("runCommand"),
			discoverPath: unreachableCommands("discoverPath"),
			shutdown: Effect.void,
		},
		editorTools,
		rawServerRegisterTool: (name, config, cb) => {
			captured.set(name, { config, cb })
			return undefined
		},
		rawServerTool: () => undefined,
		recordSchema: z.record(z.any()),
		textResponse,
		toolNamespaceRegistry,
	})

	const zodCustomMessage = "Provide alpha or beta."
	const schemaCustomMessage = "Provide gamma or delta."

	dispatch.registerToolNamespace("test_widget", "Synthetic dispatch-envelope namespace", {
		zod_strict: {
			paramsSchema: z.object({ target: z.string() }).strict(),
			handler: (params) => dispatch.directDispatch({ success: true, target: params.target }),
		},
		zod_custom: {
			paramsSchema: z
				.object({ alpha: z.string().optional(), beta: z.string().optional() })
				.strict()
				.superRefine((params, ctx) => {
					const record = params ?? {}
					if (["alpha", "beta"].some((key) => typeof record[key] === "string" && record[key].trim())) {
						return
					}
					ctx.addIssue({ code: z.ZodIssueCode.custom, message: zodCustomMessage })
				}),
			handler: (params) => dispatch.directDispatch({ success: true, echo: params }),
		},
		schema_strict: {
			paramsSchema: Schema.Struct({ target: Schema.String }),
			handler: (params) => dispatch.directDispatch({ success: true, target: params.target }),
		},
		schema_custom: {
			paramsSchema: patterns.atLeastOneValue(
				Schema.Struct({
					gamma: Schema.optional(Schema.String),
					delta: Schema.optional(Schema.String),
				}),
				["gamma", "delta"],
				schemaCustomMessage,
			),
			handler: (params) => dispatch.directDispatch({ success: true, echo: params }),
		},
		sync_throw: {
			handler: () => {
				throw new Error("boom-sync")
			},
		},
		async_reject: {
			handler: async () => {
				throw new Error("boom-async")
			},
		},
		effect_fail: {
			handler: () => Effect.fail(new patterns.MissingParamError({ key: "widget_blueprint" })),
		},
		direct_ok: {
			handler: (params) => dispatch.directDispatch({ success: true, echo: params }),
		},
	})

	const entry = captured.get("test_widget")
	check("unit namespace registered", entry !== undefined)
	const cb = entry?.cb ?? (async () => textResponse("{}"))

	const call = async (action, params) => parseEnvelope(`unit ${action}`, await cb({ action, params }))

	// Zod path: excess props rejected into the exact envelope.
	{
		const envelope = await call("zod_strict", { target: "x", extra: 1 })
		assertEnvelopeShape("unit zod excess", envelope, { tool: "test_widget", action: "zod_strict" })
		check(
			"unit zod excess prefix",
			String(envelope?.message ?? "").startsWith("Invalid params for test_widget.zod_strict: "),
			String(envelope?.message ?? ""),
		)
	}

	// Zod path: verbatim custom message preserved behind the prefix.
	{
		const envelope = await call("zod_custom", {})
		assertEnvelopeShape("unit zod custom", envelope, { tool: "test_widget", action: "zod_custom" })
		check(
			"unit zod custom prefix",
			String(envelope?.message ?? "").startsWith("Invalid params for test_widget.zod_custom: "),
			String(envelope?.message ?? ""),
		)
		check("unit zod custom verbatim", String(envelope?.message ?? "").includes(zodCustomMessage))
	}

	// Schema path: excess props rejected into the exact envelope (strictness
	// parity — Structs strip unknown keys by default, so this proves the
	// strict decode option is wired, not just the Struct).
	{
		const envelope = await call("schema_strict", { target: "x", extra: 1 })
		assertEnvelopeShape("unit schema excess", envelope, { tool: "test_widget", action: "schema_strict" })
		check(
			"unit schema excess prefix",
			String(envelope?.message ?? "").startsWith("Invalid params for test_widget.schema_strict: "),
			String(envelope?.message ?? ""),
		)
	}

	// Schema path: verbatim custom message, no Effect tree formatting leak —
	// the detail sits behind the identical prefix, never raw.
	{
		const envelope = await call("schema_custom", {})
		assertEnvelopeShape("unit schema custom", envelope, { tool: "test_widget", action: "schema_custom" })
		const message = String(envelope?.message ?? "")
		check("unit schema custom prefix", message.startsWith("Invalid params for test_widget.schema_custom: "), message)
		check("unit schema custom verbatim", message.includes(schemaCustomMessage), message)
		check("unit schema no FiberFailure leak", !message.includes("FiberFailure"), message)
	}

	// Handler throws (sync + async) render the identical envelope shape.
	for (const [action, expected] of [
		["sync_throw", "boom-sync"],
		["async_reject", "boom-async"],
	]) {
		const envelope = await call(action, {})
		assertEnvelopeShape(`unit ${action}`, envelope, { tool: "test_widget", action })
		check(`unit ${action} message`, envelope?.message === expected, JSON.stringify(envelope))
	}

	// Effect-handler failure flows through the same envelope with the exact
	// required-param text (MissingParamError channel rendering).
	{
		const envelope = await call("effect_fail", {})
		assertEnvelopeShape("unit effect_fail", envelope, { tool: "test_widget", action: "effect_fail" })
		check("unit effect_fail message", envelope?.message === "widget_blueprint is required", JSON.stringify(envelope))
	}

	// Direct success path still round-trips (no envelope on success).
	{
		const envelope = await call("direct_ok", { hello: "world" })
		check("unit direct success", envelope?.success === true, JSON.stringify(envelope))
	}
}

async function main() {
	const update = process.argv.includes("--update")
	const live = await captureLiveEnvelopes()

	assertEnvelopeShape("live invalid-params", live.invalid_params, {
		tool: "manage_asset",
		action: "rename",
	})
	check(
		"live invalid-params prefix",
		String(live.invalid_params?.message ?? "").startsWith("Invalid params for manage_asset.rename: "),
		String(live.invalid_params?.message ?? ""),
	)
	assertEnvelopeShape("live handler-throw", live.handler_throw, {
		tool: "manage_system",
		action: "console_command",
	})
	check(
		"live handler-throw message",
		live.handler_throw?.message === "command is required",
		JSON.stringify(live.handler_throw),
	)

	if (update) {
		const snapshot = {
			version: 1,
			envelopes: {
				invalid_params: live.invalid_params,
				handler_throw: live.handler_throw,
			},
		}
		fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
		console.log(`[PASS] check-dispatch-envelope: snapshot regenerated (${checks} checks)`)
	} else {
		if (!fs.existsSync(snapshotPath)) {
			console.error(
				"check-dispatch-envelope: FAIL: snapshot is missing — run `node scripts/check-dispatch-envelope.mjs --update` first.",
			)
			process.exit(1)
		}
		const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"))
		for (const key of ["invalid_params", "handler_throw"]) {
			check(
				`snapshot ${key} identical`,
				stableStringify(live[key]) === stableStringify(snapshot?.envelopes?.[key]),
				`live=${stableStringify(live[key])} snapshot=${stableStringify(snapshot?.envelopes?.[key])}`,
			)
		}
	}

	await runDispatchUnit()

	if (failures.length > 0) {
		console.error(`check-dispatch-envelope: FAIL (${failures.length}/${checks} checks):`)
		for (const failure of failures) {
			console.error(`  - ${failure}`)
		}
		process.exit(1)
	}

	console.log(`[PASS] check-dispatch-envelope: identical dispatch envelopes (${checks} checks)`)
}

main().catch((error) => {
	console.error(`check-dispatch-envelope: runner crashed: ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
