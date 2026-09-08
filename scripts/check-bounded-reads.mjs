#!/usr/bin/env node

// SHIP-S3 bounded-reads check (offline, no Unreal editor):
//   Part A (dispatch): registers the REAL manage_editor / manage_actor /
//     manage_level descriptors against the dispatch harness with a stubbed
//     command service (no editor) and asserts the invalid
//     limit/offset/fields envelopes (negative, non-integer, over-max,
//     wrong-type, excess-prop) render the identical
//     `Invalid params for <tool>.<action>: ...` envelope, while valid
//     paged calls forward limit/offset/fields into the rendered editor
//     command (captured from the stub).
//   Part B (stubbed large payload): runs scripts/stub-bounded-reads.py
//     (python3, fake 250-actor level, real ue_get_world_outliner.py +
//     ue_actor/10_query_ops.py sources) and diffs its canonical summary
//     against the committed snapshot.
//   Part C (byte proxy): synthetic N=2000 actor-list byte arithmetic —
//     full-dump bytes vs default-page (200) bytes through the same
//     slice-before-serialize shape the Python side implements.
//
// Usage:
//   node scripts/check-bounded-reads.mjs            # compare against snapshot
//   node scripts/check-bounded-reads.mjs --update   # regenerate snapshot
//
// Runs against dist/ (like check-schema-parity.mjs): run `npm run build` first.

import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const dispatchDistPath = path.join(repoRoot, "dist", "registration-context-dispatch.js")
const paramsDistPath = path.join(repoRoot, "dist", "registration-context-params.js")
const schemasDistPath = path.join(repoRoot, "dist", "registration-context-schemas.js")
const toolsDistPath = path.join(repoRoot, "dist", "editor", "tools.js")
const actorNamespacesDistPath = path.join(repoRoot, "dist", "register-core-asset-actor-namespaces.js")
const editorNamespacesDistPath = path.join(repoRoot, "dist", "register-core-editor-namespaces.js")
const worldBuildingNamespacesDistPath = path.join(repoRoot, "dist", "register-world-building-namespaces.js")
const stubScript = path.join(repoRoot, "scripts", "stub-bounded-reads.py")
const snapshotPath = path.join(repoRoot, "scripts", "__snapshots__", "bounded-reads.snapshot.json")

const require = createRequire(import.meta.url)

for (const [label, filePath] of [
	["dispatch module", dispatchDistPath],
	["params module", paramsDistPath],
	["schemas module", schemasDistPath],
	["editor tools module", toolsDistPath],
	["actor namespaces module", actorNamespacesDistPath],
	["editor namespaces module", editorNamespacesDistPath],
	["world-building namespaces module", worldBuildingNamespacesDistPath],
	["stub harness", stubScript],
]) {
	if (!fs.existsSync(filePath)) {
		console.error(`check-bounded-reads: ${label} is missing at ${filePath} — run \`npm run build\` first.`)
		process.exit(2)
	}
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

// ---------------------------------------------------------------------------
// Part A: invalid limit/offset/fields envelopes through the real dispatch.
// The strict-union SDK inputSchema rejects constraint violations at the
// gate (-32602) before our callback runs, so the identical dispatch
// envelopes are driven here dispatch-unit style (the
// check-dispatch-envelope.mjs Part B pattern) against the REAL
// registrations: invalid limit/offset/fields must render
// `Invalid params for <tool>.<action>: ...`, and valid paged calls must
// forward limit/offset/fields into the rendered editor command (captured
// from the stubbed command service — no editor needed).
// ---------------------------------------------------------------------------
async function runDispatchMatrix() {
	const { Effect } = await import("effect")
	const { createDispatchHelpers } = require(dispatchDistPath)
	const { createRegistrationParamHelpers } = require(paramsDistPath)
	const { createRegistrationSchemaHelpers } = require(schemasDistPath)
	const editorTools = require(toolsDistPath)
	const { coreAssetActorDescriptors } = require(actorNamespacesDistPath)
	const { coreEditorDescriptors } = require(editorNamespacesDistPath)
	const { worldBuildingDescriptors } = require(worldBuildingNamespacesDistPath)

	const textResponse = (text) => ({ content: [{ type: "text", text }] })
	const toolNamespaceRegistry = new Map()
	const captured = new Map()
	const renderedCommands = []

	// Stubbed command service: invalid params never reach it; valid paged
	// calls land here with the fully rendered editor script.
	const commands = {
		runCommand: (command) => {
			renderedCommands.push(command)
			return Effect.succeed(JSON.stringify({ stub: true }))
		},
		discoverPath: () => Effect.fail(new Error("stub scope has no editor")),
		shutdown: Effect.void,
	}

	const schemaHelpers = createRegistrationSchemaHelpers()
	const paramHelpers = createRegistrationParamHelpers(editorTools, schemaHelpers)
	const dispatch = createDispatchHelpers({
		commands,
		editorTools,
		rawServerRegisterTool: (name, config, cb) => {
			captured.set(name, { config, cb })
			return undefined
		},
		rawServerTool: () => undefined,
		recordSchema: schemaHelpers.recordSchema,
		textResponse,
		toolNamespaceRegistry,
	})

	const ctx = { ...schemaHelpers, ...paramHelpers, ...dispatch }
	for (const descriptors of [coreAssetActorDescriptors(ctx), coreEditorDescriptors(ctx), worldBuildingDescriptors(ctx)]) {
		for (const descriptor of descriptors) {
			dispatch.registerToolNamespace(
				descriptor.name,
				descriptor.description,
				descriptor.actions,
				descriptor.options,
			)
		}
	}

	const call = async (label, tool, action, params) => {
		const entry = captured.get(tool)
		check(`${label} tool registered`, entry !== undefined)
		const envelope = parseEnvelope(label, await entry.cb({ action, params }))
		return envelope
	}

	const expectInvalid = async (tool, action, params, fragment) => {
		const label = `invalid ${tool}.${action} ${JSON.stringify(params)}`
		const envelope = await call(label, tool, action, params)
		if (!envelope) {
			return
		}
		check(`${label} success=false`, envelope?.success === false, JSON.stringify(envelope))
		check(`${label} tool field`, envelope?.tool === tool, JSON.stringify(envelope))
		check(`${label} action field`, envelope?.action === action, JSON.stringify(envelope))
		check(`${label} message`, String(envelope?.message ?? "").includes(fragment), String(envelope?.message ?? ""))
	}

	const invalidPrefix = (tool, action) => `Invalid params for ${tool}.${action}: `
	for (const [tool, action, params] of [
		["manage_editor", "world_outliner", { limit: -1 }],
		["manage_editor", "world_outliner", { limit: 2.5 }],
		["manage_editor", "world_outliner", { limit: 2001 }],
		["manage_editor", "world_outliner", { offset: -1 }],
		["manage_editor", "world_outliner", { offset: 0.5 }],
		["manage_editor", "world_outliner", { fields: "name" }],
		["manage_editor", "world_outliner", { bogus: 1 }],
		["manage_level", "world_outliner", { limit: -1 }],
		["manage_level_structure", "world_outliner", { offset: -1 }],
		["manage_actor", "list", { limit: -1 }],
		["manage_actor", "list", { limit: 1.5 }],
		["manage_actor", "list", { limit: 2001 }],
		["manage_actor", "list", { offset: -2 }],
		["manage_actor", "find", { pattern: "x", limit: 5000 }],
		["manage_actor", "find", { pattern: "x", offset: -1 }],
		["manage_level", "list_actors", { limit: 2001 }],
		["manage_level", "list_actors", { offset: -1 }],
	]) {
		await expectInvalid(tool, action, params, invalidPrefix(tool, action))
	}

	// manage_actor.find without pattern/name keeps its verbatim custom message.
	for (const params of [{ limit: 5 }, {}]) {
		await expectInvalid("manage_actor", "find", params, "Provide pattern or name.")
	}

	// Boundary values stay valid: 0 and 2000 ride through to the editor.
	const decodeBlobs = (command) => {
		const blobs = []
		for (const match of command.matchAll(/"""([A-Za-z0-9+/=]+)"""/g)) {
			blobs.push(JSON.parse(Buffer.from(match[1], "base64").toString("utf8")))
		}
		return blobs
	}

	const expectForwarded = async (label, tool, action, params, wantBlobs) => {
		renderedCommands.length = 0
		const envelope = await call(label, tool, action, params)
		if (!envelope) {
			return
		}
		check(`${label} reaches stubbed editor`, envelope?.stub === true, JSON.stringify(envelope))
		check(`${label} renders one command`, renderedCommands.length === 1, `${renderedCommands.length}`)
		const command = renderedCommands[0] ?? ""
		check(`${label} no unrendered template args`, !command.includes("${"))
		const blobs = decodeBlobs(command)
		check(`${label} forwards paging args`, JSON.stringify(blobs) === JSON.stringify(wantBlobs), JSON.stringify(blobs))
	}

	await expectForwarded("valid manage_editor.world_outliner {}", "manage_editor", "world_outliner", {}, [
		null,
		null,
		null,
	])
	await expectForwarded(
		"valid manage_editor.world_outliner paged",
		"manage_editor",
		"world_outliner",
		{ limit: 50, offset: 10, fields: ["name", "class"] },
		[50, 10, ["name", "class"]],
	)
	await expectForwarded("valid manage_editor.world_outliner max", "manage_editor", "world_outliner", { limit: 2000 }, [
		2000,
		null,
		null,
	])
	await expectForwarded("valid manage_actor.list paged", "manage_actor", "list", { limit: 25, offset: 5 }, [
		"get_actors_in_level",
		{ limit: 25, offset: 5 },
	])
	await expectForwarded("valid manage_actor.find paged", "manage_actor", "find", { pattern: "Wall", limit: 10 }, [
		"find_actors_by_name",
		{ pattern: "Wall", limit: 10 },
	])
	await expectForwarded("valid manage_level.list_actors {}", "manage_level", "list_actors", {}, [
		"get_actors_in_level",
		{},
	])
}

// ---------------------------------------------------------------------------
// Part B: stubbed-large-payload truncation snapshot.
// ---------------------------------------------------------------------------
function runStubSnapshot(update) {
	let stdout
	try {
		stdout = execFileSync("python3", [stubScript], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
	} catch (error) {
		check("stub harness exits 0", false, String(error?.stderr ?? error?.message ?? error).slice(0, 500))
		return
	}
	check("stub harness exits 0", true)

	let summary
	try {
		summary = JSON.parse(stdout)
	} catch {
		check("stub summary is JSON", false, stdout.slice(0, 400))
		return
	}
	check("stub summary is JSON", true)

	if (update) {
		fs.mkdirSync(path.dirname(snapshotPath), { recursive: true })
		fs.writeFileSync(snapshotPath, `${JSON.stringify(summary, null, 2)}\n`)
		console.log(`[PASS] check-bounded-reads: stub snapshot regenerated (${summary?.cases?.length ?? 0} cases)`)
		return
	}

	if (!fs.existsSync(snapshotPath)) {
		console.error(
			"check-bounded-reads: FAIL: stub snapshot is missing — run `node scripts/check-bounded-reads.mjs --update` first.",
		)
		process.exit(1)
	}
	const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"))
	check(
		"stub truncation snapshot identical",
		JSON.stringify(summary) === JSON.stringify(snapshot),
		"stub summary drifted — inspect with --update only if the paging contract changed intentionally",
	)
}

// ---------------------------------------------------------------------------
// Part C: synthetic N=2000 byte arithmetic proxy.
// ---------------------------------------------------------------------------
function runByteProxy() {
	const actor = (index) => ({
		name: `actor_${String(index).padStart(4, "0")}`,
		label: `Label ${String(index).padStart(4, "0")}`,
		class: ["StaticMeshActor", "PointLight", "PlayerStart"][index % 3],
		location: { x: index, y: 0, z: 10 },
		rotation: { pitch: 0, yaw: 90, roll: 0 },
		scale: { x: 1, y: 1, z: 1 },
		is_hidden: false,
		folder_path: "/Folder",
		components: ["CompA", "CompB"],
	})

	const total = 2000
	const all = Array.from({ length: total }, (_, index) => actor(index))
	const fullBytes = Buffer.byteLength(JSON.stringify({ actors: all }, null, 2), "utf8")

	// Same shape the Python side implements: count, slice, then serialize.
	const totalCount = all.length
	const pageLimit = 200
	const pageOffset = 0
	const page = all.slice(pageOffset, pageOffset + pageLimit)
	const pagedPayload = {
		actors: page,
		total_count: totalCount,
		returned_count: page.length,
		truncated: pageOffset + pageLimit < totalCount,
		limit: pageLimit,
		offset: pageOffset,
	}
	const pagedBytes = Buffer.byteLength(JSON.stringify(pagedPayload, null, 2), "utf8")

	check("N=2000 full dump is unbounded-scale", fullBytes > 500_000, `${fullBytes} bytes`)
	check("default page bounds response bytes", pagedBytes < fullBytes * 0.2, `paged=${pagedBytes} full=${fullBytes}`)
	check(
		"default page scales with limit, not level",
		Math.abs(pagedBytes / fullBytes - pageLimit / total) < 0.02,
		`ratio=${(pagedBytes / fullBytes).toFixed(3)}`,
	)
	console.log(`check-bounded-reads: byte proxy N=${total}: full=${fullBytes} B, default-page=${pagedBytes} B`)
}

async function main() {
	const update = process.argv.includes("--update")
	await runDispatchMatrix()
	runStubSnapshot(update)
	runByteProxy()

	if (failures.length > 0) {
		console.error(`check-bounded-reads: FAIL (${failures.length}/${checks} checks):`)
		for (const failure of failures) {
			console.error(`  - ${failure}`)
		}
		process.exit(1)
	}

	console.log(`[PASS] check-bounded-reads: bounded reads + truncation envelope (${checks} checks)`)
}

main().catch((error) => {
	console.error(`check-bounded-reads: runner crashed: ${error instanceof Error ? error.message : String(error)}`)
	process.exit(1)
})
