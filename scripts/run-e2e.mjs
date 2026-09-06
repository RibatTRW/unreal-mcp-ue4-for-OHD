#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import process from "node:process"

const wrapperArgs = process.argv.slice(2)
const skipBuild = wrapperArgs.includes("--skip-build") || process.env.UNREAL_MCP_SKIP_BUILD === "1"
const args = wrapperArgs.filter((value) => value !== "--skip-build")
const wantsHelp = args.includes("--help") || args.includes("-h")
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"

function quoteWindowsArg(value) {
	if (!value.length) {
		return '""'
	}

	if (!/[\s"]/u.test(value)) {
		return value
	}

	return `"${value.replace(/"/g, '\\"')}"`
}

function run(command, commandArgs) {
	const result =
		process.platform === "win32" && command.toLowerCase().endsWith(".cmd")
			? spawnSync(
					process.env.ComSpec ?? "cmd.exe",
					["/d", "/s", "/c", [command, ...commandArgs.map(quoteWindowsArg)].join(" ")],
					{ stdio: "inherit" },
				)
			: spawnSync(command, commandArgs, {
					stdio: "inherit",
				})

	if (result.error) {
		throw result.error
	}

	if (typeof result.status === "number" && result.status !== 0) {
		process.exit(result.status)
	}
}

if (!wantsHelp && !skipBuild) {
	run(npmCommand, ["run", "build"])
}

run(process.execPath, ["scripts/e2e-smoke.mjs", ...args])
