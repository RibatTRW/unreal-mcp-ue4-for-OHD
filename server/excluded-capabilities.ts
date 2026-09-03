export interface ExcludedCapabilityInfo {
	affectedSurface: string
	capability: string
	reason: string
}

export const excludedCapabilities: ExcludedCapabilityInfo[] = [
	{
		capability: "Blueprint event-graph event insertion",
		affectedSurface:
			"Related event-node and input-action helpers are excluded from the MCP surface.",
		reason:
			"The current UE4.25 Python environment does not expose reliable event graph access or K2 event reference setup.",
	},
	{
		capability: "Blueprint graph inspection and node search",
		affectedSurface:
			"Graph-analysis, graph-inspection, and node-search helpers are excluded from the MCP surface.",
		reason:
			"The current UE4.25 Python environment does not expose Blueprint graph arrays such as UbergraphPages or FunctionGraphs reliably enough for deterministic inspection.",
	},
	{
		capability: "Low-level Blueprint graph node creation",
		affectedSurface:
			"Generic graph-node helpers and related self or component reference insertion helpers are excluded from the MCP surface.",
		reason:
			"The current UE4.25 Python environment does not expose stable low-level graph node creation or member-reference wiring.",
	},
	{
		capability: "Blueprint function-call node authoring",
		affectedSurface:
			"Function-node helpers that depend on editor graph member-reference setup are excluded from the MCP surface.",
		reason:
			"The current UE4.25 Python environment does not expose reliable function-call node reference setup.",
	},
	{
		capability: "Blueprint variable and function metadata inspection",
		affectedSurface:
			"Variable-detail and function-detail helpers are excluded from the MCP surface.",
		reason:
			"The current UE4.25 Python environment does not expose NewVariables or FunctionGraphs reliably enough for deterministic inspection.",
	},
	{
		capability: "Blueprint variable authoring",
		affectedSurface:
			"Variable-creation helpers are excluded from the MCP surface.",
		reason:
			"BPVariableDescription and EdGraphPinType are not exposed in the current UE4.25 Python environment.",
	},
	{
		capability: "UMG delegate-binding authoring",
		affectedSurface:
			"Widget event-binding and text-binding helpers are excluded from the MCP surface.",
		reason:
			"DelegateEditorBinding is not exposed in the current UE4.25 Python environment.",
	},
]
