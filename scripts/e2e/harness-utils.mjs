import fs from "node:fs"
import path from "node:path"

export function fail(message) {
	throw new Error(message)
}

export class ToolFailureError extends Error {
	constructor(message, parsed = undefined) {
		super(message)
		this.name = "ToolFailureError"
		this.parsed = parsed
	}
}

export class StepSkipError extends Error {
	constructor(message) {
		super(message)
		this.name = "StepSkipError"
	}
}

export function assert(condition, message) {
	if (!condition) {
		fail(message)
	}
}

export function withTimeout(promise, timeoutMs, label) {
	let timeoutId
	const timeoutPromise = new Promise((_, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error(`${label} timed out after ${timeoutMs}ms`))
		}, timeoutMs)
	})

	return Promise.race([promise, timeoutPromise]).finally(() => {
		clearTimeout(timeoutId)
	})
}

export function extractTextContent(result) {
	if (!result || !Array.isArray(result.content)) {
		return ""
	}

	return result.content
		.filter((item) => item?.type === "text")
		.map((item) => item.text)
		.join("\n")
		.trim()
}

export function parseToolJson(toolName, result) {
	if (result?.isError) {
		fail(`Tool ${toolName} returned an MCP error: ${extractTextContent(result)}`)
	}

	const text = extractTextContent(result)
	if (!text) {
		fail(`Tool ${toolName} returned no text content`)
	}

	try {
		const parsed = JSON.parse(text)
		if (parsed && typeof parsed === "object") {
			if (parsed.success === false) {
				throw new ToolFailureError(parsed.message ?? `Tool ${toolName} reported success=false`, parsed)
			}

			if (typeof parsed.error === "string" && parsed.error) {
				throw new ToolFailureError(parsed.error, parsed)
			}
		}
		return parsed
	} catch (error) {
		if (error instanceof ToolFailureError) {
			throw error
		}

		fail(`Tool ${toolName} returned non-JSON content: ${text.slice(0, 400)}${text.length > 400 ? "..." : ""}`)
	}
}

export function buildDeleteAssetsPython(assetPaths) {
	return `import json
import unreal
asset_paths = ${JSON.stringify(assetPaths)}
deleted = {}
for asset_path in asset_paths:
    try:
        deleted[asset_path] = bool(unreal.EditorAssetLibrary.delete_asset(asset_path))
    except Exception as exc:
        deleted[asset_path] = str(exc)
print(json.dumps({"success": True, "deleted": deleted}, indent=2))`
}

export function resolveLocalPath(repoRoot, pathValue) {
	if (!pathValue) {
		return ""
	}

	return path.isAbsolute(pathValue) ? pathValue : path.resolve(repoRoot, pathValue)
}

export function projectRepoHasGitRemote(projectDirectory) {
	if (!projectDirectory) {
		return false
	}

	try {
		const gitConfigPath = path.join(projectDirectory, ".git", "config")
		if (!fs.existsSync(gitConfigPath)) {
			return false
		}

		const gitConfigContent = fs.readFileSync(gitConfigPath, "utf8")
		return /\[remote\s+"/.test(gitConfigContent)
	} catch {
		return false
	}
}
