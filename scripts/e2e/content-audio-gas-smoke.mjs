export async function runContentAudioGasScenarios(state) {
	const {
		path,
		options,
		runStep,
		callJsonTool,
		assert,
		firstAssetPathFromSearch,
		StepSkipError,
		gasAbilityPath,
		tempAudioFile,
		generatedAssetPaths,
	} = state

	let importedAudioCuePath = ""
	await runStep("Import audio through manage_audio", async () => {
		const audioImportResult = await callJsonTool("manage_audio", {
			action: "import_audio",
			params: {
				source_file: tempAudioFile,
				destination_path: options.testRoot,
				asset_name: `A_${options.prefix}`,
				auto_create_cue: true,
				cue_suffix: "_Cue",
			},
		})
		assert(
			typeof audioImportResult.sound_wave_path === "string" &&
				audioImportResult.sound_wave_path.includes(`${options.testRoot}/A_${options.prefix}`),
			"manage_audio import_audio did not return the expected SoundWave path",
		)
		assert(
			typeof audioImportResult.sound_cue_path === "string" &&
				audioImportResult.sound_cue_path.endsWith(`A_${options.prefix}_Cue`),
			"manage_audio import_audio did not return the expected SoundCue path",
		)
		importedAudioCuePath = audioImportResult.sound_cue_path
		for (const importedAssetPath of [
			audioImportResult.sound_wave_path,
			audioImportResult.sound_cue_path,
		]) {
			if (
				typeof importedAssetPath === "string" &&
				importedAssetPath.length > 0 &&
				!generatedAssetPaths.includes(importedAssetPath)
			) {
				generatedAssetPaths.push(importedAssetPath)
			}
		}
	})

	await runStep("Search audio assets through manage_audio", async () => {
		const audioSearchResult = await callJsonTool("manage_audio", {
			action: "search_audio_assets",
			params: { search_term: options.prefix },
		})
		assert(Array.isArray(audioSearchResult.assets), "manage_audio search_audio_assets did not return an asset list")
		assert(
			firstAssetPathFromSearch(audioSearchResult) === importedAudioCuePath,
			"manage_audio search_audio_assets did not find the imported SoundCue",
		)
	})

	await runStep("Read audio metadata through manage_audio", async () => {
		const audioInfo = await callJsonTool("manage_audio", {
			action: "audio_info",
			params: { asset_path: importedAudioCuePath },
		})
		assert(Array.isArray(audioInfo) && audioInfo.length === 1, "manage_audio audio_info did not return one asset record")
		assert(
			audioInfo[0].package === importedAudioCuePath,
			"manage_audio audio_info returned the wrong asset package",
		)
	})

	let gasAbilityCreated = false
	await runStep("Create a GameplayAbility Blueprint for GAS smoke coverage", async () => {
		try {
			const gasBlueprintCreateResult = await callJsonTool("manage_blueprint", {
				action: "create_blueprint",
				params: {
					name: gasAbilityPath,
					parent_class: "/Script/GameplayAbilities.GameplayAbility",
				},
			})
			assert(
				gasBlueprintCreateResult.asset_path === gasAbilityPath,
				`GameplayAbility Blueprint was created at an unexpected path: ${gasBlueprintCreateResult.asset_path}`,
			)
			gasAbilityCreated = true
		} catch (error) {
			throw new StepSkipError(
				error instanceof Error
					? error.message
					: "GameplayAbility Blueprint creation is unavailable in this project or engine configuration.",
			)
		}
	})

	await runStep("Search GAS assets through manage_gas", async () => {
		if (!gasAbilityCreated) {
			throw new StepSkipError("GameplayAbility Blueprint creation is unavailable in this project or engine configuration.")
		}
		const gasSearchResult = await callJsonTool("manage_gas", {
			action: "search_gas_assets",
			params: { search_term: `GA_${options.prefix}` },
		})
		assert(Array.isArray(gasSearchResult.assets), "manage_gas search_gas_assets did not return an asset list")
		assert(
			firstAssetPathFromSearch(gasSearchResult) === gasAbilityPath,
			"manage_gas search_gas_assets did not find the created GameplayAbility Blueprint",
		)
	})

	await runStep("Read GAS asset metadata through manage_gas", async () => {
		if (!gasAbilityCreated) {
			throw new StepSkipError("GameplayAbility Blueprint creation is unavailable in this project or engine configuration.")
		}
		const gasAssetInfo = await callJsonTool("manage_gas", {
			action: "asset_info",
			params: { asset_path: gasAbilityPath },
		})
		assert(Array.isArray(gasAssetInfo) && gasAssetInfo.length === 1, "manage_gas asset_info did not return one asset record")
		assert(
			gasAssetInfo[0].package === gasAbilityPath,
			"manage_gas asset_info returned the wrong asset package",
		)
	})
}
