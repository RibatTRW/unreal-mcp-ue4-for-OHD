import type { ToolCatalogEntry } from "./tool-catalog-types.js"

export const coreNamespaceEntries: ToolCatalogEntry[] = [
	{
		name: "manage_asset",
		category: "Core Tool Namespaces",
		description: "Asset tool namespace for listing, searching, inspecting, exporting, validating, duplicating, renaming, moving, deleting, saving, and folder-management actions.",
	},
	{
		name: "manage_actor",
		category: "Core Tool Namespaces",
		description: "Actor tool namespace for listing, searching, spawning, deleting, transforming, and inspecting level actors.",
	},
	{
		name: "manage_editor",
		category: "Core Tool Namespaces",
		description: "Editor tool namespace for Python execution, console commands, project inspection, map inspection, PIE control, screenshots, and camera control.",
	},
	{
		name: "manage_level",
		category: "Core Tool Namespaces",
		description: "Level tool namespace for map inspection, actor listing, world outliner inspection, and preset structure creation actions.",
	},
	{
		name: "manage_system",
		category: "Core Tool Namespaces",
		description: "System tool namespace for console commands and asset validation actions.",
	},
	{
		name: "manage_inspection",
		category: "Core Tool Namespaces",
		description: "Inspection tool namespace for asset, actor, map, and basic Blueprint summary actions.",
	},
	{
		name: "manage_tools",
		category: "Core Tool Namespaces",
		description: "Tool-namespace registry for listing registered tool namespaces and describing supported actions. Use this as the discovery entry point for the namespace-first MCP surface.",
	},
	{
		name: "manage_source_control",
		category: "Core Tool Namespaces",
		description: "Source-control tool namespace for provider inspection and file or package source-control operations.",
	},
]
