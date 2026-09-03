export async function runCoreProjectMapScenarios(ctx) {
	const {
		runStep,
		callJsonTool,
		callTextTool,
		assert,
		getProjectInfo,
		setProjectInfo,
		getCurrentMapInfo,
		setCurrentMapInfo,
		getProjectFilePath,
		setProjectFilePath,
	} = ctx

	let projectInfo = getProjectInfo()
	let currentMapInfo = getCurrentMapInfo()
	let projectFilePath = getProjectFilePath()

	await runStep("Read project info", async () => {
		projectInfo = await callJsonTool("manage_editor", {
			action: "project_info",
			params: {},
		})
		assert(typeof projectInfo.project_name === "string" && projectInfo.project_name.length > 0, "project_name is missing")
		assert(typeof projectInfo.engine_version === "string" && projectInfo.engine_version.includes("4.25"), "engine_version does not look like UE4.25")
		setProjectInfo(projectInfo)
	})

	await runStep("Read Unreal Engine path through direct tool", async () => {
		const enginePathText = await callTextTool("get_unreal_engine_path")
		assert(
			enginePathText.startsWith("Unreal Engine path: "),
			"get_unreal_engine_path did not return the expected text format",
		)
		assert(
			enginePathText.slice("Unreal Engine path: ".length).trim().length > 0,
			"get_unreal_engine_path returned an empty path",
		)
	})

	await runStep("Read Unreal project path through direct tool", async () => {
		const projectPathText = await callTextTool("get_unreal_project_path")
		assert(
			projectPathText.startsWith("Unreal Project path: "),
			"get_unreal_project_path did not return the expected text format",
		)
		projectFilePath = projectPathText.slice("Unreal Project path: ".length).trim()
		assert(
			projectFilePath.toLowerCase().includes(".uproject"),
			"get_unreal_project_path did not return a .uproject path",
		)
		setProjectFilePath(projectFilePath)
	})

	await runStep("Read Unreal version through direct tool", async () => {
		const versionText = await callTextTool("get_unreal_version")
		assert(
			versionText.startsWith("Unreal version: "),
			"get_unreal_version did not return the expected text format",
		)
		assert(
			versionText.includes("4.25"),
			"get_unreal_version did not report a UE4.25 engine version",
		)
		assert(
			typeof projectInfo.engine_version === "string" &&
				versionText.includes(projectInfo.engine_version),
			"get_unreal_version did not match manage_editor.project_info",
		)
	})

	await runStep("Read current map info", async () => {
		currentMapInfo = await callJsonTool("manage_editor", {
			action: "map_info",
			params: {},
		})
		assert(typeof currentMapInfo.map_name === "string" && currentMapInfo.map_name.length > 0, "map_name is missing")
		assert(Number.isFinite(currentMapInfo.total_actors), "total_actors is missing")
		setCurrentMapInfo(currentMapInfo)
	})

	await runStep("Read current world outliner", async () => {
		const outliner = await callJsonTool("manage_editor", {
			action: "world_outliner",
			params: {},
		})
		assert(Array.isArray(outliner.actors), "world outliner did not return an actor list")
	})

	await runStep("Read map info through manage_level", async () => {
		const levelInfo = await callJsonTool("manage_level", {
			action: "info",
			params: {},
		})
		assert(levelInfo.map_name === currentMapInfo.map_name, "manage_level info returned a different map name")
		assert(Number.isFinite(levelInfo.total_actors), "manage_level info did not return total_actors")
	})

	await runStep("Inspect the current map through manage_inspection", async () => {
		const mapInfo = await callJsonTool("manage_inspection", {
			action: "map",
			params: {},
		})
		assert(mapInfo.map_name === currentMapInfo.map_name, "manage_inspection map returned a different map name")
		assert(Number.isFinite(mapInfo.total_actors), "manage_inspection map did not return total_actors")
	})

	await runStep("Read world outliner through manage_level", async () => {
		const outliner = await callJsonTool("manage_level", {
			action: "world_outliner",
			params: {},
		})
		assert(Array.isArray(outliner.actors), "manage_level world_outliner did not return an actor list")
		assert(Number.isFinite(outliner.total_actors), "manage_level world_outliner did not return total_actors")
	})
}
