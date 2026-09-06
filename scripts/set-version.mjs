#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"

// package.json is the single source of truth for the version.
// This script updates package.json (and the npm lockfile) only;
// server/version.ts and server.json are regenerated from package.json
// by `npm run build` (scripts/sync-version.mjs). Do not edit them by hand.
const repoRoot = process.cwd()
const packageJsonPath = path.join(repoRoot, "package.json")
const packageLockPath = path.join(repoRoot, "package-lock.json")

const requestedVersion = process.argv[2]

if (!requestedVersion) {
	console.error("Usage: node scripts/set-version.mjs <YYYY.M.D-N>")
	process.exit(1)
}

function normalizeVersion(version) {
	const semverPattern = /^(\d{4})\.(\d{1,2})\.(\d{1,2})-(\d+)$/
	const legacyPattern = /^(\d{4})\.(\d{2})\.(\d{2})\.(\d+)$/
	const semverMatch = version.match(semverPattern)
	if (semverMatch) {
		const [, year, month, day, count] = semverMatch
		return `${Number(year)}.${Number(month)}.${Number(day)}-${Number(count)}`
	}
	const legacyMatch = version.match(legacyPattern)
	if (legacyMatch) {
		const [, year, month, day, count] = legacyMatch
		return `${Number(year)}.${Number(month)}.${Number(day)}-${Number(count)}`
	}
	return null
}

const nextVersion = normalizeVersion(requestedVersion)

if (!nextVersion) {
	console.error(`Invalid version format: ${requestedVersion}`)
	console.error("Expected format: YYYY.M.D-N")
	console.error("Legacy input format YYYY.MM.DD.N is also accepted and normalized.")
	process.exit(1)
}

// Surgical text replacement (instead of a JSON round-trip) so biome's
// compact-array formatting of package.json is preserved.
const packageJsonText = fs.readFileSync(packageJsonPath, "utf8")
const oldVersion = JSON.parse(packageJsonText).version
const versionPattern = new RegExp(`("version":\\s*")${oldVersion.replace(/[.\-]/g, "\\$&")}(")`)
if (!versionPattern.test(packageJsonText)) {
	console.error(`Could not locate "version": "${oldVersion}" in ${packageJsonPath}`)
	process.exit(1)
}
fs.writeFileSync(packageJsonPath, packageJsonText.replace(versionPattern, `$1${nextVersion}$2`))

if (fs.existsSync(packageLockPath)) {
	const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"))
	packageLock.version = nextVersion
	if (packageLock.packages?.[""]) {
		packageLock.packages[""].version = nextVersion
	}
	fs.writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`)
}

console.log(`Updated project version to ${nextVersion}`)
console.log("Run `npm run build` to regenerate server/version.ts and server.json.")
