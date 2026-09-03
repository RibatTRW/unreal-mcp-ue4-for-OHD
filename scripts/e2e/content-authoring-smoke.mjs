import { runContentBlueprintAnimationScenarios } from "./content-blueprint-animation-smoke.mjs"
import { runContentAssetScenarios } from "./content-asset-smoke.mjs"
import { runContentWidgetPieScenarios } from "./content-widget-pie-smoke.mjs"
import { runSourceControlMutationScenarios } from "./source-control-mutation-smoke.mjs"

export async function runContentAuthoringScenarios(ctx) {
	const {
		fs,
		os,
		path,
		options,
		addCleanup,
		safeDeleteAssets,
		projectRepoHasGitRemote,
		paths: {
			basicShapeMaterialPath,
			actorTintMaterialPath,
			debugTintMaterialPath,
		},
		getProjectInfo,
		getProjectFilePath,
	} = ctx

	const projectInfo = getProjectInfo()
	const projectFilePath = getProjectFilePath()
	const blueprintPath = `${options.testRoot}/BP_${options.prefix}`
	const sequencePath = `${options.testRoot}/LS_${options.prefix}`
	const behaviorTreePath = `${options.testRoot}/BT_${options.prefix}`
	const gasAbilityPath = `${options.testRoot}/GA_${options.prefix}`
	const dataAssetPath = `${options.testRoot}/DA_${options.prefix}`
	const dataTablePath = `${options.testRoot}/DT_${options.prefix}`
	const stringTablePath = `${options.testRoot}/ST_${options.prefix}`
	const texturePath = `${options.testRoot}/T_${options.prefix}`
	const widgetPath = `${options.testRoot}/WBP_${options.prefix}`
	const sourceControlAddAssetPath = `${options.testRoot}/SC_Add_DA_${options.prefix}`
	const sourceControlDataAssetPath = `${options.testRoot}/SC_DA_${options.prefix}`
	const tempTextureFile = path.join(os.tmpdir(), `${options.prefix}_Texture.png`)
	const tempAudioFile = path.join(os.tmpdir(), `${options.prefix}_Audio.wav`)
	const inputMappingName = `${options.prefix}_Action`
	const generatedAssetPaths = [
		widgetPath,
		texturePath,
		blueprintPath,
		sequencePath,
		behaviorTreePath,
		gasAbilityPath,
		dataAssetPath,
		dataTablePath,
		stringTablePath,
		sourceControlAddAssetPath,
		sourceControlDataAssetPath,
		actorTintMaterialPath,
		debugTintMaterialPath,
	]
	const projectDirectoryPath = path.dirname(projectFilePath)
	const defaultInputConfigPath = path.join(projectDirectoryPath, "Config", "DefaultInput.ini")
	const defaultEngineConfigPath = path.join(projectDirectoryPath, "Config", "DefaultEngine.ini")
	const projectHasGitRemote = projectRepoHasGitRemote(projectDirectoryPath)
	const originalDefaultInputConfig = fs.existsSync(defaultInputConfigPath)
		? fs.readFileSync(defaultInputConfigPath, "utf8")
		: null
	const originalClassicInputActionCount = Number(projectInfo.classic_input_actions_count ?? 0)
	const texturePixelBase64 =
		"iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAZSURBVBhXY/jPAEQNIAoO/oMBlEMQMDAAAO2DCXg4buGUAAAAAElFTkSuQmCC"
	fs.writeFileSync(tempTextureFile, Buffer.from(texturePixelBase64, "base64"))

	const createSilenceWavBuffer = (sampleRate = 8000, durationSeconds = 0.1) => {
		const numSamples = Math.max(1, Math.floor(sampleRate * durationSeconds))
		const dataSize = numSamples
		const buffer = Buffer.alloc(44 + dataSize)
		buffer.write("RIFF", 0, "ascii")
		buffer.writeUInt32LE(36 + dataSize, 4)
		buffer.write("WAVE", 8, "ascii")
		buffer.write("fmt ", 12, "ascii")
		buffer.writeUInt32LE(16, 16)
		buffer.writeUInt16LE(1, 20)
		buffer.writeUInt16LE(1, 22)
		buffer.writeUInt32LE(sampleRate, 24)
		buffer.writeUInt32LE(sampleRate, 28)
		buffer.writeUInt16LE(1, 32)
		buffer.writeUInt16LE(8, 34)
		buffer.write("data", 36, "ascii")
		buffer.writeUInt32LE(dataSize, 40)
		buffer.fill(128, 44)
		return buffer
	}

	fs.writeFileSync(tempAudioFile, createSilenceWavBuffer())

	if (!options.keepAssets) {
		addCleanup(
			`Delete assets for ${options.prefix}`,
			() => safeDeleteAssets(generatedAssetPaths),
		)
		addCleanup(`Delete temp image ${tempTextureFile}`, async () => {
			try {
				fs.unlinkSync(tempTextureFile)
			} catch {
				// Best effort only.
			}
		})
		addCleanup(`Delete temp audio ${tempAudioFile}`, async () => {
			try {
				fs.unlinkSync(tempAudioFile)
			} catch {
				// Best effort only.
			}
		})
		addCleanup(`Restore input config ${defaultInputConfigPath}`, async () => {
			try {
				if (originalDefaultInputConfig === null) {
					if (fs.existsSync(defaultInputConfigPath)) {
						fs.unlinkSync(defaultInputConfigPath)
					}
					return
				}

				fs.writeFileSync(defaultInputConfigPath, originalDefaultInputConfig, "utf8")
			} catch {
				// Best effort only.
			}
		})
	}

	const state = {
		...ctx,
		projectInfo,
		projectFilePath,
		blueprintPath,
		sequencePath,
		behaviorTreePath,
		gasAbilityPath,
		dataAssetPath,
		dataTablePath,
		stringTablePath,
		texturePath,
		widgetPath,
		sourceControlAddAssetPath,
		sourceControlDataAssetPath,
		tempTextureFile,
		tempAudioFile,
		inputMappingName,
		generatedAssetPaths,
		defaultEngineConfigPath,
		projectHasGitRemote,
		originalClassicInputActionCount,
		basicShapeMaterialPath,
		resolvedBlueprintMaterialPath: basicShapeMaterialPath,
	}

	await runContentBlueprintAnimationScenarios(state)
	await runContentAssetScenarios(state)
	await runContentWidgetPieScenarios(state)

	if (options.withSourceControlMutations) {
		await runSourceControlMutationScenarios(ctx, {
			sourceControlAddAssetPath,
			sourceControlDataAssetPath,
			defaultEngineConfigPath,
			projectHasGitRemote,
		})
	}
}
