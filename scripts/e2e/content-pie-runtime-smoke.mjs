export async function runContentPieRuntimeScenarios(state) {
	const {
		runStep,
		callJsonTool,
		assert,
		safeStopPie,
		pollPieStatus,
		widgetPath,
	} = state

	await runStep("Read PIE status through manage_editor", async () => {
		await safeStopPie()
		const pieStatus = await callJsonTool("manage_editor", {
			action: "is_pie_running",
			params: {},
		})
		assert(typeof pieStatus.is_pie_running === "boolean", "manage_editor is_pie_running did not return a boolean status")
		assert(pieStatus.is_pie_running === false, "manage_editor is_pie_running reported PIE before the test started")
	})

	await runStep("Start PIE through manage_editor", async () => {
		const pieStart = await callJsonTool("manage_editor", {
			action: "start_pie",
			params: { timeout_seconds: 10, poll_interval: 0.25 },
		})
		assert(pieStart.success === true, "manage_editor start_pie did not acknowledge the request")
		const pieStatus = await pollPieStatus(true)
		assert(pieStatus?.is_pie_running === true, "manage_editor start_pie did not lead to a running PIE session")
		assert(Number.isFinite(pieStatus?.pie_world_count), "manage_editor is_pie_running did not return pie_world_count")
	})

	await runStep("Add the Widget Blueprint to the viewport", async () => {
		const viewportResult = await callJsonTool("manage_widget", {
			action: "add_to_viewport",
			params: {
				widget_name: widgetPath,
				z_order: 5,
			},
		})
		assert(
			viewportResult.widget_blueprint === widgetPath,
			"manage_widget add_to_viewport returned the wrong widget blueprint path",
		)
		assert(
			typeof viewportResult.widget_class === "string" && viewportResult.widget_class.length > 0,
			"manage_widget add_to_viewport did not return a widget class",
		)
	})

	await runStep("Stop PIE through manage_editor", async () => {
		const pieStop = await callJsonTool("manage_editor", {
			action: "stop_pie",
			params: { timeout_seconds: 10, poll_interval: 0.25 },
		})
		assert(pieStop.success === true, "manage_editor stop_pie did not acknowledge the request")
		const pieStatus = await pollPieStatus(false)
		assert(pieStatus?.is_pie_running === false, "manage_editor stop_pie did not stop the PIE session")
	})

	await runStep("Add the Widget Blueprint to the viewport with auto-start PIE", async () => {
		await safeStopPie()
		let viewportResult
		try {
			viewportResult = await callJsonTool("manage_widget", {
				action: "add_to_viewport",
				params: {
					widget_name: widgetPath,
					z_order: 6,
					start_pie_if_needed: true,
					timeout_seconds: 10,
					poll_interval: 0.25,
				},
			})
		} catch (error) {
			assert(
				error?.parsed?.retry_recommended === true,
				"manage_widget add_to_viewport auto-start did not return a retry recommendation",
			)
		}

		assert(
			(await pollPieStatus(true))?.is_pie_running === true,
			"manage_widget add_to_viewport did not request PIE for auto-start",
		)
		viewportResult = await callJsonTool("manage_widget", {
			action: "add_to_viewport",
			params: {
				widget_name: widgetPath,
				z_order: 6,
			},
		})
		assert(viewportResult.widget_blueprint === widgetPath, "manage_widget add_to_viewport retry returned the wrong widget blueprint path")
		const pieStatus = await pollPieStatus(true)
		assert(pieStatus?.is_pie_running === true, "manage_widget add_to_viewport did not auto-start PIE")
	})

	await runStep("Stop auto-started PIE through manage_editor", async () => {
		const pieStop = await callJsonTool("manage_editor", {
			action: "stop_pie",
			params: { timeout_seconds: 10, poll_interval: 0.25 },
		})
		assert(pieStop.success === true, "manage_editor stop_pie did not acknowledge the auto-start cleanup request")
		const pieStatus = await pollPieStatus(false)
		assert(pieStatus?.is_pie_running === false, "manage_editor stop_pie did not stop auto-started PIE")
	})
}
