function colorChannelMatches(actual, expected) {
	return Math.abs(Number(actual ?? Number.NaN) - expected) < 0.01
}

function hasApproxStyleColor(style, keys, expected) {
	return keys.some((key) => {
		const color = style?.[key]
		return (
			colorChannelMatches(color?.r, expected.r) &&
			colorChannelMatches(color?.g, expected.g) &&
			colorChannelMatches(color?.b, expected.b) &&
			colorChannelMatches(color?.a, expected.a)
		)
	})
}

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

	await runStep("Reject duplicate Widget Blueprint creation with a clear reason", async () => {
		let duplicateReason = ""
		try {
			await callJsonTool("manage_widget", {
				action: "create_widget_blueprint",
				params: { asset_path: widgetPath },
			})
		} catch (error) {
			duplicateReason = String(error?.parsed?.reason ?? error?.message ?? "")
		}
		assert(duplicateReason.includes("asset_already_exists"), "Duplicate Widget Blueprint create did not report asset_already_exists")
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
		assert(rootResult.root_widget?.name === "SmokeRootCanvas", "ensure_canvas_root did not apply the requested root name")
		assert(
			rootResult.wrapped_existing_root === false,
			"Fresh Widget Blueprint should not require wrapping an existing non-Canvas root",
		)
		state.rootWidgetName = rootResult.root_widget.name
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
					font_size: 18,
					color: { r: 0.8, g: 0.9, b: 1, a: 1 },
				},
			})
			assert(textResult.widget?.name === "SmokeText", "TextBlock was not added to the widget blueprint")
		} catch (error) {
			if (isUnsupportedWidgetTreeAuthoring(error)) {
				widgetAuthoringUnsupportedReason =
					error instanceof Error ? error.message : "Widget tree authoring is unavailable in this UE4.25 Python environment."
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
					font_size: 16,
					background_color: { r: 0.1, g: 0.25, b: 0.8, a: 1 },
				},
			})
			assert(buttonResult.widget?.name === "SmokeButton", "Button was not added to the widget blueprint")
		} catch (error) {
			if (isUnsupportedWidgetTreeAuthoring(error)) {
				widgetAuthoringUnsupportedReason =
					error instanceof Error ? error.message : "Widget tree authoring is unavailable in this UE4.25 Python environment."
				throw new StepSkipError(widgetAuthoringUnsupportedReason)
			}

			throw error
		}
	})

	await runStep("Inspect the Widget Blueprint designer tree", async () => {
		const treeResult = await callJsonTool("manage_widget", {
			action: "inspect_tree",
			params: {
				widget_name: widgetPath,
			},
		})
		const widgetEntries = treeResult.widgets ?? []
		const widgetNames = new Set(widgetEntries.map((widget) => widget.name))
		assert(widgetNames.has("SmokeText"), "Widget tree inspection did not include SmokeText")
		assert(widgetNames.has("SmokeButton"), "Widget tree inspection did not include SmokeButton")
		assert(widgetNames.has("SmokeButton_Text"), "Widget tree inspection did not include the button TextBlock")
		const smokeText = widgetEntries.find((widget) => widget.name === "SmokeText")
		const smokeButton = widgetEntries.find((widget) => widget.name === "SmokeButton")
		assert(smokeText?.style?.font_size === 18, "Widget tree inspection did not report SmokeText font size")
		assert(
			hasApproxStyleColor(smokeText?.style, ["color", "foreground_color"], { r: 0.8, g: 0.9, b: 1, a: 1 }),
			"Widget tree inspection did not report SmokeText color",
		)
		assert(smokeButton?.layout?.z_order === 1, "Button default z-order should be above background panels")
	})

	await runStep("Move the TextBlock through advanced widget tooling", async () => {
		const moveTextResult = await callJsonTool("manage_widget", {
			action: "position_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_name: "SmokeText",
				position: { x: 48, y: 40 },
				size: { x: 240, y: 64 },
				z_order: 1,
			},
		})
		assert(
			Math.abs(Number(moveTextResult.layout?.position?.x ?? 0) - 48) < 0.1,
			"Advanced widget move did not update the TextBlock X position",
		)
		assert(
			Math.abs(Number(moveTextResult.layout?.size?.x ?? 0) - 240) < 0.1,
			"Advanced widget move did not update the TextBlock width",
		)
	})

	await runStep("Move the Button through advanced widget tooling", async () => {
		const moveButtonResult = await callJsonTool("manage_widget", {
			action: "position_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_name: "SmokeButton",
				position: { x: 48, y: 112 },
				size: { x: 260, y: 72 },
				z_order: 2,
			},
		})
		assert(
			Math.abs(Number(moveButtonResult.layout?.position?.x ?? 0) - 48) < 0.1,
			"Advanced widget move did not update the Button X position",
		)
		assert(
			Math.abs(Number(moveButtonResult.layout?.size?.x ?? 0) - 260) < 0.1,
			"Advanced widget move did not update the Button width",
		)
	})

	return { widgetAuthoringUnsupportedReason }
}
