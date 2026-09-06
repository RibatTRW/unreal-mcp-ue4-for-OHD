import { runContentDataInputScenarios } from "./content-data-input-smoke.mjs"
import { runContentTextureExportScenarios } from "./content-texture-export-smoke.mjs"

export async function runContentDataTextureScenarios(state) {
	const { options, blueprintPath, dataAssetPath, dataTablePath, stringTablePath, texturePath, tempTextureFile } = state

	await runContentDataInputScenarios(state)
	await runContentTextureExportScenarios(state)

	if (options.keepAssets) {
		console.log(`[INFO] Kept Blueprint asset: ${blueprintPath}`)
		console.log(`[INFO] Kept DataAsset: ${dataAssetPath}`)
		console.log(`[INFO] Kept DataTable: ${dataTablePath}`)
		console.log(`[INFO] Kept StringTable: ${stringTablePath}`)
		console.log(`[INFO] Kept Texture asset: ${texturePath}`)
		console.log(`[INFO] Kept temp texture file: ${tempTextureFile}`)
	}
}
