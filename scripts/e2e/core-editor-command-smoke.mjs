export async function runCoreEditorCommandScenarios(ctx) {
	const { fs, options, addCleanup, runStep, callJsonTool, callTextTool, assert, resolveLocalPath } = ctx

	await runStep("Take an editor screenshot through manage_editor", async () => {
		const screenshotText = (
			await callTextTool("manage_editor", {
				action: "screenshot",
				params: {},
			})
		).trim()
		assert(
			screenshotText.length > 0 && !screenshotText.includes("Failed to take screenshot"),
			"manage_editor screenshot did not return a screenshot path",
		)
		const screenshotPath = resolveLocalPath(screenshotText)
		assert(fs.existsSync(screenshotPath), `manage_editor screenshot did not create a file at ${screenshotPath}`)
		addCleanup(`Delete screenshot ${screenshotPath}`, async () => {
			try {
				fs.unlinkSync(screenshotPath)
			} catch {
				// Best effort only.
			}
		})
	})

	await runStep("Execute Python through manage_editor", async () => {
		const marker = `${options.prefix}_run_python_ok`
		const pythonOutput = (
			await callTextTool("manage_editor", {
				action: "run_python",
				params: {
					code: `print("${marker}")`,
				},
			})
		).trim()
		assert(pythonOutput === marker, `manage_editor run_python returned unexpected output: ${pythonOutput}`)
	})

	const smokeConsoleVariableName = "t.MaxFPS"
	addCleanup(`Reset console variable ${smokeConsoleVariableName}`, async () => {
		try {
			await callJsonTool("manage_editor", {
				action: "console_command",
				params: { command: `${smokeConsoleVariableName} 0` },
			})
		} catch {
			// Best effort only.
		}
	})

	await runStep("Execute a console command through manage_editor", async () => {
		const consoleResult = await callJsonTool("manage_editor", {
			action: "console_command",
			params: { command: `${smokeConsoleVariableName} 87` },
		})
		assert(
			consoleResult.command === `${smokeConsoleVariableName} 87`,
			"manage_editor console_command did not echo the executed command",
		)
	})

	await runStep("Read a console variable through manage_editor", async () => {
		const consoleVariable = await callJsonTool("manage_editor", {
			action: "get_console_variable",
			params: { variable_name: smokeConsoleVariableName },
		})
		assert(
			consoleVariable.variable_name === smokeConsoleVariableName,
			"manage_editor get_console_variable returned the wrong variable name",
		)
		assert(
			Math.abs(Number(consoleVariable.float_value ?? 0) - 87) < 0.5 ||
				Number(consoleVariable.int_value ?? -1) === 87 ||
				String(consoleVariable.string_value ?? "").includes("87"),
			"manage_editor get_console_variable did not report the expected value",
		)
	})

	await runStep("Execute a console command through manage_system", async () => {
		const consoleResult = await callJsonTool("manage_system", {
			action: "console_command",
			params: { command: `${smokeConsoleVariableName} 91` },
		})
		assert(
			consoleResult.command === `${smokeConsoleVariableName} 91`,
			"manage_system console_command did not echo the executed command",
		)
	})

	await runStep("Read a console variable through manage_system", async () => {
		const consoleVariable = await callJsonTool("manage_system", {
			action: "get_console_variable",
			params: { variable_name: smokeConsoleVariableName },
		})
		assert(
			consoleVariable.variable_name === smokeConsoleVariableName,
			"manage_system get_console_variable returned the wrong variable name",
		)
		assert(
			Math.abs(Number(consoleVariable.float_value ?? 0) - 91) < 0.5 ||
				Number(consoleVariable.int_value ?? -1) === 91 ||
				String(consoleVariable.string_value ?? "").includes("91"),
			"manage_system get_console_variable did not report the expected value",
		)
	})

	await runStep("Move the viewport camera through manage_editor", async () => {
		const cameraResult = await callJsonTool("manage_editor", {
			action: "move_camera",
			params: {
				location: { x: 180, y: -420, z: 360 },
				rotation: { pitch: -20, yaw: 35, roll: 0 },
			},
		})
		assert(
			Math.abs(Number(cameraResult.location?.x ?? 0) - 180) < 0.1,
			"manage_editor move_camera did not update the expected X location",
		)
		assert(
			Math.abs(Number(cameraResult.rotation?.yaw ?? 0) - 35) < 0.1,
			"manage_editor move_camera did not update the expected yaw",
		)
	})
}
