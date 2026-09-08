#!/usr/bin/env node

// Phase-2 Effect-service assertions over the BUILT output, driven by
// TestClock (report §4.3): the custom 1.5x backoff timing — including the
// MAX_RETRY_DELAY_MS cap and the anti-doubling check — the Schedule.once
// single stale retry, and the Layer singleton shape. Complements
// scripts/check-connection-session.mjs (which covers the Promise-compat
// boundary with injected fake sleeps plus the composition surface); these
// tests cover the Effect-native timing path (Clock.sleep) that the fakes
// bypass. Fails non-zero on the first broken scenario.
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { Clock, Effect, Fiber, Layer, Option, TestClock, TestContext } from "effect"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const servicePath = path.join(repoRoot, "dist", "effect", "connection-service.js")
const sessionPath = path.join(repoRoot, "dist", "connection-session.js")
const adapterPath = path.join(repoRoot, "dist", "remote-execution.js")

for (const required of [servicePath, sessionPath, adapterPath]) {
	if (!fs.existsSync(required)) {
		console.error("check-connection-session-effect: dist/ is missing — run `npm run build` first.")
		process.exit(2)
	}
}

const require = createRequire(import.meta.url)
const serviceMod = require(servicePath)

const {
	ConnectionSessionService,
	HEALTHY_CONNECTION_HINT_TTL_MS,
	makeConnectionSessionLayer,
	makeConnectionSessionService,
	makeConnectionRetrySchedule,
	runCompatPromise,
	withCompatErrors,
} = serviceMod

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
const withTimeout = (promise, ms, name) =>
	Promise.race([
		promise,
		new Promise((_, reject) => {
			setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms of real time`)), ms)
		}),
	])

// Elapsed VIRTUAL time for a full connect-with-retry cycle through the
// service (Clock.sleep path — no injected fake sleep), measured with
// TestClock so the suite runs in milliseconds of real time. Advances the
// virtual clock one second at a time until the fiber completes, draining
// microtasks between steps, so the total advanced equals the backoff sum
// exactly (a single fixed adjust would always report the adjust amount).
const virtualConnectElapsed = (transport, options = {}) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const fiber = yield* Effect.fork(
				Effect.flatMap(ConnectionSessionService, (service) => service.runCommand("print(1)")),
			)
			let elapsed = 0
			let settled = false
			while (!settled && elapsed < 200000) {
				for (let drain = 0; drain < 25 && !settled; drain += 1) {
					yield* Effect.yieldNow()
					settled = Option.isSome(yield* Fiber.poll(fiber))
				}
				if (!settled) {
					yield* TestClock.adjust("1 second")
					elapsed += 1000
				}
			}
			if (!settled) {
				throw new Error(`connect did not settle after ${elapsed}ms of virtual time`)
			}
			const output = yield* Fiber.join(fiber)
			return { output, elapsed }
		}).pipe(
			Effect.provide(
				Layer.effect(ConnectionSessionService, makeConnectionSessionService({ transport, log: silent, ...options })),
			),
			Effect.provide(TestContext.TestContext),
		),
	)

// 1. Default policy through TestClock: 3 attempts, virtual backoff
// 2000 + 3000 = 5000ms. Doubling (Schedule.exponential) would give 6000.
{
	const transport = new FakeTransport({
		getFirstRemoteNode: [new Error("no editor yet"), new Error("still scanning"), { nodeId: "n" }],
		runCommand: [okRun(lineOut('print("rrmcp:init")')), okRun(lineOut("hello"))],
	})
	const { output, elapsed } = await withTimeout(virtualConnectElapsed(transport), 15000, "backoff-1.5x")
	check("testclock-backoff-1.5x", elapsed === 5000, `elapsed=${elapsed}`)
	check("testclock-backoff-output", output === "hello", JSON.stringify(output))
	check(
		"testclock-three-attempts",
		transport.calls.filter((call) => call === "getFirstRemoteNode").length === 3,
		transport.calls.join(","),
	)
}

// 2. Growth factor: initial 4000, 4 attempts → 4000 + 6000 + 9000 = 19000.
// Doubling would give 4000 + 8000 + 10000(cap of 16000) = 22000.
{
	const transport = new FakeTransport({
		getFirstRemoteNode: [new Error("e1"), new Error("e2"), new Error("e3"), { nodeId: "n" }],
		runCommand: [okRun(lineOut('print("rrmcp:init")')), okRun(lineOut("ok"))],
	})
	const { elapsed } = await withTimeout(
		virtualConnectElapsed(transport, { retryCount: 4, retryDelayMs: 4000 }),
		15000,
		"backoff-growth",
	)
	check("testclock-backoff-growth", elapsed === 19000, `elapsed=${elapsed}`)
}

// 3. Cap: initial 10000 (== MAX), 3 attempts → 10000 + 10000 = 20000.
// Uncapped 1.5x would give 10000 + 15000 = 25000.
{
	const transport = new FakeTransport({
		getFirstRemoteNode: [new Error("e1"), new Error("e2"), { nodeId: "n" }],
		runCommand: [okRun(lineOut('print("rrmcp:init")')), okRun(lineOut("ok"))],
	})
	const { elapsed } = await withTimeout(
		virtualConnectElapsed(transport, { retryCount: 3, retryDelayMs: 10000 }),
		15000,
		"backoff-cap",
	)
	check("testclock-backoff-cap", elapsed === 20000, `elapsed=${elapsed}`)
}

// 4. The schedule directly: attempt timestamps under TestClock must be
// 2000ms and 3000ms apart (not doubling), with exactly 3 attempts.
{
	const timestamps = []
	const flaky = Effect.flatMap(Clock.currentTimeMillis, (now) =>
		Effect.zipRight(
			Effect.sync(() => {
				timestamps.push(now)
			}),
			Effect.fail(new Error("boom")),
		),
	)
	const transport = new FakeTransport()
	const outcome = await withTimeout(
		Effect.runPromise(
			Effect.gen(function* () {
				const fiber = yield* Effect.fork(
					Effect.retry(flaky, makeConnectionRetrySchedule(2000, 3, { transport, log: silent })),
				)
				yield* TestClock.adjust("60 seconds")
				const failure = yield* Effect.flip(Fiber.join(fiber))
				return { failure }
			}).pipe(Effect.provide(TestContext.TestContext)),
		),
		15000,
		"schedule-direct",
	)
	check("schedule-three-attempts", timestamps.length === 3, JSON.stringify(timestamps))
	const gaps = timestamps.slice(1).map((value, index) => value - timestamps[index])
	check("schedule-gaps-1.5x", JSON.stringify(gaps) === JSON.stringify([2000, 3000]), JSON.stringify(gaps))
	check("schedule-surfaces-last", outcome.failure?.message === "boom", String(outcome.failure?.message))
}

// 5. Stale retry through the service Layer is exactly one: two failures
// surface the second error after exactly 2 command calls (no unbounded
// policy), and one failure + success recovers.
{
	const runViaLayer = (transport) =>
		runCompatPromise(
			withCompatErrors(
				Effect.flatMap(ConnectionSessionService, (service) => service.runCommand("print(1)")).pipe(
					Effect.provide(makeConnectionSessionLayer({ transport, log: silent })),
				),
			),
		)
	const failing = new FakeTransport({
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
		await withTimeout(runViaLayer(failing), 15000, "stale-once")
	} catch (error) {
		thrown = error
	}
	check("stale-single-retry-error", thrown?.message === "Command failed with: Error B", String(thrown?.message))
	check(
		"stale-single-retry-count",
		failing.calls.filter((call) => call === "runCommand:print(1)").length === 2,
		failing.calls.join(","),
	)

	const recovering = new FakeTransport({
		initiallyConnected: true,
		runCommand: [new Error("socket died"), okRun(lineOut('print("rrmcp:init")')), okRun(lineOut("back"))],
		getFirstRemoteNode: [{ nodeId: "n2" }],
	})
	check("stale-recovers-via-layer", (await withTimeout(runViaLayer(recovering), 15000, "stale-recover")) === "back")
}

// 6. W2 health hint (report §4 W2): a successful runCommand arms a
// short-lived hint; a second runCommand within the TTL skips discovery
// even when hasCommandConnection flaps false; past the TTL it re-probes;
// a failed ensure never arms the hint (every ensure pays the full retry
// budget, so the absent-editor envelope is unchanged); a failed command
// disarms it so the stale-retry path re-probes and recovers.
{
	let flap = true
	const transport = new FakeTransport({
		hasCommandConnection: () => flap,
		runCommand: [okRun(lineOut("one")), okRun(lineOut("two"))],
	})
	const layer = makeConnectionSessionLayer({ transport, log: silent })
	const outputs = await withTimeout(
		Effect.runPromise(
			Effect.gen(function* () {
				const service = yield* ConnectionSessionService
				const out1 = yield* service.runCommand("print(1)")
				yield* Effect.sync(() => {
					flap = false
				})
				const out2 = yield* service.runCommand("print(2)")
				return [out1, out2]
			}).pipe(Effect.provide(layer), Effect.provide(TestContext.TestContext)),
		),
		15000,
		"hint-skip",
	)
	check("hint-skip-outputs", JSON.stringify(outputs) === JSON.stringify(["one", "two"]), JSON.stringify(outputs))
	check(
		"hint-skip-no-discovery",
		!transport.calls.includes("getFirstRemoteNode"),
		transport.calls.join(","),
	)
}

// 7. Past the TTL the hint expires and the next ensure re-probes.
{
	let flap = true
	const transport = new FakeTransport({
		hasCommandConnection: () => flap,
		runCommand: [okRun(lineOut("one")), okRun(lineOut('print("rrmcp:init")')), okRun(lineOut("two"))],
		getFirstRemoteNode: [{ nodeId: "n2" }],
	})
	const layer = makeConnectionSessionLayer({ transport, log: silent })
	const outputs = await withTimeout(
		Effect.runPromise(
			Effect.gen(function* () {
				const service = yield* ConnectionSessionService
				const out1 = yield* service.runCommand("print(1)")
				yield* Effect.sync(() => {
					flap = false
				})
				yield* TestClock.adjust("6 seconds")
				const out2 = yield* service.runCommand("print(2)")
				return [out1, out2]
			}).pipe(Effect.provide(layer), Effect.provide(TestContext.TestContext)),
		),
		15000,
		"hint-ttl-expiry",
	)
	check(
		"hint-expired-outputs",
		JSON.stringify(outputs) === JSON.stringify(["one", "two"]),
		JSON.stringify(outputs),
	)
	check(
		"hint-expired-reprobes",
		transport.calls.filter((call) => call === "getFirstRemoteNode").length === 1,
		transport.calls.join(","),
	)
}

// 8. A failed ensure never arms the hint: two sequential failing
// runCommands through one service each pay the full 3-attempt budget
// (6 discoveries total) instead of the second fast-pathing.
{
	const transport = new FakeTransport({
		getFirstRemoteNode: [
			new Error("e1"),
			new Error("e2"),
			new Error("e3"),
			new Error("e4"),
			new Error("e5"),
			new Error("e6"),
		],
	})
	const runUntilFailed = (effect) =>
		Effect.gen(function* () {
			const fiber = yield* Effect.fork(Effect.flip(effect))
			let settled = false
			let guard = 0
			while (!settled && guard < 200) {
				for (let drain = 0; drain < 25 && !settled; drain += 1) {
					yield* Effect.yieldNow()
					settled = Option.isSome(yield* Fiber.poll(fiber))
				}
				if (!settled) {
					yield* TestClock.adjust("1 second")
				}
				guard += 1
			}
			if (!settled) {
				throw new Error("connect did not settle")
			}
			return yield* Fiber.join(fiber)
		})
	const layer = makeConnectionSessionLayer({ transport, log: silent })
	const errors = await withTimeout(
		Effect.runPromise(
			Effect.gen(function* () {
				const service = yield* ConnectionSessionService
				const first = yield* runUntilFailed(service.runCommand("print(1)"))
				const second = yield* runUntilFailed(service.runCommand("print(2)"))
				return [first, second]
			}).pipe(Effect.provide(layer), Effect.provide(TestContext.TestContext)),
		),
		15000,
		"hint-never-armed",
	)
	check(
		"hint-failed-ensure-surfaces-last",
		errors[0]?.cause?.message === "e3" && errors[1]?.cause?.message === "e6",
		JSON.stringify(errors.map((error) => error?.cause?.message)),
	)
	check(
		"hint-failed-ensure-full-budget",
		transport.calls.filter((call) => call === "getFirstRemoteNode").length === 6,
		transport.calls.join(","),
	)
}

// 9. A failed command disarms the hint: after one success, a throw on the
// fast path still closes, re-probes once, and recovers on the retry.
{
	let flap = true
	const transport = new FakeTransport({
		hasCommandConnection: () => flap,
		runCommand: [
			okRun(lineOut("one")),
			new Error("socket died"),
			okRun(lineOut('print("rrmcp:init")')),
			okRun(lineOut("recovered")),
		],
		getFirstRemoteNode: [{ nodeId: "n2" }],
	})
	const layer = makeConnectionSessionLayer({ transport, log: silent })
	const outputs = await withTimeout(
		Effect.runPromise(
			Effect.gen(function* () {
				const service = yield* ConnectionSessionService
				const out1 = yield* service.runCommand("print(1)")
				yield* Effect.sync(() => {
					flap = false
				})
				const out2 = yield* service.runCommand("print(2)")
				return [out1, out2]
			}).pipe(Effect.provide(layer), Effect.provide(TestContext.TestContext)),
		),
		15000,
		"hint-disarm",
	)
	check(
		"hint-disarm-recovers",
		JSON.stringify(outputs) === JSON.stringify(["one", "recovered"]),
		JSON.stringify(outputs),
	)
	check(
		"hint-disarm-reprobes-once",
		transport.calls.filter((call) => call === "getFirstRemoteNode").length === 1,
		transport.calls.join(","),
	)
}

if (failures.length > 0) {
	console.error(`check-connection-session-effect: ${failures.length} failing scenario(s): ${failures.join(", ")}`)
	process.exit(1)
}

console.log("check-connection-session-effect: all Effect scenarios pass without an editor.")
