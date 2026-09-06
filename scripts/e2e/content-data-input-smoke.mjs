export async function runContentDataInputScenarios(state) {
	const {
		fs,
		runStep,
		callJsonTool,
		assert,
		resolveLocalPath,
		setProjectInfo,
		options,
		dataAssetPath,
		dataTablePath,
		stringTablePath,
		inputMappingName,
		originalClassicInputActionCount,
	} = state

	await runStep("Create a DataAsset through the tool-namespace layer", async () => {
		const dataAssetResult = await callJsonTool("manage_data", {
			action: "create_data_asset",
			params: {
				name: dataAssetPath,
				data_asset_class: "DataAsset",
			},
		})
		assert(
			dataAssetResult.asset_path === dataAssetPath,
			`DataAsset was created at an unexpected path: ${dataAssetResult.asset_path}`,
		)
	})

	await runStep("Read the DataAsset metadata", async () => {
		const dataAssetInfo = await callJsonTool("manage_data", {
			action: "asset_info",
			params: { asset_path: dataAssetPath },
		})
		assert(
			Array.isArray(dataAssetInfo) && dataAssetInfo.length === 1,
			"manage_data asset_info did not return one asset record",
		)
		assert(
			dataAssetInfo[0].package === dataAssetPath,
			`manage_data asset_info returned an unexpected asset path: ${dataAssetInfo[0]?.package}`,
		)
	})

	await runStep("Create a DataTable through the tool-namespace layer", async () => {
		const dataTableResult = await callJsonTool("manage_data", {
			action: "create_data_table",
			params: {
				name: dataTablePath,
				row_struct: "/Script/Engine.TableRowBase",
			},
		})
		assert(
			dataTableResult.asset_path === dataTablePath,
			`DataTable was created at an unexpected path: ${dataTableResult.asset_path}`,
		)
		assert(
			String(dataTableResult.row_struct) === "/Script/Engine.TableRowBase",
			`DataTable used an unexpected row struct: ${dataTableResult.row_struct}`,
		)
	})

	await runStep("Create a StringTable through the tool-namespace layer", async () => {
		const stringTableResult = await callJsonTool("manage_data", {
			action: "create_string_table",
			params: {
				name: stringTablePath,
			},
		})
		assert(
			stringTableResult.asset_path === stringTablePath,
			`StringTable was created at an unexpected path: ${stringTableResult.asset_path}`,
		)
	})

	await runStep("Search data assets through manage_data", async () => {
		const dataSearchResult = await callJsonTool("manage_data", {
			action: "search_data_assets",
			params: {
				search_term: options.prefix,
				include_engine: false,
				limit: 20,
			},
		})
		assert(Array.isArray(dataSearchResult.assets), "manage_data search_data_assets did not return an asset list")
		assert(
			dataSearchResult.assets.some(
				(asset) => asset.path === dataAssetPath || asset.path === dataTablePath || asset.path === stringTablePath,
			),
			"manage_data search_data_assets did not find any of the created data assets",
		)
	})

	await runStep("Create a classic input mapping through manage_input", async () => {
		const inputResult = await callJsonTool("manage_input", {
			action: "create_input_mapping",
			params: {
				mapping_name: inputMappingName,
				key: "P",
				input_type: "Action",
			},
		})
		const resolvedConfigPath = resolveLocalPath(inputResult.config_path)
		assert(
			inputResult.mapping_name === inputMappingName,
			"manage_input create_input_mapping returned the wrong mapping name",
		)
		assert(
			typeof resolvedConfigPath === "string" && resolvedConfigPath.endsWith("DefaultInput.ini"),
			"manage_input create_input_mapping did not return DefaultInput.ini",
		)
		assert(
			fs.existsSync(resolvedConfigPath) &&
				fs.readFileSync(resolvedConfigPath, "utf8").includes(inputResult.mapping_line),
			"manage_input create_input_mapping did not write the mapping line to DefaultInput.ini",
		)
	})

	await runStep("Read project info after input mapping creation", async () => {
		let refreshedProjectInfo = null
		for (let attempt = 0; attempt < 10; attempt += 1) {
			refreshedProjectInfo = await callJsonTool("manage_editor", {
				action: "project_info",
				params: {},
			})
			if (
				Array.isArray(refreshedProjectInfo.classic_input_actions) &&
				refreshedProjectInfo.classic_input_actions.includes(inputMappingName)
			) {
				break
			}

			await new Promise((resolve) => setTimeout(resolve, 300))
		}
		assert(
			Array.isArray(refreshedProjectInfo?.classic_input_actions) &&
				refreshedProjectInfo.classic_input_actions.includes(inputMappingName),
			"manage_editor project_info did not report the new classic input mapping",
		)
		assert(
			Number(refreshedProjectInfo?.classic_input_actions_count ?? 0) >= originalClassicInputActionCount + 1,
			"manage_editor project_info did not increase the classic input action count",
		)
		setProjectInfo(refreshedProjectInfo)
	})
}
