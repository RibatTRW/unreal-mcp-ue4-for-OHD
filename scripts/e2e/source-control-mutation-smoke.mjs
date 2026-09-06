export async function runSourceControlMutationScenarios(ctx, params) {
	const { fs, options, addCleanup, runStep, callJsonTool, assert, safeRevertSourceControlFiles, StepSkipError } = ctx

	const { sourceControlAddAssetPath, sourceControlDataAssetPath, defaultEngineConfigPath, projectHasGitRemote } = params

	addCleanup(`Revert source-control package changes for ${options.prefix}`, () =>
		safeRevertSourceControlFiles([sourceControlAddAssetPath, sourceControlDataAssetPath]),
	)

	await runStep("Confirm source control mutations are available", async () => {
		const providerInfo = await callJsonTool("manage_source_control", {
			action: "provider_info",
			params: {},
		})
		assert(providerInfo.enabled === true, "Source control provider is not enabled for mutation smoke")
		assert(providerInfo.available === true, "Source control provider is not available for mutation smoke")
	})

	await runStep("Query a tracked config file through manage_source_control", async () => {
		assert(fs.existsSync(defaultEngineConfigPath), `Tracked config file not found: ${defaultEngineConfigPath}`)
		const trackedConfigState = await callJsonTool("manage_source_control", {
			action: "query_state",
			params: { file: defaultEngineConfigPath },
		})
		assert(
			trackedConfigState.state?.filename === defaultEngineConfigPath,
			"manage_source_control query_state returned the wrong tracked config path",
		)
		assert(
			typeof trackedConfigState.state?.is_source_controlled === "boolean",
			"manage_source_control query_state did not expose source-control state for the tracked config file",
		)
	})

	await runStep("Check out a tracked config file through manage_source_control", async () => {
		const checkoutResult = await callJsonTool("manage_source_control", {
			action: "checkout",
			params: { files: [defaultEngineConfigPath] },
		})
		assert(
			checkoutResult.file === defaultEngineConfigPath || checkoutResult.files?.includes(defaultEngineConfigPath),
			"manage_source_control checkout did not report the tracked config file",
		)
		assert(checkoutResult.success === true, "manage_source_control checkout did not succeed")
	})

	await runStep("Revert an unchanged tracked config file through manage_source_control", async () => {
		const revertUnchangedResult = await callJsonTool("manage_source_control", {
			action: "revert_unchanged",
			params: { files: [defaultEngineConfigPath] },
		})
		assert(
			revertUnchangedResult.files?.includes(defaultEngineConfigPath),
			"manage_source_control revert_unchanged did not report the tracked config file",
		)
		assert(revertUnchangedResult.success === true, "manage_source_control revert_unchanged did not succeed")
	})

	await runStep("Sync a tracked config file through manage_source_control", async () => {
		if (!projectHasGitRemote) {
			throw new StepSkipError("Project source-control repository does not have a remote configured for sync.")
		}
		const syncResult = await callJsonTool("manage_source_control", {
			action: "sync",
			params: { files: [defaultEngineConfigPath] },
		})
		assert(
			syncResult.file === defaultEngineConfigPath || syncResult.files?.includes(defaultEngineConfigPath),
			"manage_source_control sync did not report the tracked config file",
		)
		assert(syncResult.success === true, "manage_source_control sync did not succeed")
	})

	await runStep("Create a generated DataAsset for source control add smoke", async () => {
		const sourceControlAddAssetResult = await callJsonTool("manage_data", {
			action: "create_data_asset",
			params: {
				name: sourceControlAddAssetPath,
				data_asset_class: "DataAsset",
			},
		})
		assert(
			sourceControlAddAssetResult.asset_path === sourceControlAddAssetPath,
			"Source-control add smoke DataAsset was created at an unexpected path",
		)
	})

	await runStep("Create a generated DataAsset for source control checkout-or-add smoke", async () => {
		const sourceControlAssetResult = await callJsonTool("manage_data", {
			action: "create_data_asset",
			params: {
				name: sourceControlDataAssetPath,
				data_asset_class: "DataAsset",
			},
		})
		assert(
			sourceControlAssetResult.asset_path === sourceControlDataAssetPath,
			"Source-control smoke DataAsset was created at an unexpected path",
		)
	})

	await runStep("Mark a generated asset for add through manage_source_control", async () => {
		const addResult = await callJsonTool("manage_source_control", {
			action: "add",
			params: { files: [sourceControlAddAssetPath] },
		})
		assert(
			addResult.file === sourceControlAddAssetPath || addResult.files?.includes(sourceControlAddAssetPath),
			"manage_source_control add did not report the generated asset package",
		)
	})

	await runStep("Query the generated add asset through manage_source_control", async () => {
		const tempFileState = await callJsonTool("manage_source_control", {
			action: "query_state",
			params: { file: sourceControlAddAssetPath },
		})
		assert(
			typeof tempFileState.state?.filename === "string" && tempFileState.state.filename.length > 0,
			"manage_source_control query_state did not return a filename for the generated add asset",
		)
		assert(
			typeof tempFileState.state?.is_added === "boolean",
			"manage_source_control query_state did not return an is_added flag for the generated add asset",
		)
	})

	await runStep("Revert the generated add asset through manage_source_control", async () => {
		const revertResult = await callJsonTool("manage_source_control", {
			action: "revert",
			params: { files: [sourceControlAddAssetPath] },
		})
		assert(
			revertResult.file === sourceControlAddAssetPath || revertResult.files?.includes(sourceControlAddAssetPath),
			"manage_source_control revert did not report the generated add asset",
		)
	})

	await runStep("Check out or add a generated asset through manage_source_control", async () => {
		const checkoutOrAddResult = await callJsonTool("manage_source_control", {
			action: "checkout_or_add",
			params: { files: [sourceControlDataAssetPath] },
		})
		assert(
			checkoutOrAddResult.file === sourceControlDataAssetPath ||
				checkoutOrAddResult.files?.includes(sourceControlDataAssetPath),
			"manage_source_control checkout_or_add did not report the generated asset package",
		)
	})

	await runStep("Query the generated asset package through manage_source_control", async () => {
		const assetState = await callJsonTool("manage_source_control", {
			action: "query_state",
			params: { file: sourceControlDataAssetPath },
		})
		assert(
			typeof assetState.state?.filename === "string" && assetState.state.filename.length > 0,
			"manage_source_control query_state did not return a filename for the generated asset package",
		)
		assert(
			typeof assetState.state?.can_revert === "boolean",
			"manage_source_control query_state did not return a can_revert flag for the generated asset package",
		)
	})

	await runStep("Revert the generated checkout-or-add asset through manage_source_control", async () => {
		const revertResult = await callJsonTool("manage_source_control", {
			action: "revert",
			params: { files: [sourceControlDataAssetPath] },
		})
		assert(
			revertResult.file === sourceControlDataAssetPath || revertResult.files?.includes(sourceControlDataAssetPath),
			"manage_source_control revert did not report the generated checkout-or-add asset",
		)
	})
}
