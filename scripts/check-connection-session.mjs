#!/usr/bin/env node

// Unreal-free assertions over the connection-session seam (candidate 8).
// Drives the BUILT ConnectionSession with a scripted fake transport and
// asserts the retry/backoff/reconnect policy, the recoverable-error
// predicate, discoverPath semantics, and the composition surface (scoped
// Layer export present, Promise singleton shims absent).
// Fails non-zero on the first broken scenario.
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const sessionPath = path.join(repoRoot, "dist", "connection-session.js")
const adapterPath = path.join(repoRoot, "dist", "remote-execution.js")

for (const required of [sessionPath, adapterPath]) {
	if (!fs.existsSync(required)) {
		console.error("check-connection-session: dist/ is missing — run `npm run build` first.")
		process.exit(2)
	}
}

const require = createRequire(import.meta.url)
const { ConnectionSession, isRecoverableConnectionError } = require(sessionPath)
const adapter = require(adapterPath)

const failures = []
const check = (name, cond, detail = "") => {
	if (cond) {
		console.log(`[PASS] ${name}${detail ? `: ${detail}` : ""}`)
	} else {
		failures.push(name)
		console.error(`[FAIL] ${name}${detail ? `: ${detail}` : ""}`)
	}
}

const okRun = (output) => ({ success: true, output, result: "" })
const lineOut = (...lines) => lines.map((output) => ({ type: "Info", output }))

class FakeTransport {
	constructor(script = {}) {
		this.script = script
		this.calls = []
		this.connected = script.initiallyConnected ?? false
	}
	record(name) {
		this.calls.push(name)
	}
	nextResult(key) {
		const next = (this.script[key] ?? []).shift()
		if (next instanceof Error) throw next
		return next
	}
	async start() {
		this.record("start")
		this.nextResult("start")
	}
	async getFirstRemoteNode() {
		this.record("getFirstRemoteNode")
		return this.nextResult("getFirstRemoteNode") ?? { nodeId: "fake-node" }
	}
	async openCommandConnection() {
		this.record("openCommandConnection")
		this.nextResult("openCommandConnection")
		this.connected = true
	}
	hasCommandConnection() {
		this.record("hasCommandConnection")
		return this.script.hasCommandConnection?.() ?? this.connected
	}
	closeCommandConnection() {
		this.record("closeCommandConnection")
		this.nextResult("closeCommandConnection")
		this.connected = false
	}
	async runCommand(command) {
		this.record(`runCommand:${command}`)
		return this.nextResult("runCommand") ?? okRun(lineOut(""))
	}
	stop() {
		this.record("stop")
		this.connected = false
	}
}

const silent = () => {}
const makeSession = (script, extra = {}) => {
	const sleeps = []
	const transport = new FakeTransport(script)
	const session = new ConnectionSession({
		transport,
		sleep: async (ms) => {
			sleeps.push(ms)
		},
		log: silent,
		...extra,
	})
	return { session, transport, sleeps }
}

// 1. connect fails N-1 times then succeeds (retry + recorded backoff).
{
	const { session, transport, sleeps } = makeSession({
		getFirstRemoteNode: [new Error("no editor yet"), new Error("still scanning"), { nodeId: "n" }],
		runCommand: [okRun(lineOut('print("rrmcp:init")'))],
	})
	const out = await session.runCommand("print(1)")
	check("connect-retry-succeeds", out === "", `out=${JSON.stringify(out)}`)
	check("backoff-recorded", JSON.stringify(sleeps) === JSON.stringify([2000, 3000]), `sleeps=${JSON.stringify(sleeps)}`)
	check("init-probe-command", transport.calls.includes('runCommand:print("rrmcp:init")'), transport.calls.join(","))
	check(
		"three-attempts",
		transport.calls.filter((c) => c === "getFirstRemoteNode").length === 3,
		transport.calls.join(","),
	)
}

// 2. connect exhausts all attempts -> throws last error.
{
	const last = new Error("editor never appeared")
	const { session, sleeps } = makeSession({
		getFirstRemoteNode: [new Error("e1"), new Error("e2"), last],
	})
	let thrown = null
	try {
		await session.runCommand("print(1)")
	} catch (error) {
		thrown = error
	}
	check("exhaust-throws-last", thrown === last, String(thrown))
	check("exhaust-two-sleeps", JSON.stringify(sleeps) === JSON.stringify([2000, 3000]), JSON.stringify(sleeps))
}

// 3. steady-state passthrough joins output lines.
{
	const { session } = makeSession({
		hasCommandConnection: () => true,
		runCommand: [okRun(lineOut("a", "b"))],
	})
	check("steady-passthrough", (await session.runCommand("print(1)")) === "a\nb")
}

// 4. run throw -> best-effort close + reconnect + single retry succeeds.
{
	const { session, transport } = makeSession({
		initiallyConnected: true,
		runCommand: [
			Object.assign(new Error("socket died"), { code: "ECONNRESET" }),
			okRun(lineOut('print("rrmcp:init")')),
			okRun(lineOut("recovered")),
		],
		getFirstRemoteNode: [{ nodeId: "n2" }],
	})
	const out = await session.runCommand("print(1)")
	check("stale-retry-recovers", out === "recovered", JSON.stringify(out))
	check(
		"close-before-reconnect",
		transport.calls.indexOf("closeCommandConnection") < transport.calls.indexOf("getFirstRemoteNode"),
		transport.calls.join(","),
	)
}

// 5. stale retry failure surfaces the retry's error, not the original.
{
	const { session, transport } = makeSession({
		initiallyConnected: true,
		runCommand: [
			{ success: false, output: [], result: "Error A" },
			okRun(lineOut('print("rrmcp:init")')),
			{ success: false, output: [], result: "Error B" },
		],
		getFirstRemoteNode: [{ nodeId: "n2" }],
	})
	let thrown = null
	try {
		await session.runCommand("print(1)")
	} catch (error) {
		thrown = error
	}
	check(
		"stale-retry-error-surfaces",
		thrown && thrown.message === "Command failed with: Error B",
		String(thrown?.message),
	)
	check(
		"retry-attempted-after-stale",
		transport.calls.filter((c) => c === "runCommand:print(1)").length === 2,
		transport.calls.join(","),
	)
}

// 6. predicate classification.
check("econnreset-recoverable", isRecoverableConnectionError({ code: "ECONNRESET" }) === true)
check("epipe-not-recoverable", isRecoverableConnectionError({ code: "EPIPE" }) === false)
check("plain-error-not-recoverable", isRecoverableConnectionError(new Error("x")) === false)
check("null-not-recoverable", isRecoverableConnectionError(null) === false)
check("string-not-recoverable", isRecoverableConnectionError("ECONNRESET") === false)

// 7. discoverPath last-line + None/empty-throw.
{
	const { session } = makeSession({
		hasCommandConnection: () => true,
		runCommand: [okRun(lineOut("noise", "C:\\Engine"))],
	})
	check("discover-last-line", (await session.discoverPath("cmd", "nope")) === "C:\\Engine")
	const mk = (out) => makeSession({ hasCommandConnection: () => true, runCommand: [okRun(lineOut(out))] }).session
	let noneThrew = false
	try {
		await mk("None").discoverPath("cmd", "ERR-NONE")
	} catch (error) {
		noneThrew = error.message === "ERR-NONE"
	}
	check("discover-none-throws", noneThrew)
	let emptyThrew = false
	try {
		await mk("   ").discoverPath("cmd", "ERR-EMPTY")
	} catch (error) {
		emptyThrew = error.message === "ERR-EMPTY"
	}
	check("discover-empty-throws", emptyThrew)
}

// 8. composition surface (Phase 6): the Promise singleton shims are gone —
// startup owns the lifecycle through the scoped Layer, and dispatch/direct
// tools run the service Effects directly. Lock both directions: the scoped
// layer is exported, the three shim names are not.
check(
	"composition-surface",
	typeof adapter.SharedConnectionSessionLive === "object" &&
		typeof adapter.tryRunCommand === "undefined" &&
		typeof adapter.discoverPath === "undefined" &&
		typeof adapter.shutdownRemoteExecution === "undefined",
	Object.keys(adapter).sort().join(","),
)

// 9. start failure drops the transport and rebuilds lazily on next use:
// the factory must NOT run inside the failure — only on the next ensure.
{
	const events = []
	const startBoom = new Error("bind failed")
	const mkTransport = (label, script) => {
		const t = new FakeTransport(script)
		const origStart = t.start.bind(t)
		t.start = async () => {
			events.push(`${label}:start`)
			return origStart()
		}
		return t
	}
	const first = mkTransport("first", { start: [startBoom] })
	const session = new ConnectionSession({
		transport: first,
		sleep: async () => {},
		log: silent,
		createTransport: () => {
			events.push("create")
			return mkTransport("second", {
				runCommand: [okRun(lineOut('print("rrmcp:init")')), okRun(lineOut("late-success"))],
			})
		},
	})
	let thrown = null
	try {
		await session.runCommand("print(1)")
	} catch (error) {
		thrown = error
	}
	check("start-failure-rethrows", thrown === startBoom, String(thrown))
	check("no-eager-recreate", !events.includes("create"), events.join(","))
	const out = await session.runCommand("print(1)")
	check("recreate-recovers", out === "late-success", JSON.stringify(out))
	check(
		"recreate-on-next-ensure",
		events.indexOf("create") < events.indexOf("second:start") &&
			events.indexOf("first:start") < events.indexOf("create"),
		events.join(","),
	)
}

if (failures.length > 0) {
	console.error(`check-connection-session: ${failures.length} failing scenario(s): ${failures.join(", ")}`)
	process.exit(1)
}

console.log("check-connection-session: all scenarios pass without an editor.")
