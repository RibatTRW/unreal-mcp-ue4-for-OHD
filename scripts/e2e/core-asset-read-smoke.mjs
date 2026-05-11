export async function runCoreAssetReadScenarios(ctx) {
	const {
		runStep,
		callJsonTool,
		assert,
		firstAssetPathFromSearch,
		StepSkipError,
	} = ctx

	await runStep("Search assets through manage_asset", async () => {
		const searchResult = await callJsonTool("manage_asset", {
			action: "search",
			params: {
				search_term: "Cube",
				asset_class: "StaticMesh",
			},
		})
		assert(Array.isArray(searchResult.assets), "manage_asset search did not return an asset list")
		assert(
			searchResult.assets.some((asset) => asset.package_name === "/Engine/BasicShapes/Cube"),
			"manage_asset search did not find /Engine/BasicShapes/Cube",
		)
	})

	await runStep("Read asset info through manage_asset", async () => {
		const assetInfo = await callJsonTool("manage_asset", {
			action: "info",
			params: { asset_path: "/Engine/BasicShapes/Cube" },
		})
		assert(Array.isArray(assetInfo) && assetInfo.length === 1, "manage_asset info did not return one asset record")
		assert(assetInfo[0].package === "/Engine/BasicShapes/Cube", "manage_asset info returned the wrong asset package")
	})

	await runStep("Read asset references through manage_asset", async () => {
		const references = await callJsonTool("manage_asset", {
			action: "references",
			params: { asset_path: "/Engine/BasicShapes/Cube" },
		})
		assert(Array.isArray(references), "manage_asset references did not return an array")
	})

	await runStep("Inspect an asset through manage_inspection", async () => {
		const assetInfo = await callJsonTool("manage_inspection", {
			action: "asset",
			params: { asset_path: "/Engine/BasicShapes/Cube" },
		})
		assert(Array.isArray(assetInfo) && assetInfo.length === 1, "manage_inspection asset did not return one asset record")
		assert(assetInfo[0].package === "/Engine/BasicShapes/Cube", "manage_inspection asset returned the wrong asset package")
	})

	await runStep("Inspect asset references through manage_inspection", async () => {
		const references = await callJsonTool("manage_inspection", {
			action: "asset_references",
			params: { asset_path: "/Engine/BasicShapes/Cube" },
		})
		assert(Array.isArray(references), "manage_inspection asset_references did not return an array")
	})

	let skeletonAssetPath = ""
	await runStep("Search skeleton assets through manage_skeleton", async () => {
		const skeletonSearchResult = await callJsonTool("manage_skeleton", {
			action: "search_skeletons",
			params: { search_term: "" },
		})
		assert(Array.isArray(skeletonSearchResult.assets), "manage_skeleton search_skeletons did not return an asset list")
		skeletonAssetPath = firstAssetPathFromSearch(skeletonSearchResult)
		if (!skeletonAssetPath) {
			throw new StepSkipError("No Skeleton assets were found in the active project or engine content.")
		}
	})

	let skeletalMeshAssetPath = ""
	await runStep("Search skeletal meshes through manage_skeleton", async () => {
		const skeletalMeshSearchResult = await callJsonTool("manage_skeleton", {
			action: "search_skeletal_meshes",
			params: { search_term: "" },
		})
		assert(Array.isArray(skeletalMeshSearchResult.assets), "manage_skeleton search_skeletal_meshes did not return an asset list")
		skeletalMeshAssetPath = firstAssetPathFromSearch(skeletalMeshSearchResult)
		if (!skeletalMeshAssetPath) {
			throw new StepSkipError("No SkeletalMesh assets were found in the active project or engine content.")
		}
	})

	await runStep("Read skeleton-related metadata through manage_skeleton", async () => {
		const skeletonInfoTarget = skeletonAssetPath || skeletalMeshAssetPath
		if (!skeletonInfoTarget) {
			throw new StepSkipError("No Skeleton or SkeletalMesh asset was available for asset_info.")
		}
		const skeletonInfo = await callJsonTool("manage_skeleton", {
			action: "asset_info",
			params: { asset_path: skeletonInfoTarget },
		})
		assert(Array.isArray(skeletonInfo) && skeletonInfo.length === 1, "manage_skeleton asset_info did not return one asset record")
		assert(
			skeletonInfo[0].package === skeletonInfoTarget,
			"manage_skeleton asset_info returned the wrong asset package",
		)
	})

	await runStep("Validate an asset through manage_system", async () => {
		const validationResult = await callJsonTool("manage_system", {
			action: "validate_assets",
			params: { asset_paths: "/Engine/BasicShapes/Cube,/Engine/BasicShapes/Sphere" },
		})
		assert(validationResult.total_validated === 2, "manage_system validate_assets did not parse comma-separated paths")
		assert(
			validationResult.validation_summary?.valid_count === 2,
			"manage_system validate_assets did not mark both engine assets as valid",
		)
	})

	await runStep("Validate an asset through manage_asset", async () => {
		const validationResult = await callJsonTool("manage_asset", {
			action: "validate",
			params: { asset_paths: ["/Engine/BasicShapes/Cube", "/Engine/BasicShapes/Sphere"] },
		})
		assert(validationResult.total_validated === 2, "manage_asset validate did not accept an asset path array")
		assert(
			validationResult.validation_summary?.valid_count === 2,
			"manage_asset validate did not mark both engine assets as valid",
		)
	})
}
