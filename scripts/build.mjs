import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const rootDir = process.cwd()
const distDir = path.join(rootDir, "dist")
const serverDir = path.join(rootDir, "server")

try {
	fs.rmSync(distDir, { recursive: true, force: true })
} catch (error) {
	if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
		console.warn(`Warning: could not remove ${distDir} before build (${error.code}). Continuing with in-place overwrite.`)
	} else {
		throw error
	}
}

const formatDiagnostic = (diagnostic) =>
	ts.formatDiagnosticsWithColorAndContext([diagnostic], {
		getCanonicalFileName: (fileName) => fileName,
		getCurrentDirectory: () => rootDir,
		getNewLine: () => "\n",
	})

const failWithDiagnostics = (diagnostics) => {
	if (!diagnostics.length) {
		return
	}

	const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
		getCanonicalFileName: (fileName) => fileName,
		getCurrentDirectory: () => rootDir,
		getNewLine: () => "\n",
	})
	throw new Error(formatted)
}

const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, "tsconfig.json")
if (!configPath) {
	throw new Error("Could not find tsconfig.json")
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
if (configFile.error) {
	throw new Error(formatDiagnostic(configFile.error))
}

const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath))
failWithDiagnostics(parsedConfig.errors ?? [])

const compilerOptions = {
	...parsedConfig.options,
	module: ts.ModuleKind.CommonJS,
	outDir: distDir,
	rootDir: serverDir,
	target: ts.ScriptTarget.ES2018,
}

const program = ts.createProgram({
	options: compilerOptions,
	rootNames: parsedConfig.fileNames,
})

failWithDiagnostics(ts.getPreEmitDiagnostics(program))

const emitResult = program.emit()
failWithDiagnostics(emitResult.diagnostics ?? [])

fs.mkdirSync(path.join(distDir, "editor"), { recursive: true })
fs.cpSync(
	path.join(rootDir, "server", "editor", "scripts"),
	path.join(distDir, "editor", "scripts"),
	{ recursive: true },
)
// Golden EUW sidebar template (binary .uasset with the On Key Down fix);
// read at runtime by UEUMGSetupSidebarTab for use_template setups.
fs.cpSync(
	path.join(rootDir, "server", "editor", "sidebar-template"),
	path.join(distDir, "editor", "sidebar-template"),
	{ recursive: true },
)
