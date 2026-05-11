export async function runContentWidgetBasicScenarios(state) {
	const {
		logSkip,
		runStep,
		callJsonTool,
		assert,
		isUnsupportedWidgetTreeAuthoring,
		StepSkipError,
		widgetPath,
	} = state

	let widgetAuthoringUnsupportedReason = ""

	await runStep("Create a Widget Blueprint through the tool-namespace layer", async () => {
		const createWidgetResult = await callJsonTool("manage_widget", {
			action: "create_widget_blueprint",
			params: { widget_name: widgetPath },
		})
		assert(
			createWidgetResult.asset_path === widgetPath,
			`Widget Blueprint was created at an unexpected path: ${createWidgetResult.asset_path}`,
		)
	})

	await runStep("Ensure the Widget Blueprint has a Canvas root", async () => {
		const rootResult = await callJsonTool("manage_widget", {
			action: "ensure_canvas_root",
			params: {
				widget_name: widgetPath,
				root_widget_name: "SmokeRootCanvas",
			},
		})
		assert(rootResult.root_widget?.class === "CanvasPanel", "ensure_canvas_root did not report a CanvasPanel root")
		assert(
			rootResult.wrapped_existing_root === false,
			"Fresh Widget Blueprint should not require wrapping an existing non-Canvas root",
		)
	})

	await runStep("Add a TextBlock to the Widget Blueprint", async () => {
		try {
			const textResult = await callJsonTool("manage_widget", {
				action: "add_text_block",
				params: {
					widget_name: widgetPath,
					text_block_name: "SmokeText",
					text: "UE4 smoke test",
					position: { x: 32, y: 32 },
				},
			})
			assert(textResult.widget?.name === "SmokeText", "TextBlock was not added to the widget blueprint")
		} catch (error) {
			if (isUnsupportedWidgetTreeAuthoring(error)) {
				widgetAuthoringUnsupportedReason =
					error instanceof Error ? error.message : "Widget tree authoring is unavailable in this UE4.27 Python environment."
				throw new StepSkipError(widgetAuthoringUnsupportedReason)
			}

			throw error
		}
	})

	if (widgetAuthoringUnsupportedReason) {
		logSkip("Add a Button to the Widget Blueprint", widgetAuthoringUnsupportedReason)
		return { widgetAuthoringUnsupportedReason }
	}

	await runStep("Add a Button to the Widget Blueprint", async () => {
		try {
			const buttonResult = await callJsonTool("manage_widget", {
				action: "add_button",
				params: {
					widget_name: widgetPath,
					button_name: "SmokeButton",
					text: "Smoke",
					position: { x: 32, y: 96 },
				},
			})
			assert(buttonResult.widget?.name === "SmokeButton", "Button was not added to the widget blueprint")
		} catch (error) {
			if (isUnsupportedWidgetTreeAuthoring(error)) {
				widgetAuthoringUnsupportedReason =
					error instanceof Error ? error.message : "Widget tree authoring is unavailable in this UE4.27 Python environment."
				throw new StepSkipError(widgetAuthoringUnsupportedReason)
			}

			throw error
		}
	})

	await runStep("Move the TextBlock through advanced widget tooling", async () => {
		const moveTextResult = await callJsonTool("manage_widget", {
			action: "position_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_name: "SmokeText",
				position: { x: 48, y: 40 },
				z_order: 1,
			},
		})
		assert(
			Math.abs(Number(moveTextResult.layout?.position?.x ?? 0) - 48) < 0.1,
			"Advanced widget move did not update the TextBlock X position",
		)
	})

	await runStep("Move the Button through advanced widget tooling", async () => {
		const moveButtonResult = await callJsonTool("manage_widget", {
			action: "position_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_name: "SmokeButton",
				position: { x: 48, y: 112 },
				z_order: 2,
			},
		})
		assert(
			Math.abs(Number(moveButtonResult.layout?.position?.x ?? 0) - 48) < 0.1,
			"Advanced widget move did not update the Button X position",
		)
	})

	return { widgetAuthoringUnsupportedReason }
}
