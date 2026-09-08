#!/usr/bin/env node

// SHIP-S1 assertions over the editor-side prelude cache, all without a
// live editor. (i) Rendered-bytes assertion over the baseline §3d command
// set (actor list, asset search, sequence create, pie_start): cacheable
// renders must be <= 10% of today's full-prelude bytes. (ii) Cache-shape
// unit checks: miss-marker detection, fail-loud splits, conflicting
// flags. (iii) Fake-transport scenarios through the real
// ConnectionSessionService.runCommand: full first, tail-only second, one
// resend on simulated miss. Fails non-zero on the first broken scenario.
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const domainPath = path.join(repoRoot, "dist", "editor", "tools-domain.js")
const directPath = path.join(repoRoot, "dist", "editor", "tools-direct.js")
const basePath = path.join(repoRoot, "dist", "editor", "tools-base.js")
const rendererPath = path.join(repoRoot, "dist", "editor", "script-renderer.js")
const cachePath = path.join(repoRoot, "dist", "editor", "prelude-cache.js")
const loaderPath = path.join(repoRoot, "dist", "editor", "prelude-loader.js")
const servicePath = path.join(repoRoot, "dist", "effect", "connection-service.js")

for (const required of [domainPath, directPath, basePath, rendererPath, cachePath, loaderPath, servicePath]) {
	if (!fs.existsSync(required)) {
		console.error("check-prelude-cache: dist/ is missing — run `npm run build` first.")
		process.exit(2)
	}
}

const require = createRequire(import.meta.url)
const domain = require(domainPath)
const direct = require(directPath)
const toolsBase = require(basePath)
const { renderEditorScript } = require(rendererPath)
const preludeCache = require(cachePath)
const { editorPreludes, getDomainDispatchHarness } = require(loaderPath)
const { makeConnectionSessionService } = require(servicePath)

const failures = []
const check = (name, cond, detail = "") => {
	if (cond) {
		console.log(`[PASS] ${name}${detail ? `: ${detail}` : ""}`)
	} else {
		failures.push(name)
		console.error(`[FAIL] ${name}${detail ? `: ${detail}` : ""}`)
	}
}

// Domain builders prepend the dispatch harness before the domain prelude
// (tools-base renderDomainScript); the test mirrors that composition so
// the cached/registering renders hash the identical static prefix.
const domainExtra = (prelude) => [getDomainDispatchHarness(), prelude].filter(Boolean).join("\n\n")

// list (manage_actor/list -> UEActorTool get_actors_in_level), asset
// search (searchAssetsCommand shape -> UESearchAssets), sequence create
// (UESequenceTool create, the 170KB baseline case), pie_start
// (manage_pie/start_pie -> UEPIETool start_pie).
const baseline = [
	{
		label: "actor list",
		full: () => domain.UEActorTool("get_actors_in_level"),
		file: "./scripts/ue_actor_tools.py",
		vars: () => ({ operation: toolsBase.jsonArg("get_actors_in_level"), args: toolsBase.jsonArg({}) }),
		extra: () => editorPreludes.actor,
		isDomain: true,
	},
	{
		label: "asset search",
		full: () => direct.UESearchAssets("door", "StaticMesh", false, 10),
		file: "./scripts/ue_search_assets.py",
		vars: () => ({
			search_term: toolsBase.jsonArg("door"),
			asset_class: toolsBase.jsonArg("StaticMesh"),
			include_engine: toolsBase.jsonArg(false),
			limit: toolsBase.jsonArg(10),
		}),
		extra: () => "",
		isDomain: false,
	},
	{
		label: "sequence create",
		full: () => domain.UESequenceTool("create", { name: "TestSequence", path: "/Game/Cinematics" }),
		file: "./scripts/ue_sequence_tools.py",
		vars: () => ({
			operation: toolsBase.jsonArg("create"),
			args: toolsBase.jsonArg({ name: "TestSequence", path: "/Game/Cinematics" }),
		}),
		extra: () => editorPreludes.sequence,
		isDomain: true,
	},
	{
		label: "pie_start",
		full: () => domain.UEPIETool("start_pie", { timeout_seconds: 30, poll_interval: 1 }),
		file: "./scripts/ue_pie_tools.py",
		vars: () => ({
			operation: toolsBase.jsonArg("start_pie"),
			args: toolsBase.jsonArg({ timeout_seconds: 30, poll_interval: 1 }),
		}),
		extra: () => "",
		isDomain: true,
	},
]

// (i) Rendered-bytes assertion: cacheable <= 10% of today's bytes.
for (const { label, full, file, vars, extra, isDomain } of baseline) {
	const fullRendered = full()
	const render = isDomain ? toolsBase.renderDomainScript : toolsBase.renderScript
	const cached = render(file, vars(), extra(), { cacheable: true })
	// renderEditorScript takes the already-composed prefix tail: domain
	// builders compose harness + prelude inside renderDomainScript.
	const prefixExtra = isDomain ? domainExtra(extra()) : extra()
	const registering = renderEditorScript(file, vars(), { extraPrelude: prefixExtra, registerCache: true })
	const ratio = cached.length / fullRendered.length
	check(
		`bytes:${label}`,
		ratio <= 0.1,
		`full=${fullRendered.length} cached=${cached.length} (${(ratio * 100).toFixed(2)}%) registering=${registering.length}`,
	)
	// The cached and registering variants must agree on the prefix hash:
	// splitCachedScript recovers it, the registering payload embeds it.
	const { hash, tail } = preludeCache.splitCachedScript(cached)
	check(`hash-agree:${label}`, registering.includes(hash), hash)
	// The cacheable tail must be byte-identical to the action tail of the
	// default full render: the cacheable path substitutes vars exactly
	// like the full path (the domain dispatch args live in the harness,
	// i.e. the cached prefix — only direct tails carry blobs, which the
	// codec harness checks separately).
	check(`tail-identical:${label}`, fullRendered.endsWith(tail) && tail.length > 0, `tail=${tail.length}`)
	// Registering overhead is one small trailer, not a second prelude.
	check(
		`register-overhead:${label}`,
		registering.length <= fullRendered.length * 1.05,
		`+${registering.length - fullRendered.length} chars`,
	)
	// Neither cache shape may leak unrendered template args.
	check(`no-template-args:${label}`, !cached.includes("${") && !registering.includes("${"))
}

// (ii) Cache-shape unit checks.
check("miss-clean-output", preludeCache.isPreludeCacheMiss('{"success":true}') === false)
check(
	"miss-marker-output",
	preludeCache.isPreludeCacheMiss('noise\nrrmcp:cache-miss:abc123\nTraceback (most recent call last)') === true,
)
check("miss-hash-filter-hit", preludeCache.isPreludeCacheMiss("rrmcp:cache-miss:abc123", "abc123") === true)
check("miss-hash-filter-miss", preludeCache.isPreludeCacheMiss("rrmcp:cache-miss:abc123", "deadbee") === false)

let splitThrew = false
try {
	preludeCache.splitCachedScript(domain.UEActorTool("get_actors_in_level"))
} catch {
	splitThrew = true
}
check("split-fail-loud-on-full", splitThrew)

let flagsThrew = false
try {
	renderEditorScript("./scripts/ue_get_asset_info.py", {}, { cacheable: true, registerCache: true })
} catch {
	flagsThrew = true
}
check("conflicting-flags-throw", flagsThrew)

// (iii) Fake-transport scenarios through the real service. The miniature
// editor below models only the S1 protocol: a sys.modules-style store
// keyed by content hash. Registering payloads store an entry; cached
// payloads hit when the entry exists and answer the miss marker when it
// does not (simulating an editor restart wiping the session).
const okRun = (output) => ({ success: true, output, result: "" })
const lineOut = (...lines) => lines.map((output) => ({ type: "Info", output }))

class MiniFakeEditor {
	constructor() {
		this.store = {}
	}
	handle(command) {
		const miss = /rrmcp:cache-miss:([0-9a-f]{40})/.exec(command)
		const registers = command.includes("_rrmcp_snapshot")
		const isShim = miss && !registers
		if (isShim) {
			const entry = this.store[miss[1]]
			if (entry && entry.version === 1) {
				return okRun(lineOut('{"success":true,"cached":true}'))
			}
			return okRun(lineOut(`rrmcp:cache-miss:${miss[1]}`, "RuntimeError: rrmcp:cache-miss"))
		}
		if (registers) {
			const stored = /"([0-9a-f]{40})"\] = _rrmcp_snapshot/.exec(command)
			if (stored) {
				this.store[stored[1]] = { version: 1 }
			}
			return okRun(lineOut('{"success":true,"registered":true}'))
		}
		return okRun(lineOut('{"success":true}'))
	}
}

class FakeTransport {
	constructor(editor) {
		this.editor = editor
		this.calls = []
	}
	async start() {}
	async getFirstRemoteNode() {
		return { nodeId: "fake-node" }
	}
	async openCommandConnection() {}
	hasCommandConnection() {
		return true
	}
	closeCommandConnection() {}
	async runCommand(command) {
		this.calls.push(command)
		return this.editor.handle(command)
	}
	stop() {}
}

const editor = new MiniFakeEditor()
const transport = new FakeTransport(editor)
const service = await Effect.runPromise(
	makeConnectionSessionService({ transport, log: () => {} }),
)
const run = (command) => service.runCommand(command)
const runPromise = (effect) => Effect.runPromise(effect)

const actor = baseline[0]
const cachedActor = toolsBase.renderDomainScript(actor.file, actor.vars(), actor.extra(), { cacheable: true })
const registeringActor = renderEditorScript(actor.file, actor.vars(), {
	extraPrelude: domainExtra(actor.extra()),
	registerCache: true,
})

// Full first: the cold editor stores the entry, one send, success out.
{
	const out = await runPromise(run(registeringActor))
	check("full-first-succeeds", out.includes('"registered":true'), out.slice(0, 80))
	check("full-first-one-send", transport.calls.length === 1, `${transport.calls.length} send(s)`)
}

// Tail-only second: warmed editor answers without any prelude bytes.
{
	const out = await runPromise(run(cachedActor))
	check("cached-second-hits", out.includes('"cached":true'), out.slice(0, 80))
	check("cached-second-one-send", transport.calls.length === 2, `${transport.calls.length} send(s)`)
}

// Simulated restart wipes the session store; the fallback resends the
// full prelude exactly once, then succeeds.
{
	editor.store = {}
	const before = transport.calls.length
	const out = await runPromise(preludeCache.runWithPreludeCacheFallback(run, cachedActor, registeringActor))
	const sends = transport.calls.length - before
	check("miss-resends-once", sends === 2, `${sends} send(s)`)
	check("miss-then-succeeds", out.includes('"registered":true'), out.slice(0, 80))
}

// Clean outputs never trigger a resend.
{
	const before = transport.calls.length
	const out = await runPromise(preludeCache.runWithPreludeCacheFallback(run, cachedActor, registeringActor))
	const sends = transport.calls.length - before
	check("hit-no-resend", sends === 1, `${sends} send(s)`)
	check("hit-passthrough", out.includes('"cached":true'), out.slice(0, 80))
}

if (failures.length > 0) {
	console.error(`check-prelude-cache: ${failures.length} failing scenario(s): ${failures.join(", ")}`)
	process.exit(1)
}

console.log("check-prelude-cache: prelude cache renders and fallback pass without an editor.")
