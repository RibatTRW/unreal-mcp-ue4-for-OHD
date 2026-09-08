#!/usr/bin/env node

// SHIP-W1 offline prototype: harness-level batch chaining (design (b) from
// docs/w1-batch-design-memo.md). No editor needed.
//
// Renders 3 real single calls through renderDomainScript (the same seam
// callers use), builds one batched payload paying the shared prelude once,
// and asserts: byte-count win vs 3 singles, blob ordering, per-call failure
// locality (executed under python3 with stubbed OPERATIONS), py2.7 grammar
// on the stanza, and no unrendered ${...}.
//
// Deliberately touches no S1/S2/S3/S4 seam: no registrar, renderer,
// transport, or session file is modified. The stanza below is the only
// production-shaped artifact; everything else is measurement scaffolding.
//
// Live gate (20x single vs 4x5 batched wall-clock on a fixture level) is NOT
// run here — no UE4 editor exists on Linux. See the memo §5.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const toolsDomainPath = path.join(repoRoot, "dist", "editor", "tools-domain.js")
const scriptRendererPath = path.join(repoRoot, "dist", "editor", "script-renderer.js")

for (const required of [toolsDomainPath, scriptRendererPath]) {
	if (!fs.existsSync(required)) {
		console.error("check-batch-prototype: dist/ is missing — run `npm run build` first.")
		process.exit(2)
	}
}

const require = createRequire(import.meta.url)
const domain = require(toolsDomainPath)
const { jsonArg } = require(scriptRendererPath)

const failures = []

// Chaining stanza: py2.7-compatible by construction (.format, range, len,
// continue, try/except; no f-strings, no str(), no walrus, no bare super()).
// ${batch_operations} / ${batch_args} are the only interpolation sites and
// both cross the jsonArg codec, satisfying the check-py27 ${...} rule.
const BATCH_CHAIN_STANZA = [
	"# W1-BATCH-CHAIN-BEGIN: N EncodedArg blob-pairs, one exec.",
	"# Per-call envelopes in order; sequential-non-atomic; never throw-the-batch.",
	'BATCH_OPERATIONS = decode_template_json("""${batch_operations}""")',
	'BATCH_ARGS = decode_template_json("""${batch_args}""")',
	"batch_results = []",
	"for _batch_index in range(len(BATCH_OPERATIONS)):",
	"    _batch_op = BATCH_OPERATIONS[_batch_index]",
	"    if _batch_index < len(BATCH_ARGS):",
	"        _batch_args = BATCH_ARGS[_batch_index]",
	"    else:",
	"        _batch_args = {}",
	"    _batch_handler = OPERATIONS.get(_batch_op)",
	"    if not _batch_handler:",
	'        batch_results.append({"success": False, "message": "Unknown batch operation: {0}".format(_batch_op)})',
	"        continue",
	"    try:",
	"        batch_results.append(_batch_handler(_batch_args or {}))",
	"    except Exception as _batch_exc:",
	'        batch_results.append({"success": False, "message": unreal_text(_batch_exc)})',
	'print(json.dumps({"success": True, "results": batch_results}, indent=2))',
].join("\n")

// py2.7 gate: ported subset of scripts/check-py27.mjs bans, applied to the
// stanza (inline here, not a shipped .py file, so check-py27 never scans it).
for (const [name, pattern, allow] of [
	["f-string literal", /\bf(['"])/, null],
	["walrus operator", /:=/, null],
	["bare str()", /\bstr\(/, null],
	["bare super()", /\bsuper\(\s*\)/, null],
	["nonlocal", /^\s*nonlocal\b/m, null],
]) {
	if (pattern.test(BATCH_CHAIN_STANZA) && !allow?.test(BATCH_CHAIN_STANZA)) {
		failures.push(`batch stanza py27 gate: banned construct (${name})`)
	}
}
// ${...} may appear only at the two codec substitution sites.
const interpSites = [...BATCH_CHAIN_STANZA.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]).sort()
if (JSON.stringify(interpSites) !== JSON.stringify(["batch_args", "batch_operations"])) {
	failures.push(`batch stanza codec rule: unexpected interpolation sites: ${interpSites.join(",")}`)
}

// Three real singles through the caller-visible seam. Call 2 is an unknown
// operation and call 3 raises in the stub harness: failure locality is
// exercised, not just the happy path.
const CALLS = [
	["exists", { asset_path: "/Game/A" }],
	["bogus_op", { probe_key: "probe-value" }],
	["boom", { asset_path: "/Game/B" }],
]
const singles = CALLS.map(([op, args]) => domain.UEAssetManagementTool(op, args))
const singlesSum = singles.reduce((n, s) => n + s.length, 0)

// One shared carrier: the first single minus its deterministic per-call tail.
// Conservative: the carrier still holds single #1's two dead blobs (~100 B),
// so the measured batch size is an upper bound on a production render.
const TAIL_RE = /\ndispatch_main\("[^"]*"\)\s*$/
if (!TAIL_RE.test(singles[0])) {
	failures.push("batch carrier: first single does not end with the dispatch_main tail")
}
const carrier = singles[0].replace(TAIL_RE, "")

// Shared-prefix check: the prelude is genuinely common, so paying it once is
// legitimate. Compare the first single against the second up to the first
// codec blob (blobs diverge; everything before must be identical).
const blobStart = (s) => s.indexOf('"""')
if (singles[0].slice(0, blobStart(singles[0])) !== singles[1].slice(0, blobStart(singles[1]))) {
	failures.push("batch carrier: singles do not share a common prelude prefix before the first blob")
}

const batchOps = jsonArg(CALLS.map(([op]) => op))
const batchArgs = jsonArg(CALLS.map(([, args]) => args))
const stanza = BATCH_CHAIN_STANZA.replace("${batch_operations}", batchOps).replace("${batch_args}", batchArgs)
const batched = `${carrier}\n\n${stanza}\n`

if (stanza.includes("${")) {
	failures.push("batched payload: unrendered ${...} left after codec substitution")
}
if (!batched.includes("# W1-BATCH-CHAIN-BEGIN")) {
	failures.push("batched payload: chaining stanza marker missing")
}

// Byte-count assertion: one shared carrier + stanza must beat 3 full singles.
if (!(batched.length < singlesSum)) {
	failures.push(`byte count: batched ${batched.length} B not smaller than 3 singles ${singlesSum} B`)
}

// Ordering assertion: blob-pairs inside the stanza region decode in order to
// the exact call inputs (codec round-trip through the real jsonArg).
const stanzaRegion = batched.slice(batched.indexOf("# W1-BATCH-CHAIN-BEGIN"))
const stanzaBlobs = [...stanzaRegion.matchAll(/"""([A-Za-z0-9+/=]+)"""/g)].map((m) =>
	JSON.parse(Buffer.from(m[1], "base64").toString("utf8")),
)
const wantBlobs = [CALLS.map(([op]) => op), CALLS.map(([, args]) => args)]
if (stanzaBlobs.length !== 2) {
	failures.push(`ordering: expected 2 codec blobs in stanza region, found ${stanzaBlobs.length}`)
} else {
	wantBlobs.forEach((want, i) => {
		if (JSON.stringify(stanzaBlobs[i]) !== JSON.stringify(want)) {
			failures.push(`ordering: stanza blob ${i} decoded out of order or corrupt`)
		}
	})
}

// Failure-locality execution proof: run the substituted stanza under python3
// with a stub harness (ok handler, missing op, raising handler). The batch
// must yield per-call envelopes in order inside one outer success envelope.
const driver = [
	"import base64",
	"import json",
	"def decode_template_json(v):",
	'    return json.loads(base64.b64decode(v).decode("utf-8"))',
	"def unreal_text(v):",
	"    return v if isinstance(v, str) else str(v)",
	"def _ok_exists(a):",
	'    return {"success": True, "operation": "exists"}',
	"def _boom(a):",
	'    raise ValueError("boom")',
	'OPERATIONS = {"exists": _ok_exists, "boom": _boom}',
	stanza,
].join("\n")
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "w1-batch-"))
try {
	const driverPath = path.join(tmpDir, "batch_driver.py")
	fs.writeFileSync(driverPath, driver)
	const out = execFileSync("python3", [driverPath], { encoding: "utf8", timeout: 60000 })
	let envelope
	try {
		envelope = JSON.parse(out)
	} catch {
		failures.push(`locality: driver stdout is not JSON: ${out.slice(0, 120)}`)
	}
	if (envelope) {
		if (envelope.success !== true || !Array.isArray(envelope.results) || envelope.results.length !== 3) {
			failures.push(`locality: outer envelope must hold 3 results, got: ${out.slice(0, 200)}`)
		} else {
			const [r0, r1, r2] = envelope.results
			if (r0.success !== true || r0.operation !== "exists") {
				failures.push(`locality: result 0 must be the ok envelope, got: ${JSON.stringify(r0).slice(0, 120)}`)
			}
			if (r1.success !== false || !String(r1.message).includes("Unknown batch operation: bogus_op")) {
				failures.push(`locality: result 1 must be the unknown-op envelope, got: ${JSON.stringify(r1).slice(0, 120)}`)
			}
			if (r2.success !== false || !String(r2.message).includes("boom")) {
				failures.push(`locality: result 2 must be the exception envelope, got: ${JSON.stringify(r2).slice(0, 120)}`)
			}
		}
	}
} catch (error) {
	failures.push(`locality: batch driver threw (the batch must never throw): ${String(error).slice(0, 200)}`)
} finally {
	fs.rmSync(tmpDir, { recursive: true, force: true })
}

if (failures.length > 0) {
	console.error(`check-batch-prototype failed with ${failures.length} failure(s):`)
	for (const failure of failures) {
		console.error(`  ${failure}`)
	}
	process.exit(1)
}

console.log(
	`check-batch-prototype passed: 3-call batch ${batched.length} B vs 3 singles ${singlesSum} B (${((1 - batched.length / singlesSum) * 100).toFixed(1)}% smaller, prelude paid once); ordering + per-call failure locality green. Live wall-clock gate not run (no editor).`,
)
