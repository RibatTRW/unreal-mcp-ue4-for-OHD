#!/usr/bin/env node

// Unreal-free assertion over the TS → Python arg-codec seam. Renders every
// UE* command builder with adversarial values and asserts each embedded arg
// blob base64-decodes to the exact JSON of the input, with no unrendered
// ${...} left behind. Fails if any builder bypasses jsonArg with a raw
// interpolation.
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const toolsDirectPath = path.join(repoRoot, "dist", "editor", "tools-direct.js")
const toolsDomainPath = path.join(repoRoot, "dist", "editor", "tools-domain.js")
const scriptRendererPath = path.join(repoRoot, "dist", "editor", "script-renderer.js")

for (const required of [toolsDirectPath, toolsDomainPath, scriptRendererPath]) {
	if (!fs.existsSync(required)) {
		console.error("check-payload-codec: dist/ is missing — run `npm run build` first.")
		process.exit(2)
	}
}

const require = createRequire(import.meta.url)
const direct = require(toolsDirectPath)
const domain = require(toolsDomainPath)
const { renderEditorScript, jsonArg } = require(scriptRendererPath)
const toolsBasePath = path.join(repoRoot, "dist", "editor", "tools-base.js")
const preludeCachePath = path.join(repoRoot, "dist", "editor", "prelude-cache.js")
const preludeLoaderPath = path.join(repoRoot, "dist", "editor", "prelude-loader.js")
for (const required of [toolsBasePath, preludeCachePath, preludeLoaderPath]) {
	if (!fs.existsSync(required)) {
		console.error("check-payload-codec: dist/ is missing — run `npm run build` first.")
		process.exit(2)
	}
}
const toolsBase = require(toolsBasePath)
const preludeCache = require(preludeCachePath)
const { editorPreludes } = require(preludeLoaderPath)

// Brutal by design: quotes, backslashes, JS-template and Python-quote
// breakage attempts, newlines, non-ascii, and a triple-quote sequence.
const ADV = 'a"b\\c${evil}`tick\nnewline М аセット """triple'

const failures = []

const checkBlobs = (label, rendered, expected) => {
	if (rendered.includes("${")) {
		failures.push(`${label}: rendered payload still contains an unrendered \${...}`)
	}

	const blobs = []
	for (const match of rendered.matchAll(/"""([A-Za-z0-9+/=]+)"""/g)) {
		try {
			blobs.push(JSON.parse(Buffer.from(match[1], "base64").toString("utf8")))
		} catch {
			failures.push(`${label}: embedded blob is not base64(JSON): ${match[1].slice(0, 60)}`)
		}
	}

	if (blobs.length !== expected.length) {
		failures.push(`${label}: expected ${expected.length} codec blob(s), found ${blobs.length}`)
		return
	}

	expected.forEach((want, index) => {
		if (JSON.stringify(blobs[index]) !== JSON.stringify(want)) {
			failures.push(
				`${label}: blob ${index} decoded to ${JSON.stringify(blobs[index])?.slice(0, 120)}, want ${JSON.stringify(want)?.slice(0, 120)}`,
			)
		}
	})
}

const vec = { x: 1.5, y: -2.5, z: 3.25 }
const rot = { pitch: 0, yaw: 90, roll: 0 }
const pos2 = { x: 1, y: 2 }
const size2 = { x: 3, y: 4 }
const rgba = [0, 0, 0, 1]

// Migrated builders: every arg must cross the codec.
checkBlobs("UEGetAssetInfo", direct.UEGetAssetInfo(ADV), [ADV])
checkBlobs("UEGetAssetReferences", direct.UEGetAssetReferences(ADV), [ADV])
checkBlobs(
	"UECreateObject",
	direct.UECreateObject("StaticMeshActor", ADV, vec, rot, { x: 1, y: 1, z: 1 }, { StaticMesh: ADV }),
	["StaticMeshActor", ADV, vec, rot, { x: 1, y: 1, z: 1 }, { StaticMesh: ADV }],
)
checkBlobs("UEUpdateObject", direct.UEUpdateObject(ADV, undefined, undefined, undefined, { Material: ADV }, ""), [
	ADV,
	null,
	null,
	null,
	{ Material: ADV },
	null,
])
checkBlobs("UEDeleteObject", direct.UEDeleteObject(ADV), [ADV])
// A list-literal string still crosses as a string; the delete call site
// (normalize_actor_names) is where it explicitly expands to a list.
checkBlobs("UEDeleteObject.list-string", direct.UEDeleteObject('["A", "B"]'), ['["A", "B"]'])
checkBlobs("UEMoveCamera", direct.UEMoveCamera(vec, rot), [vec, rot])

// Remaining direct builders: already on the codec, locked against regressions.
checkBlobs("UEListAssets", direct.UEListAssets(ADV, true, 5), [ADV, true, 5])
checkBlobs("UEExportAsset", direct.UEExportAsset(ADV, ADV, true), [ADV, ADV, true])
checkBlobs("UEConsoleCommand", direct.UEConsoleCommand(ADV), [ADV])
checkBlobs("UEGetConsoleVariable", direct.UEGetConsoleVariable(ADV), [ADV])
checkBlobs("UESearchAssets", direct.UESearchAssets(ADV, ADV, true, 7), [ADV, ADV, true, 7])
checkBlobs("UEValidateAssets", direct.UEValidateAssets(["/Game/A", ADV]), [["/Game/A", ADV]])
checkBlobs("UEValidateAssets.omitted", direct.UEValidateAssets(undefined), [null])
checkBlobs("UEGetProjectInfo", direct.UEGetProjectInfo(), [])
checkBlobs("UEGetMapInfo", direct.UEGetMapInfo(), [])
checkBlobs("UEGetWorldOutliner", direct.UEGetWorldOutliner(), [])
checkBlobs("UETakeScreenshot", direct.UETakeScreenshot(), [])
checkBlobs("UEUMGAddWidget", direct.UEUMGAddWidget(ADV, ADV, ADV, ADV, pos2, size2, rgba, 5), [
	ADV,
	ADV,
	ADV,
	ADV,
	pos2,
	size2,
	rgba,
	5,
])
checkBlobs("UEUMGRemoveWidget", direct.UEUMGRemoveWidget(ADV, ADV), [ADV, ADV])
checkBlobs("UEUMGSetWidgetPosition", direct.UEUMGSetWidgetPosition(ADV, ADV, pos2, size2, 5), [
	ADV,
	ADV,
	pos2,
	size2,
	5,
])
checkBlobs("UEUMGReparentWidget", direct.UEUMGReparentWidget(ADV, ADV, ADV, pos2, size2, 5), [
	ADV,
	ADV,
	ADV,
	pos2,
	size2,
	5,
])
checkBlobs("UEUMGAddChildWidget", direct.UEUMGAddChildWidget(ADV, ADV, ADV, ADV, pos2, size2, ADV, 14, rgba, rgba, 5), [
	ADV,
	ADV,
	ADV,
	ADV,
	pos2,
	size2,
	ADV,
	14,
	rgba,
	rgba,
	5,
])
checkBlobs("UEUMGRemoveChildWidget", direct.UEUMGRemoveChildWidget(ADV, ADV, ADV), [ADV, ADV, ADV])
checkBlobs("UEUMGSetChildWidgetPosition", direct.UEUMGSetChildWidgetPosition(ADV, ADV, ADV, pos2, size2, 5), [
	ADV,
	ADV,
	ADV,
	pos2,
	size2,
	5,
])

// Domain builders: (operation, args) pairs, all through the codec.
for (const [label, build] of [
	["UEAssetManagementTool", domain.UEAssetManagementTool],
	["UEActorTool", domain.UEActorTool],
	["UEBlueprintTool", domain.UEBlueprintTool],
	["UEBlueprintAnalysisTool", domain.UEBlueprintAnalysisTool],
	["UEProjectTool", domain.UEProjectTool],
	["UEMaterialTool", domain.UEMaterialTool],
	["UETextureTool", domain.UETextureTool],
	["UEUMGTool", domain.UEUMGTool],
	["UESourceControlTool", domain.UESourceControlTool],
	["UEDataTool", domain.UEDataTool],
	["UEContentFactoryTool", domain.UEContentFactoryTool],
	["UESequenceTool", domain.UESequenceTool],
	["UEWorldBuildingTool", domain.UEWorldBuildingTool],
	["UEPIETool", domain.UEPIETool],
]) {
	checkBlobs(label, build("probe_op", { probe_key: ADV }), ["probe_op", { probe_key: ADV }])
}

// Renderer failure path: a withheld required arg throws naming the file and arg.
try {
	renderEditorScript("./scripts/ue_get_asset_info.py", {})
	failures.push("renderEditorScript.withheld-arg: expected a missing-arg throw, rendered clean")
} catch (error) {
	const message = error instanceof Error ? error.message : String(error)
	if (!message.includes("ue_get_asset_info.py") || !message.includes("asset_path")) {
		failures.push(`renderEditorScript.withheld-arg: error names neither file nor arg: ${message.slice(0, 120)}`)
	}
}

// Renderer contract: extra provided values stay ignored.
try {
	const rendered = renderEditorScript("./scripts/ue_get_asset_info.py", {
		asset_path: jsonArg("/Game/A"),
		spare_not_in_template: jsonArg("/Game/B"),
	})
	if (rendered.includes("${")) {
		failures.push("renderEditorScript.extra-var: rendered payload still contains an unrendered ${...}")
	}
} catch (error) {
	failures.push(
		`renderEditorScript.extra-var: extra values must be ignored, threw: ${error instanceof Error ? error.message.slice(0, 120) : String(error).slice(0, 120)}`,
	)
}

// SHIP-S1: cacheable renders carry the same substituted tail behind the
// warm-path shim — the codec blobs inside the tail must decode
// byte-identically to the default path. Each case mirrors its builder
// (same file, vars, extraPrelude, domain-vs-direct) with cacheable on,
// then the shim is split back off and the tail is checked as usual.
const cachedCases = [
	[
		"UESearchAssets.cached",
		"./scripts/ue_search_assets.py",
		{
			search_term: jsonArg(ADV),
			asset_class: jsonArg(ADV),
			include_engine: jsonArg(true),
			limit: jsonArg(7),
		},
		"",
		false,
		[ADV, ADV, true, 7],
	],
	["UEGetAssetInfo.cached", "./scripts/ue_get_asset_info.py", { asset_path: jsonArg(ADV) }, "", false, [ADV]],
]

for (const [label, file, vars, extra, isDomain, expected] of cachedCases) {
	const rendered = isDomain
		? toolsBase.renderDomainScript(file, vars, extra, { cacheable: true })
		: toolsBase.renderScript(file, vars, extra, { cacheable: true })
	if (rendered.includes("${")) {
		failures.push(`${label}: cacheable payload still contains an unrendered \${...}`)
		continue
	}
	let tail
	try {
		;({ tail } = preludeCache.splitCachedScript(rendered))
	} catch (error) {
		failures.push(
			`${label}: splitCachedScript threw: ${error instanceof Error ? error.message.slice(0, 120) : String(error).slice(0, 120)}`,
		)
		continue
	}
	checkBlobs(label, tail, expected)
}

if (failures.length > 0) {
	console.error(`check-payload-codec failed with ${failures.length} failure(s):`)
	for (const failure of failures) {
		console.error(`  ${failure}`)
	}

	process.exit(1)
}

console.log("check-payload-codec passed: all builder args cross the codec intact.")
