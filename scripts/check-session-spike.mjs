#!/usr/bin/env node

// W3 session-namespace spike gate — offline, no editor (no TS change).
//  1. py2.7-dialect gate over the payload dir (covers the spike shim/tail).
//  2. Render-seam probe: the spike tail is addressed through the UNCHANGED
//     M3 seam (renderEditorScript + jsonArg codec) — assert zero unrendered
//     ${...} and exact blob round-trips for the three spike ops.
//  3. Behavioral scenarios via scripts/session-spike-driver.py on python3
//     with a fake `unreal` transport: cold init, per-call setup-share on
//     actor list + asset search + sequence create, level-reload fault
//     injection (exactly one self-invalidation, clean next call), restart
//     amnesia, 200-call bounded growth, dispatch envelopes.
// Fails non-zero on the first broken expectation. Spike-only: not wired
// into test:no-unreal (the memo, not a merge, is the deliverable).
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const scriptRendererPath = path.join(repoRoot, "dist", "editor", "script-renderer.js")

if (!fs.existsSync(scriptRendererPath)) {
	console.error("check-session-spike: dist/ is missing — run `npm run build` first.")
	process.exit(2)
}

const failures = []
const check = (name, cond, detail = "") => {
	if (cond) {
		console.log(`[PASS] ${name}${detail ? `: ${detail}` : ""}`)
	} else {
		failures.push(name)
		console.error(`[FAIL] ${name}${detail ? `: ${detail}` : ""}`)
	}
}

// 1. py27 gate (whole payload dir, so the spike shim + tail are covered).
const py27 = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "check-py27.mjs")], {
	stdio: "inherit",
})
check("py27 gate green (covers spike shim + tail)", py27.status === 0)

// 2. Render-seam probe through the unchanged M3 surface.
const require = createRequire(import.meta.url)
const { renderEditorScript, jsonArg } = require(scriptRendererPath)

const spikeOps = [
	["actor_list", {}],
	["asset_search", { search_term: "Asset_01" }],
	["sequence_create", { sequence_name: "SpikeSequence" }],
]

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "w3-session-spike-"))
const tailsDir = path.join(tmpDir, "tails")
fs.mkdirSync(tailsDir, { recursive: true })

for (const [operation, args] of spikeOps) {
	const rendered = renderEditorScript(
		"./scripts/ue_session_dispatch_tail.py",
		{ operation: jsonArg(operation), args: jsonArg(args) },
	)
	check(`seam renders ${operation} with no unrendered token`, !rendered.includes("${"))
	const blobs = []
	for (const match of rendered.matchAll(/"""([A-Za-z0-9+/=]+)"""/g)) {
		blobs.push(JSON.parse(Buffer.from(match[1], "base64").toString("utf8")))
	}
	check(
		`seam codec round-trips ${operation}`,
		blobs.length === 2 && blobs[0] === operation && JSON.stringify(blobs[1]) === JSON.stringify(args),
		`blobs=${blobs.length}`,
	)
	check(`seam tail addresses the session namespace (${operation})`, rendered.includes("session_dispatch("))
	fs.writeFileSync(path.join(tailsDir, `${operation}.rendered.py`), rendered, "utf8")
}

// 3. Behavioral scenarios under the fake transport.
const scriptsDir = path.join(repoRoot, "server", "editor", "scripts")
const driver = spawnSync(
	"python3",
	[
		path.join(repoRoot, "scripts", "session-spike-driver.py"),
		path.join(scriptsDir, "ue_text_codec", "00_text_codec.py"),
		path.join(scriptsDir, "ue_object_access", "00_object_probe.py"),
		path.join(scriptsDir, "ue_object_access", "01_editor_world.py"),
		path.join(scriptsDir, "ue_session_namespace.py"),
		tailsDir,
	],
	{ encoding: "utf8" },
)
for (const line of (driver.stdout ?? "").split("\n")) {
	if (line.startsWith("SPIKE_NOTE") || line.startsWith("SPIKE_RESULT")) console.log(line)
}
if (driver.stderr) process.stderr.write(driver.stderr)
check("spike driver scenarios green", driver.status === 0, `exit=${driver.status}`)

fs.rmSync(tmpDir, { recursive: true, force: true })

if (failures.length > 0) {
	console.error(`check-session-spike: ${failures.length} failure(s): ${failures.join("; ")}`)
	process.exit(1)
}
console.log("check-session-spike: green (offline evidence only — live profiling not-run, no editor).")
