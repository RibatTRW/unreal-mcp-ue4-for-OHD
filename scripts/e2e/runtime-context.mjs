import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import {
	assert,
	buildDeleteAssetsPython,
	extractTextContent,
	fail,
	parseToolJson,
	projectRepoHasGitRemote,
	resolveLocalPath,
	StepSkipError,
	ToolFailureError,
	withTimeout,
} from "./harness-utils.mjs"

export function createSmokeRuntime({ options, repoRoot, paths: defaultPaths }) {
	const transport = new StdioClientTransport({
		command: options.nodePath,
		args: [options.serverEntry],
		cwd: repoRoot,
		stderr: "pipe",
	})

	const stderrLines = []
	const client = new Client({
		name: "unreal-mcp-ue4-e2e",
		version: "0.1.0",
	})

	client.onerror = (error) => {
		if (options.verbose) {
			process.stderr.write(`[client] ${error instanceof Error ? error.message : String(error)}\n`)
		}
	}

	if (transport.stderr) {
		transport.stderr.on("data", (chunk) => {
			const text = chunk.toString()
			if (!text) {
				return
			}

			stderrLines.push(...text.split(/\r?\n/).filter(Boolean))
			while (stderrLines.length > 40) {
				stderrLines.shift()
			}

			if (options.verbose) {
				process.stderr.write(`[server] ${text}`)
			}
		})
	}

	const cleanupTasks = []
	const summary = []
	let projectInfo
	let currentMapInfo
	let projectFilePath = ""

	const addCleanup = (name, fn) => {
		cleanupTasks.push({ name, fn })
	}

	const logPass = (name, detail = "") => {
		const suffix = detail ? `: ${detail}` : ""
		console.log(`[PASS] ${name}${suffix}`)
		summary.push({ name, status: "passed", detail })
	}

	const logSkip = (name, detail = "") => {
		const suffix = detail ? `: ${detail}` : ""
		console.log(`[SKIP] ${name}${suffix}`)
		summary.push({ name, status: "skipped", detail })
	}

	const runStep = async (name, fn) => {
		try {
			const result = await fn()
			logPass(name)
			return result
		} catch (error) {
			if (error instanceof StepSkipError) {
				logSkip(name, error.message)
				return undefined
			}

			const message = error instanceof Error ? error.message : String(error)
			console.error(`[FAIL] ${name}: ${message}`)
			summary.push({ name, status: "failed", detail: message })
			throw error
		}
	}

	const callJsonTool = async (toolName, args = {}) => {
		const result = await withTimeout(
			client.callTool({ name: toolName, arguments: args }),
			options.timeoutMs,
			toolName,
		)
		return parseToolJson(toolName, result)
	}

	const callTextTool = async (toolName, args = {}) => {
		const result = await withTimeout(
			client.callTool({ name: toolName, arguments: args }),
			options.timeoutMs,
			toolName,
		)

		if (result?.isError) {
			fail(`Tool ${toolName} returned an MCP error: ${extractTextContent(result)}`)
		}

		const text = extractTextContent(result)
		if (!text) {
			fail(`Tool ${toolName} returned no text content`)
		}

		return text
	}

	const isUnsupportedWidgetTreeAuthoring = (error) => {
		if (error instanceof ToolFailureError) {
			if (error.parsed?.unsupported_capability === "widget_tree_authoring") {
				return true
			}
		}

		return (
			error instanceof Error &&
			error.message.includes("Widget blueprint does not expose an editable widget tree in UE4.25 Python.")
		)
	}

	const isUnsupportedViewportInstantiation = (error) => {
		if (error instanceof ToolFailureError) {
			if (error.parsed?.unsupported_capability === "widget_viewport_instantiation") {
				return true
			}
		}

		return (
			error instanceof Error &&
			error.message.includes("Could not instantiate a UserWidget in this UE4.25 Python environment.")
		)
	}

	const safeDeleteActor = async (actorName) => {
		try {
			await callJsonTool("manage_actor", {
				action: "delete",
				params: { name: actorName },
			})
		} catch {
			// Best effort cleanup only.
		}
	}

	const safeDeleteActors = async (actorNames) => {
		for (const actorName of actorNames) {
			if (typeof actorName !== "string" || !actorName) {
				continue
			}
			await safeDeleteActor(actorName)
		}
	}

	const safeDeleteAssets = async (assetPaths) => {
		if (assetPaths.length === 0) {
			return
		}

		try {
			await callJsonTool("manage_editor", {
				action: "run_python",
				params: { code: buildDeleteAssetsPython(assetPaths) },
			})
		} catch {
			// Best effort cleanup only.
		}
	}

	const safeRevertSourceControlFiles = async (files) => {
		const normalizedFiles = files.filter((file) => typeof file === "string" && file.length > 0)
		if (normalizedFiles.length === 0) {
			return
		}

		try {
			await callJsonTool("manage_source_control", {
				action: "revert",
				params: { files: normalizedFiles },
			})
		} catch {
			// Best effort cleanup only.
		}
	}

	const safeStopPie = async () => {
		try {
			await callJsonTool("manage_editor", {
				action: "stop_pie",
				params: { timeout_seconds: 5, poll_interval: 0.25 },
			})
		} catch {
			// Best effort cleanup only.
		}
	}

	const pollPieStatus = async (expectedRunning, attempts = 30, delayMs = 350) => {
		let latestStatus = null
		for (let attempt = 0; attempt < attempts; attempt += 1) {
			latestStatus = await callJsonTool("manage_editor", {
				action: "is_pie_running",
				params: {},
			})
			if (Boolean(latestStatus?.is_pie_running) === expectedRunning) {
				return latestStatus
			}
			await new Promise((resolve) => setTimeout(resolve, delayMs))
		}
		return latestStatus
	}

	const firstAssetPathFromSearch = (searchResult) => {
		if (!Array.isArray(searchResult?.assets)) {
			return ""
		}

		for (const asset of searchResult.assets) {
			for (const candidate of [
				asset?.package_name,
				asset?.path,
				asset?.asset_path,
				asset?.package,
			]) {
				if (typeof candidate === "string" && candidate.length > 0) {
					return candidate
				}
			}
		}

		return ""
	}

	const ctx = {
		options,
		fs,
		os,
		path,
		addCleanup,
		logSkip,
		runStep,
		callJsonTool,
		callTextTool,
		assert,
		resolveLocalPath: (value) => resolveLocalPath(repoRoot, value),
		safeDeleteActor,
		safeDeleteActors,
		safeDeleteAssets,
		safeStopPie,
		safeRevertSourceControlFiles,
		pollPieStatus,
		isUnsupportedWidgetTreeAuthoring,
		isUnsupportedViewportInstantiation,
		firstAssetPathFromSearch,
		projectRepoHasGitRemote,
		StepSkipError,
		paths: defaultPaths,
		getProjectInfo: () => projectInfo,
		setProjectInfo: (value) => {
			projectInfo = value
		},
		getCurrentMapInfo: () => currentMapInfo,
		setCurrentMapInfo: (value) => {
			currentMapInfo = value
		},
		getProjectFilePath: () => projectFilePath,
		setProjectFilePath: (value) => {
			projectFilePath = value
		},
	}

	const connect = async () => {
		await withTimeout(client.connect(transport), options.timeoutMs, "MCP connect")
	}

	const close = async () => {
		for (const cleanupTask of cleanupTasks.reverse()) {
			try {
				await cleanupTask.fn()
				if (options.verbose) {
					process.stderr.write(`[cleanup] ${cleanupTask.name}\n`)
				}
			} catch {
				// Best effort cleanup only.
			}
		}

		try {
			await transport.close()
		} catch {
			// Ignore close errors during teardown.
		}
	}

	return {
		client,
		ctx,
		stderrLines,
		summary,
		runStep,
		connect,
		close,
	}
}
