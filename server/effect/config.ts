// Effect migration — Phase 1 Config env readers (report §5, "Phase 1").
//
// Effect `Config` mirror of the UNREAL_MCP_* readers in
// server/remote-execution.ts (`readStringEnv`/`readIntegerEnv`): same names,
// same defaults, same parsing (trimmed strings; blank → unset; integers via
// parseInt base 10 with fallback on missing AND unparseable).
//
// Pure addition: no caller reads these yet — remote-execution.ts keeps its
// own readers until Phase 2 wires this in — so runtime behavior is unchanged.
// Two notes for Phase 2:
//   - `bindAddressOverride`/`commandAddressOverride` stay `... | undefined`:
//     the network-interface fallback (bind) and the bind→command fallback are
//     composition logic in remote-execution.ts, not Config defaults.
//   - Integer configs fall back (never fail) on unparseable input, matching
//     `readIntegerEnv`; that is why they map over `Config.string` instead of
//     `Config.integer` (whose stricter parse rejects values `parseInt`
//     accepts, e.g. "123abc").

import { Config, Option } from "effect"

import { DEFAULT_RETRY_COUNT, DEFAULT_RETRY_DELAY_MS } from "../connection-session.js"
import {
	DEFAULT_COMMAND_PORT,
	DEFAULT_MULTICAST_ADDRESS,
	DEFAULT_MULTICAST_PORT,
	DEFAULT_MULTICAST_TTL,
} from "../remote-execution.js"

// Mirrors readStringEnv: missing/blank → undefined, else trimmed.
const optionalTrimmedString = (name: string): Config.Config<string | undefined> =>
	Config.map(Config.option(Config.string(name)), (value) => {
		const trimmed = Option.getOrElse(value, () => "").trim()
		return trimmed ? trimmed : undefined
	})

// Mirrors readIntegerEnv: missing/blank/unparseable → fallback.
const integerWithFallback = (name: string, fallback: number): Config.Config<number> =>
	Config.map(Config.option(Config.string(name)), (value) => {
		const raw = Option.getOrElse(value, () => "")
		if (!raw) {
			return fallback
		}
		const parsed = Number.parseInt(raw, 10)
		return Number.isFinite(parsed) ? parsed : fallback
	})

export const bindAddressOverride: Config.Config<string | undefined> = optionalTrimmedString("UNREAL_MCP_BIND_ADDRESS")

export const multicastTtl: Config.Config<number> = integerWithFallback(
	"UNREAL_MCP_MULTICAST_TTL",
	DEFAULT_MULTICAST_TTL,
)

export const multicastAddress: Config.Config<string> = Config.map(
	optionalTrimmedString("UNREAL_MCP_MULTICAST_ADDRESS"),
	(value) => value ?? DEFAULT_MULTICAST_ADDRESS,
)

export const multicastPort: Config.Config<number> = integerWithFallback(
	"UNREAL_MCP_MULTICAST_PORT",
	DEFAULT_MULTICAST_PORT,
)

export const commandAddressOverride: Config.Config<string | undefined> =
	optionalTrimmedString("UNREAL_MCP_COMMAND_ADDRESS")

export const commandPort: Config.Config<number> = integerWithFallback("UNREAL_MCP_COMMAND_PORT", DEFAULT_COMMAND_PORT)

export const retryCount: Config.Config<number> = integerWithFallback("UNREAL_MCP_RETRY_COUNT", DEFAULT_RETRY_COUNT)

export const retryDelayMs: Config.Config<number> = integerWithFallback(
	"UNREAL_MCP_RETRY_DELAY_MS",
	DEFAULT_RETRY_DELAY_MS,
)
