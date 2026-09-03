#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { printHelp, parseArgs } from "./e2e/cli-options.mjs"
import { runContentAuthoringScenarios } from "./e2e/content-authoring-smoke.mjs"
import { runCoreScenarios } from "./e2e/core-smoke.mjs"
import { assert } from "./e2e/harness-utils.mjs"
import { createSmokeRuntime } from "./e2e/runtime-context.mjs"
import { runWorldActorScenarios } from "./e2e/world-actors-smoke.mjs"
import { runWorldPresetScenarios } from "./e2e/world-presets-smoke.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const defaultServerEntry = path.join(repoRoot, "dist", "bin.js")

async function main() {
	const options = parseArgs(process.argv.slice(2), {
		nodePath: process.execPath,
		serverEntry: defaultServerEntry,
		resolvePath: (value) => path.resolve(value),
	})
	if (options.help) {
		printHelp()
		return
	}

	if (!fs.existsSync(options.serverEntry)) {
		fail(
			`Built MCP server entry not found at ${options.serverEntry}. Run "npm run build" first.`,
		)
	}

	const runtime = createSmokeRuntime({
		options,
		repoRoot,
		paths: {
			basicShapeMaterialPath: "/Engine/BasicShapes/BasicShapeMaterial",
			tintableMaterialPath: "/Engine/EngineMaterials/EmissiveMeshMaterial",
			actorTintMaterialPath: `${options.testRoot}/MI_${options.prefix}_ActorTint`,
			debugTintMaterialPath: `${options.testRoot}/MI_${options.prefix}_DebugTint`,
		},
	})

	const { client, ctx, stderrLines, summary, runStep, connect, close } = runtime

	try {
		await runStep("Connect to Unreal MCP server", async () => {
			await connect()
		})
		ctx.addCleanup("Ensure PIE is stopped", () => ctx.safeStopPie())

		const toolsResult = await runStep("List registered MCP tools", async () => client.listTools())
		const toolNames = new Set(toolsResult.tools.map((tool) => tool.name))
		const requiredTools = [
			"get_unreal_engine_path",
			"get_unreal_project_path",
			"get_unreal_version",
			"manage_asset",
			"manage_editor",
			"manage_actor",
			"manage_level",
			"manage_inspection",
			"manage_lighting",
			"manage_navigation",
			"manage_volumes",
			"manage_effect",
			"manage_splines",
			"manage_level_structure",
			"manage_environment",
			"manage_geometry",
			"manage_material",
			"manage_data",
			"manage_sequence",
			"manage_audio",
			"manage_skeleton",
			"manage_behavior_tree",
			"manage_gas",
			"manage_source_control",
			"manage_system",
			"manage_tools",
		]

		if (options.withAssets) {
			requiredTools.push(
				"manage_animation_physics",
				"manage_blueprint",
				"manage_input",
				"manage_material",
				"manage_texture",
				"manage_widget",
			)
		}

		await runStep("Verify required tool names are exposed", async () => {
			const missingTools = requiredTools.filter((toolName) => !toolNames.has(toolName))
			assert(missingTools.length === 0, `Missing expected tools: ${missingTools.join(", ")}`)
		})

		await runCoreScenarios(ctx)

		await runWorldActorScenarios(ctx)
		await runWorldPresetScenarios(ctx)

		if (options.withAssets) {
			await runContentAuthoringScenarios(ctx)
		}

		console.log("")
		const skippedChecks = summary.filter((item) => item.status === "skipped").length
		const skipSuffix = skippedChecks > 0 ? ` (${skippedChecks} skipped)` : ""
		console.log(`Smoke test completed successfully with ${summary.length} checks${skipSuffix}.`)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error("")
		console.error(`Smoke test failed: ${message}`)
		if (stderrLines.length > 0) {
			console.error("")
			console.error("Recent server stderr:")
			for (const line of stderrLines.slice(-20)) {
				console.error(`  ${line}`)
			}
		}
		process.exitCode = 1
	} finally {
		await close()
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error(`Smoke runner crashed: ${message}`)
	process.exit(1)
})
