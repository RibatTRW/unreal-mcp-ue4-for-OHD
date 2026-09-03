#!/usr/bin/env node

// Direction gate for the tiered Python prelude (candidate 6): the prelude has
// no Python imports — files couple through concatenation order — so "one-way"
// is a static-maintainability discipline checked here. A tier file may call only
// same-or-lower tiers (text_codec < object_access < asset_resolution); domain
// packages and payload tools above the tiers may call anything and are exempt
// as callers. Duplicate top-level defs (concat shadowing) also fail.
// Fails with file:line hits naming the offending symbol and its owner.
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const scriptsDir = path.join(repoRoot, "server", "editor", "scripts")

// Tier rank: lower number = deeper. Anything not listed is "top" (above all tiers).
const TIERS = { ue_text_codec: 0, ue_object_access: 1, ue_asset_resolution: 2 }

const owners = new Map()
const duplicates = []
function own(name, tier, file) {
	if (owners.has(name)) duplicates.push(`${name}: ${owners.get(name).file} + ${file}`)
	else owners.set(name, { tier, file })
}

for (const dir of fs.readdirSync(scriptsDir).filter((x) => !x.startsWith(".")).sort()) {
	const abs = path.join(scriptsDir, dir)
	if (!fs.statSync(abs).isDirectory()) continue
	const tier = Object.hasOwn(TIERS, dir) ? dir : "top"
	for (const f of fs.readdirSync(abs).filter((x) => x.endsWith(".py")).sort()) {
		const src = fs.readFileSync(path.join(abs, f), "utf8")
		for (const m of src.matchAll(/^def\s+([A-Za-z_][A-Za-z0-9_]*)/gm)) {
			own(m[1], tier, `${dir}/${f}`)
		}
	}
}

// crude strip: comments + triple-quoted + single/double-quoted strings
function strip(src) {
	return src
		.replace(/""".*?"""/gs, '""')
		.replace(/'''.*?'''/gs, "''")
		.replace(/#.*/g, "")
		.replace(/"(?:[^"\\]|\\.)*"/g, '""')
		.replace(/'(?:[^'\\]|\\.)*'/g, "''")
}
const IGNORE = new Set(["import", "from", "def", "class", "return", "None", "True", "False", "self", "unreal"])

const violations = []
for (const dir of Object.keys(TIERS)) {
	const abs = path.join(scriptsDir, dir)
	if (!fs.existsSync(abs)) continue
	for (const f of fs.readdirSync(abs).filter((x) => x.endsWith(".py")).sort()) {
		const src = fs.readFileSync(path.join(abs, f), "utf8")
		const ownDefs = new Set([...src.matchAll(/^def\s+([A-Za-z_][A-Za-z0-9_]*)/gm)].map((m) => m[1]))
		const callerRank = TIERS[dir]
		strip(src)
			.split("\n")
			.forEach((line, i) => {
				// calls only: NAME followed by `(` and NOT preceded by `.`
				// (attribute access like unreal.X.compile_blueprint is not a call
				// into the prelude; bare words would false-positive on locals).
				for (const m of line.matchAll(/(?<![.\w])([A-Za-z_][A-Za-z0-9_]*)\s*(?=\()/g)) {
					const name = m[1]
					if (IGNORE.has(name) || ownDefs.has(name)) continue
					const o = owners.get(name)
					if (!o || o.file === `${dir}/${f}`) continue
					const ownerRank = Object.hasOwn(TIERS, o.tier) ? TIERS[o.tier] : 3
					if (ownerRank > callerRank) {
						violations.push(`${dir}/${f}:${i + 1} ${name} -> ${o.file} [${o.tier}]`)
					}
				}
			})
	}
}

let failed = false
if (duplicates.length > 0) {
	failed = true
	for (const d of duplicates) console.error(`duplicate def (concat shadowing): ${d}`)
}
if (violations.length > 0) {
	failed = true
	for (const v of violations) console.error(`upward prelude reference: ${v}`)
}
if (failed) {
	console.error(`check:compat-direction FAILED (${duplicates.length} duplicates, ${violations.length} upward refs)`)
	process.exit(1)
}
console.log(`check:compat-direction ok (${owners.size} defs, one-way tiers hold)`)
