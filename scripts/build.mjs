import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { syncVersionFromPackageJson } from "./sync-version.mjs"

const rootDir = process.cwd()

// package.json is the single source of truth for the version; regenerate
// server/version.ts and server.json from it before compiling so dist,
// the generated files, and package.json can never drift apart.
syncVersionFromPackageJson()
const distDir = path.join(rootDir, "dist")

try {
	fs.rmSync(distDir, { recursive: true, force: true })
} catch (error) {
	if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
		console.warn(
			`Warning: could not remove ${distDir} before build (${error.code}). Continuing with in-place overwrite.`,
		)
	} else {
		throw error
	}
}

// NOTE: TypeScript 7 ships no compiler API (only the tsc CLI plus an
// unstable preview API), so the build shells out to tsc instead of driving
// a ts.createProgram the way the TS5 build did.
// NOTE: there is no esbuild bundling step in this repo (esbuild is only a
// transitive dev tool via tsx); the emit language level is controlled by
// tsconfig.json. Keep its "target" (es2022) runnable on engines.node (>=18).
// --noEmitOnError preserves the old fail-before-emit behavior: any pre-emit
// diagnostic aborts the build with a nonzero exit instead of writing dist/.
const configPath = path.join(rootDir, "tsconfig.json")
if (!fs.existsSync(configPath)) {
	throw new Error("Could not find tsconfig.json")
}

// Prefer the workspace tsc (node_modules/.bin, also on PATH under npm run);
// fall back to a tsc resolved from PATH for direct node invocations.
const localTsc =
	process.platform === "win32"
		? path.join(rootDir, "node_modules", ".bin", "tsc.cmd")
		: path.join(rootDir, "node_modules", ".bin", "tsc")
const tscCommand = fs.existsSync(localTsc) ? localTsc : "tsc"
execFileSync(tscCommand, ["-p", configPath, "--noEmitOnError"], { stdio: "inherit" })

fs.mkdirSync(path.join(distDir, "editor"), { recursive: true })
fs.cpSync(path.join(rootDir, "server", "editor", "scripts"), path.join(distDir, "editor", "scripts"), {
	recursive: true,
})
// Golden EUW sidebar template (binary .uasset with the On Key Down fix);
// read at runtime by UEUMGSetupSidebarTab for use_template setups.
fs.cpSync(
	path.join(rootDir, "server", "editor", "sidebar-template"),
	path.join(distDir, "editor", "sidebar-template"),
	{ recursive: true },
)
