export function printHelp() {
	console.log(`Unreal MCP UE4 smoke test runner

Usage:
  node scripts/e2e-smoke.mjs [options]

Options:
  --with-assets         Also test Blueprint and UMG asset creation/cleanup.
  --with-source-control-mutations
                        Exercise safe source-control mutation workflows using temporary files/assets.
                        Implies --with-assets.
  --keep-assets         Keep temporary Blueprint and Widget assets after the run.
  --skip-namespace      Skip the tool-namespace smoke phase.
  --prefix <value>      Prefix used for temporary test actor and asset names.
  --test-root <path>    Unreal content root for temporary test assets. Default: /Game/MCP/Tests.
  --timeout-ms <value>  Timeout for connect/tool calls. Default: 20000.
  --server-entry <path> Path to the built MCP server entry. Default: dist/bin.js.
  --node-path <path>    Node executable used to launch the MCP server. Default: current node.
  --verbose             Print captured server stderr lines while the test runs.
  --help                Show this help text.
`)
}

export function parseArgs(argv, defaults) {
	const options = {
		nodePath: defaults.nodePath,
		prefix: `MCP_E2E_${Date.now()}`,
		testRoot: "/Game/MCP/Tests",
		serverEntry: defaults.serverEntry,
		skipNamespace: false,
		timeoutMs: 20_000,
		verbose: false,
		withAssets: false,
		withSourceControlMutations: false,
		keepAssets: false,
	}

	for (let index = 0; index < argv.length; index += 1) {
		const value = argv[index]

		switch (value) {
			case "--with-assets":
				options.withAssets = true
				break
			case "--with-source-control-mutations":
				options.withSourceControlMutations = true
				options.withAssets = true
				break
			case "--keep-assets":
				options.keepAssets = true
				break
			case "--skip-namespace":
			case "--skip-domain":
				options.skipNamespace = true
				break
			case "--verbose":
				options.verbose = true
				break
			case "--help":
			case "-h":
				options.help = true
				break
			case "--prefix":
				options.prefix = argv[++index]
				break
			case "--test-root":
				options.testRoot = argv[++index]
				break
			case "--timeout-ms":
				options.timeoutMs = Number(argv[++index])
				break
			case "--server-entry":
				options.serverEntry = defaults.resolvePath(argv[++index])
				break
			case "--node-path":
				options.nodePath = defaults.resolvePath(argv[++index])
				break
			default:
				throw new Error(`Unknown argument: ${value}`)
		}
	}

	if (!options.help) {
		if (!options.prefix) {
			throw new Error("--prefix requires a value")
		}

		if (!options.testRoot || !options.testRoot.startsWith("/")) {
			throw new Error("--test-root must be a /Game-style content path")
		}

		if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
			throw new Error("--timeout-ms must be a positive number")
		}
	}

	return options
}
