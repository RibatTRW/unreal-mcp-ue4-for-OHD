export async function runCoreNamespaceScenarios(ctx) {
	const { options, addCleanup, runStep, callJsonTool, assert, safeDeleteActor } = ctx

	const namespaceActorName = `${options.prefix}_NamespaceActor`
	if (options.skipNamespace) {
		return
	}

	addCleanup(`Delete actor ${namespaceActorName}`, () => safeDeleteActor(namespaceActorName))

	await runStep("Inspect registered tool namespaces", async () => {
		const namespaceInfo = await callJsonTool("manage_tools", { action: "list_namespaces", params: {} })
		assert(Array.isArray(namespaceInfo.namespaces), "manage_tools did not return a tool-namespace list")
		const namespaceNames = new Set(namespaceInfo.namespaces.map((item) => item.tool_namespace))
		for (const requiredNamespace of [
			"manage_actor",
			"manage_asset",
			"manage_data",
			"manage_source_control",
			"manage_widget",
		]) {
			assert(namespaceNames.has(requiredNamespace), `Tool namespace is missing: ${requiredNamespace}`)
		}
	})

	await runStep("Describe a tool namespace through manage_tools", async () => {
		const namespaceDescription = await callJsonTool("manage_tools", {
			action: "describe_namespace",
			params: { tool_name: "manage_material" },
		})
		assert(
			namespaceDescription.tool_namespace === "manage_material",
			"manage_tools describe_namespace returned the wrong namespace",
		)
		assert(
			Array.isArray(namespaceDescription.supported_actions) &&
				namespaceDescription.supported_actions.includes("apply_to_actor"),
			"manage_tools describe_namespace did not include apply_to_actor",
		)
	})

	await runStep("Read tool namespace status through manage_tools", async () => {
		const toolStatus = await callJsonTool("manage_tools", {
			action: "tool_status",
			params: {},
		})
		assert(
			Number.isFinite(toolStatus.tool_namespace_count) && toolStatus.tool_namespace_count >= 20,
			"manage_tools tool_status did not return a namespace count",
		)
		assert(
			Array.isArray(toolStatus.tool_namespaces) && toolStatus.tool_namespaces.includes("manage_widget"),
			"manage_tools tool_status did not include manage_widget",
		)
	})

	await runStep("Read source control provider info through the tool-namespace layer", async () => {
		const providerInfo = await callJsonTool("manage_source_control", {
			action: "provider_info",
			params: {},
		})
		assert(typeof providerInfo.provider === "string", "manage_source_control did not return provider")
		assert(typeof providerInfo.enabled === "boolean", "manage_source_control did not return enabled")
		assert(typeof providerInfo.available === "boolean", "manage_source_control did not return available")
	})

	await runStep("Spawn an actor through the tool-namespace layer", async () => {
		const spawnResult = await callJsonTool("manage_actor", {
			action: "spawn",
			params: {
				type: "StaticMeshActor",
				name: namespaceActorName,
				location: { x: 0, y: 300, z: 150 },
			},
		})
		assert(spawnResult.actor?.label === namespaceActorName, "manage_actor spawn did not create the expected label")
	})

	await runStep("Delete the tool-namespace actor", async () => {
		await callJsonTool("manage_actor", {
			action: "delete",
			params: { name: namespaceActorName },
		})
	})
}
