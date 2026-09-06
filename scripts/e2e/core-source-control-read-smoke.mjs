export async function runCoreSourceControlReadScenarios(ctx) {
	const { runStep, callJsonTool, assert } = ctx

	await runStep("Read source control provider info", async () => {
		const sourceControlInfo = await callJsonTool("manage_source_control", {
			action: "provider_info",
			params: {},
		})
		assert(typeof sourceControlInfo.provider === "string", "provider is missing")
		assert(typeof sourceControlInfo.enabled === "boolean", "enabled is missing")
		assert(typeof sourceControlInfo.available === "boolean", "available is missing")
	})

	await runStep("Query source control state", async () => {
		const sourceControlState = await callJsonTool("manage_source_control", {
			action: "query_state",
			params: { file: "/Game" },
		})
		assert(typeof sourceControlState.state?.filename === "string", "state filename is missing")
		assert(typeof sourceControlState.state?.is_valid === "boolean", "state validity is missing")
	})

	await runStep("Query source control states in bulk", async () => {
		const sourceControlStates = await callJsonTool("manage_source_control", {
			action: "query_states",
			params: { files: ["/Game", "/Engine/BasicShapes/Cube"] },
		})
		assert(sourceControlStates.count === 2, "manage_source_control query_states did not return the expected count")
		assert(Array.isArray(sourceControlStates.states), "manage_source_control query_states did not return a states list")
		assert(
			sourceControlStates.states.every(
				(state) => typeof state?.filename === "string" && typeof state?.is_valid === "boolean",
			),
			"manage_source_control query_states returned an invalid state entry",
		)
	})
}
