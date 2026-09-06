import type { ToolCatalogEntry } from "./tool-catalog-types.js"

export const gameplayEntries: ToolCatalogEntry[] = [
	{
		name: "manage_animation_physics",
		category: "Gameplay & Systems Tool Namespaces",
		description:
			"Animation-and-physics tool namespace for physics Blueprint spawning, Blueprint physics settings, and Blueprint compilation actions.",
	},
	{
		name: "manage_input",
		category: "Gameplay & Systems Tool Namespaces",
		description: "Input tool namespace for creating classic UE4 input mappings.",
	},
	{
		name: "manage_behavior_tree",
		category: "Gameplay & Systems Tool Namespaces",
		description: "Behavior-tree tool namespace for creating, searching, and inspecting BehaviorTree assets.",
	},
	{
		name: "manage_gas",
		category: "Gameplay & Systems Tool Namespaces",
		description:
			"GAS tool namespace for searching gameplay-ability-related assets and inspecting their asset metadata.",
	},
]
