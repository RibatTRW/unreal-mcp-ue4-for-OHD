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

export async function runContentWidgetAdvancedScenarios(state) {
	const {
		runStep,
		callJsonTool,
		assert,
		widgetPath,
	} = state
	const rootWidgetName = state.rootWidgetName ?? "CanvasPanel_0"

	await runStep("Add a CanvasPanel through advanced widget tooling", async () => {
		const panelResult = await callJsonTool("manage_widget", {
			action: "add_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_class: "CanvasPanel",
				widget_name: "SmokePanel",
				parent_widget_name: rootWidgetName,
				position: { x: 160, y: 24 },
				size: { x: 320, y: 180 },
			},
		})
		assert(panelResult.widget_name === "SmokePanel", "CanvasPanel was not added through advanced widget tooling")
		assert(
			Math.abs(Number(panelResult.layout?.size?.x ?? 0) - 320) < 0.1,
			"Advanced widget add did not apply the CanvasPanel width",
		)
	})

	await runStep("Move the CanvasPanel through advanced widget tooling", async () => {
		const movePanelResult = await callJsonTool("manage_widget", {
			action: "position_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_name: "SmokePanel",
				position: { x: 196, y: 40 },
				size: { x: 360, y: 200 },
				z_order: 1,
			},
		})
		assert(
			Math.abs(Number(movePanelResult.layout?.position?.x ?? 0) - 196) < 0.1,
			"Advanced widget move did not update the CanvasPanel X position",
		)
		assert(
			Math.abs(Number(movePanelResult.layout?.size?.x ?? 0) - 360) < 0.1,
			"Advanced widget move did not update the CanvasPanel width",
		)
	})

	await runStep("Add a child widget through advanced widget tooling", async () => {
		const childResult = await callJsonTool("manage_widget", {
			action: "add_child_widget",
			params: {
				widget_blueprint_path: widgetPath,
				parent_widget_name: "SmokePanel",
				child_widget_class: "TextBlock",
				child_widget_name: "SmokeChildText",
				text: "Nested child",
				position: { x: 12, y: 18 },
				size: { x: 180, y: 44 },
				font_size: 14,
				color: { r: 1, g: 0.85, b: 0.35, a: 1 },
			},
		})
		assert(childResult.child_widget_name === "SmokeChildText", "Child widget was not added through advanced widget tooling")
		assert(childResult.text === "Nested child", "Advanced child widget add did not apply TextBlock text")
		assert(childResult.style?.font_size === 14, "Advanced child widget add did not apply TextBlock font size")
		assert(
			hasApproxStyleColor(childResult.style, ["color", "foreground_color"], { r: 1, g: 0.85, b: 0.35, a: 1 }),
			"Advanced child widget add did not apply TextBlock color",
		)
		assert(
			Math.abs(Number(childResult.layout?.size?.x ?? 0) - 180) < 0.1,
			"Advanced child widget add did not apply the child width",
		)
	})

	await runStep("Move the child widget through advanced widget tooling", async () => {
		const moveChildResult = await callJsonTool("manage_widget", {
			action: "position_child_widget",
			params: {
				widget_blueprint_path: widgetPath,
				parent_widget_name: "SmokePanel",
				child_widget_name: "SmokeChildText",
				position: { x: 48, y: 72 },
				size: { x: 220, y: 48 },
				z_order: 2,
			},
		})
		assert(
			Math.abs(Number(moveChildResult.layout?.position?.x ?? 0) - 48) < 0.1,
			"Advanced child widget move did not update the expected X position",
		)
		assert(
			Math.abs(Number(moveChildResult.layout?.size?.x ?? 0) - 220) < 0.1,
			"Advanced child widget move did not update the child width",
		)
	})

	await runStep("Reject invalid widget parenting without leaving an orphan widget", async () => {
		let failedAsExpected = false
		try {
			await callJsonTool("manage_widget", {
				action: "add_widget",
				params: {
					widget_blueprint_path: widgetPath,
					widget_class: "Border",
					widget_name: "SmokeOrphanCandidate",
					parent_widget_name: "SmokeChildText",
					position: { x: 0, y: 0 },
				},
			})
		} catch {
			failedAsExpected = true
		}

		assert(failedAsExpected, "Invalid widget parenting unexpectedly succeeded")

		const treeResult = await callJsonTool("manage_widget", {
			action: "inspect_tree",
			params: {
				widget_blueprint_path: widgetPath,
			},
		})
		const widgetNames = new Set((treeResult.widgets ?? []).map((widget) => widget.name))
		assert(!widgetNames.has("SmokeOrphanCandidate"), "Failed widget add left an orphan widget in the tree")
	})

	await runStep("Add a styled Border through advanced widget tooling", async () => {
		const borderResult = await callJsonTool("manage_widget", {
			action: "add_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_class: "Border",
				widget_name: "SmokeBorder",
				parent_widget_name: rootWidgetName,
				position: { x: 24, y: 220 },
				size: { x: 420, y: 96 },
				background_color: { r: 0.1, g: 0.2, b: 0.35, a: 1 },
				z_order: 0,
			},
		})
		assert(borderResult.widget_name === "SmokeBorder", "Styled Border was not added through advanced widget tooling")
		assert(
			Math.abs(Number(borderResult.layout?.size?.x ?? 0) - 420) < 0.1,
			"Styled Border add did not apply the Border width",
		)

		const treeResult = await callJsonTool("manage_widget", {
			action: "inspect_tree",
			params: {
				widget_blueprint_path: widgetPath,
			},
		})
		const borderEntry = (treeResult.widgets ?? []).find((widget) => widget.name === "SmokeBorder")
		assert(
			hasApproxStyleColor(borderEntry?.style, ["background_color", "brush_color", "color"], {
				r: 0.1,
				g: 0.2,
				b: 0.35,
				a: 1,
			}),
			"Styled Border did not report the requested background color",
		)
	})

	await runStep("Reject failed reparent layout without moving the widget", async () => {
		await callJsonTool("manage_widget", {
			action: "add_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_class: "HorizontalBox",
				widget_name: "SmokeHorizontalHost",
				parent_widget_name: rootWidgetName,
				position: { x: 24, y: 336 },
				size: { x: 420, y: 80 },
			},
		})

		let failedAsExpected = false
		try {
			await callJsonTool("manage_widget", {
				action: "reparent_widget",
				params: {
					widget_blueprint_path: widgetPath,
					widget_name: "SmokePanel",
					new_parent_widget_name: "SmokeHorizontalHost",
					position: { x: 8, y: 8 },
				},
			})
		} catch {
			failedAsExpected = true
		}

		assert(failedAsExpected, "Reparent with Canvas-only layout unexpectedly succeeded")

		const treeResult = await callJsonTool("manage_widget", {
			action: "inspect_tree",
			params: {
				widget_blueprint_path: widgetPath,
			},
		})
		const panelEntry = (treeResult.widgets ?? []).find((widget) => widget.name === "SmokePanel")
		assert(
			panelEntry?.parent === rootWidgetName,
			"Failed reparent layout left SmokePanel under the new parent",
		)

		await callJsonTool("manage_widget", {
			action: "remove_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_name: "SmokeHorizontalHost",
			},
		})
	})

	await runStep("Add a second CanvasPanel through advanced widget tooling", async () => {
		const panelResult = await callJsonTool("manage_widget", {
			action: "add_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_class: "CanvasPanel",
				widget_name: "SmokePanelHost",
				parent_widget_name: rootWidgetName,
				position: { x: 320, y: 40 },
			},
		})
		assert(panelResult.widget_name === "SmokePanelHost", "Second CanvasPanel was not added through advanced widget tooling")
	})

	await runStep("Reparent the CanvasPanel through advanced widget tooling", async () => {
		const reparentResult = await callJsonTool("manage_widget", {
			action: "reparent_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_name: "SmokePanel",
				new_parent_widget_name: "SmokePanelHost",
				position: { x: 24, y: 16 },
				size: { x: 280, y: 160 },
				z_order: 3,
			},
		})
		assert(
			reparentResult.old_parent_widget_name === rootWidgetName,
			`Advanced widget reparent reported an unexpected old parent: ${reparentResult.old_parent_widget_name}`,
		)
		assert(
			reparentResult.new_parent_widget_name === "SmokePanelHost",
			"Advanced widget reparent did not report the expected new parent",
		)
		assert(
			Math.abs(Number(reparentResult.layout?.position?.x ?? 0) - 24) < 0.1,
			"Advanced widget reparent did not preserve the requested X position",
		)
		assert(
			Math.abs(Number(reparentResult.layout?.size?.x ?? 0) - 280) < 0.1,
			"Advanced widget reparent did not preserve the requested width",
		)
	})

	await runStep("Remove the child widget through advanced widget tooling", async () => {
		const removeChildResult = await callJsonTool("manage_widget", {
			action: "remove_child_widget",
			params: {
				widget_blueprint_path: widgetPath,
				parent_widget_name: "SmokePanel",
				child_widget_name: "SmokeChildText",
			},
		})
		assert(removeChildResult.child_widget_name === "SmokeChildText", "Child widget was not removed through advanced widget tooling")
	})

	await runStep("Remove the CanvasPanel through advanced widget tooling", async () => {
		const removePanelResult = await callJsonTool("manage_widget", {
			action: "remove_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_name: "SmokePanel",
			},
		})
		assert(removePanelResult.widget_name === "SmokePanel", "CanvasPanel was not removed through advanced widget tooling")
	})

	await runStep("Remove the second CanvasPanel through advanced widget tooling", async () => {
		const removePanelResult = await callJsonTool("manage_widget", {
			action: "remove_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_name: "SmokePanelHost",
			},
		})
		assert(removePanelResult.widget_name === "SmokePanelHost", "Second CanvasPanel was not removed through advanced widget tooling")
	})

	await runStep("Remove the styled Border through advanced widget tooling", async () => {
		const removeBorderResult = await callJsonTool("manage_widget", {
			action: "remove_widget",
			params: {
				widget_blueprint_path: widgetPath,
				widget_name: "SmokeBorder",
			},
		})
		assert(removeBorderResult.widget_name === "SmokeBorder", "Styled Border was not removed through advanced widget tooling")
	})
}
