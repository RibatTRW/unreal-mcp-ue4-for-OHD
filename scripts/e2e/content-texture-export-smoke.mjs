export async function runContentTextureExportScenarios(state) {
	const {
		fs,
		os,
		path,
		options,
		addCleanup,
		runStep,
		callJsonTool,
		assert,
		resolveLocalPath,
		firstAssetPathFromSearch,
		texturePath,
		blueprintPath,
		tempTextureFile,
	} = state

	await runStep("Import a Texture through the tool-namespace layer", async () => {
		const textureImportResult = await callJsonTool("manage_texture", {
			action: "import_texture",
			params: {
				source_file: tempTextureFile,
				destination_path: "/Game/MCP/Tests",
				asset_name: path.basename(texturePath),
			},
		})
		assert(
			textureImportResult.asset_path === texturePath,
			`Texture was imported at an unexpected path: ${textureImportResult.asset_path}`,
		)
	})

	await runStep("Read the Texture metadata", async () => {
		const textureInfo = await callJsonTool("manage_texture", {
			action: "texture_info",
			params: { asset_path: texturePath },
		})
		assert(Array.isArray(textureInfo) && textureInfo.length === 1, "manage_texture texture_info did not return one asset record")
		assert(
			textureInfo[0].package === texturePath,
			`manage_texture texture_info returned an unexpected asset path: ${textureInfo[0]?.package}`,
		)
	})

	await runStep("Search textures through manage_texture", async () => {
		const textureSearchResult = await callJsonTool("manage_texture", {
			action: "search_textures",
			params: {
				search_term: options.prefix,
				include_engine: false,
				limit: 20,
			},
		})
		assert(Array.isArray(textureSearchResult.assets), "manage_texture search_textures did not return an asset list")
		assert(
			firstAssetPathFromSearch(textureSearchResult) === texturePath,
			"manage_texture search_textures did not find the imported texture",
		)
	})

	await runStep("List generated assets through manage_asset", async () => {
		const listedAssets = await callJsonTool("manage_asset", {
			action: "list",
			params: {
				root_path: "/Game/MCP/Tests",
				recursive: true,
				limit: 500,
			},
		})
		assert(listedAssets.root_path === "/Game/MCP/Tests", "manage_asset list returned the wrong root path")
		assert(Array.isArray(listedAssets.assets), "manage_asset list did not return an assets list")
		assert(
			listedAssets.assets.some(
				(assetPath) =>
					assetPath === blueprintPath || String(assetPath).startsWith(`${blueprintPath}.`),
			)
				&& listedAssets.assets.some(
					(assetPath) =>
						assetPath === texturePath || String(assetPath).startsWith(`${texturePath}.`),
				),
			"manage_asset list did not include the expected generated assets",
		)
	})

	const exportedTextureFile = path.join(os.tmpdir(), `${options.prefix}_TextureExport.tga`)
	if (!options.keepAssets) {
		addCleanup(`Delete exported asset ${exportedTextureFile}`, async () => {
			try {
				fs.unlinkSync(exportedTextureFile)
			} catch {
				// Best effort only.
			}
		})
	}

	await runStep("Export a generated asset through manage_asset", async () => {
		const exportResult = await callJsonTool("manage_asset", {
			action: "export",
			params: {
				asset_path: texturePath,
				destination_path: exportedTextureFile,
				overwrite: true,
			},
		})
		assert(
			resolveLocalPath(exportResult.exported_file) === exportedTextureFile,
			"manage_asset export returned the wrong destination path",
		)
		assert(
			fs.existsSync(exportedTextureFile) && fs.statSync(exportedTextureFile).size > 0,
			"manage_asset export did not create a non-empty exported file",
		)
	})
}
