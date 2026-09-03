#!/usr/bin/env node

// 2.7-dialect gate for editor payloads (SPEC section 5): every Python file
// shipped to the OHD editor (embedded Python 2.7.14) must parse under 2.7.
// Fails with file:line hits when py3-only constructs are found.
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const scriptsDir = path.join(repoRoot, "server", "editor", "scripts")

const checks = [
	{ name: "typing import", pattern: /^(import|from)\s+typing\b/ },
	{ name: "pathlib import", pattern: /^(import|from)\s+pathlib\b/ },
	{ name: "f-string literal", pattern: /\bf(['"])/ },
	{ name: "return annotation", pattern: /\)\s*->/ },
	{
		name: "argument annotation",
		pattern: /:\s*(str|int|bool|float|dict|list|Any|Dict|List|Optional|Union)[\[,)=]/,
	},
	{ name: "bare super()", pattern: /\bsuper\(\s*\)/ },
	{ name: "nonlocal", pattern: /^\s*nonlocal\b/ },
	{ name: "yield from", pattern: /\byield\s+from\b/ },
	{ name: "async def", pattern: /^\s*async\s+def\b/ },
	{ name: "walrus operator", pattern: /:=/ },
	{
		name: "os.makedirs exist_ok kwarg is py3-only (use try/except OSError)",
		pattern: /makedirs\([^)]*\bexist_ok\b/,
	},
	{
		name: "bare-context session teardown crashes the editor (pass a world or use stop_pie)",
		pattern: /execute_console_command\(\s*None\s*,\s*['"](quit|disconnect|exit)/i,
	},
	{
		name: "bare str() coerces with ascii on py2 (use unreal_text)",
		pattern: /\bstr\(/,
		allow: [/\bstr\(\s*\)/, /\.decode\(/],
	},
	{
		name: "isinstance with bare str misses unicode on py2 (use _string_types)",
		pattern: /\bisinstance\([^)]*\bstr\b/,
	},
]

function collectPyFiles(dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true })
	const files = []

	for (const entry of entries) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			files.push(...collectPyFiles(full))
		} else if (entry.isFile() && entry.name.endsWith(".py")) {
			files.push(full)
		}
	}

	return files
}

const problems = []
const files = collectPyFiles(scriptsDir)

for (const file of files) {
	const lines = fs.readFileSync(file, "utf8").split(/\r?\n/)
	lines.forEach((line, index) => {
		const stripped = line.trim()
		if (!stripped || stripped.startsWith("#")) {
			return
		}

		for (const check of checks) {
			if (check.pattern.test(line)) {
				if (check.allow && check.allow.some((allowed) => allowed.test(line))) {
					continue
				}
				problems.push(
					`${path.relative(repoRoot, file)}:${index + 1}: ${check.name}: ${stripped.slice(0, 120)}`,
				)
			}
		}
	})
}

if (problems.length > 0) {
	console.error(`py27 gate failed with ${problems.length} hit(s):`)
	for (const problem of problems) {
		console.error(`  ${problem}`)
	}

	process.exit(1)
}

console.log(`py27 gate passed: ${files.length} payload scripts are 2.7-clean.`)
