export async function runContentSequenceBehaviorScenarios(state) {
	const { options, runStep, callJsonTool, assert, firstAssetPathFromSearch, sequencePath, behaviorTreePath } = state

	await runStep("Create a LevelSequence through manage_sequence", async () => {
		const sequenceCreateResult = await callJsonTool("manage_sequence", {
			action: "create_sequence",
			params: {
				name: sequencePath,
			},
		})
		assert(
			sequenceCreateResult.asset_path === sequencePath,
			`manage_sequence create_sequence returned an unexpected asset path: ${sequenceCreateResult.asset_path}`,
		)
	})

	await runStep("Search sequence assets through manage_sequence", async () => {
		const sequenceSearchResult = await callJsonTool("manage_sequence", {
			action: "search_sequences",
			params: { search_term: options.prefix },
		})
		assert(Array.isArray(sequenceSearchResult.assets), "manage_sequence search_sequences did not return an asset list")
		assert(
			firstAssetPathFromSearch(sequenceSearchResult) === sequencePath,
			"manage_sequence search_sequences did not find the created LevelSequence",
		)
	})

	await runStep("Read sequence metadata through manage_sequence", async () => {
		const sequenceInfo = await callJsonTool("manage_sequence", {
			action: "sequence_info",
			params: { asset_path: sequencePath },
		})
		assert(
			Array.isArray(sequenceInfo) && sequenceInfo.length === 1,
			"manage_sequence sequence_info did not return one asset record",
		)
		assert(sequenceInfo[0].package === sequencePath, "manage_sequence sequence_info returned the wrong asset package")
	})

	await runStep("Create a BehaviorTree through manage_behavior_tree", async () => {
		const behaviorTreeCreateResult = await callJsonTool("manage_behavior_tree", {
			action: "create_behavior_tree",
			params: {
				name: behaviorTreePath,
			},
		})
		assert(
			behaviorTreeCreateResult.asset_path === behaviorTreePath,
			`manage_behavior_tree create_behavior_tree returned an unexpected asset path: ${behaviorTreeCreateResult.asset_path}`,
		)
	})

	await runStep("Search behavior trees through manage_behavior_tree", async () => {
		const behaviorTreeSearchResult = await callJsonTool("manage_behavior_tree", {
			action: "search_behavior_trees",
			params: { search_term: options.prefix },
		})
		assert(
			Array.isArray(behaviorTreeSearchResult.assets),
			"manage_behavior_tree search_behavior_trees did not return an asset list",
		)
		assert(
			firstAssetPathFromSearch(behaviorTreeSearchResult) === behaviorTreePath,
			"manage_behavior_tree search_behavior_trees did not find the created BehaviorTree",
		)
	})

	await runStep("Search AI assets through manage_behavior_tree", async () => {
		const aiAssetSearchResult = await callJsonTool("manage_behavior_tree", {
			action: "search_ai_assets",
			params: { search_term: options.prefix },
		})
		assert(
			Array.isArray(aiAssetSearchResult.assets),
			"manage_behavior_tree search_ai_assets did not return an asset list",
		)
		assert(
			firstAssetPathFromSearch(aiAssetSearchResult) === behaviorTreePath,
			"manage_behavior_tree search_ai_assets did not find the created BehaviorTree",
		)
	})

	await runStep("Read behavior-tree metadata through manage_behavior_tree", async () => {
		const behaviorTreeInfo = await callJsonTool("manage_behavior_tree", {
			action: "behavior_tree_info",
			params: { asset_path: behaviorTreePath },
		})
		assert(
			Array.isArray(behaviorTreeInfo) && behaviorTreeInfo.length === 1,
			"manage_behavior_tree behavior_tree_info did not return one asset record",
		)
		assert(
			behaviorTreeInfo[0].package === behaviorTreePath,
			"manage_behavior_tree behavior_tree_info returned the wrong asset package",
		)
	})
}
