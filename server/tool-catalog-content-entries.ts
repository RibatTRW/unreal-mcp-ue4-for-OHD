import type { ToolCatalogEntry } from "./tool-catalog-types.js"

export const contentEntries: ToolCatalogEntry[] = [
	{
		name: "manage_skeleton",
		category: "Content & Authoring Tool Namespaces",
		description: "Skeleton tool namespace for searching Skeleton and SkeletalMesh assets and inspecting their metadata.",
	},
	{
		name: "manage_material",
		category: "Content & Authoring Tool Namespaces",
		description: "Material tool namespace for listing materials, applying them to actors or Blueprints, and tinting them with material instances.",
	},
	{
		name: "manage_texture",
		category: "Content & Authoring Tool Namespaces",
		description: "Texture tool namespace for searching texture assets, importing image files as textures, and reading their asset metadata.",
	},
	{
		name: "manage_data",
		category: "Content & Authoring Tool Namespaces",
		description: "Data tool namespace for searching data assets, creating common data containers, and inspecting their asset metadata.",
	},
	{
		name: "manage_blueprint",
		category: "Content & Authoring Tool Namespaces",
		description: "Blueprint tool namespace for Blueprint creation, component editing, compilation, and basic Blueprint summary actions.",
	},
	{
		name: "manage_sequence",
		category: "Content & Authoring Tool Namespaces",
		description: "Sequence tool namespace for creating, searching, and inspecting LevelSequence assets.",
	},
	{
		name: "manage_audio",
		category: "Content & Authoring Tool Namespaces",
		description: "Audio tool namespace for importing audio files, searching audio assets, and inspecting their asset metadata.",
	},
	{
		name: "manage_widget",
		category: "Content & Authoring Tool Namespaces",
		description: "Widget tool namespace for UMG Blueprint creation, widget-tree edits, CanvasPanel root normalization, and viewport spawning actions. Use add_child_widget for typical nested layout work, and ensure_canvas_root when absolute CanvasPanel positioning is required.",
	},
]
