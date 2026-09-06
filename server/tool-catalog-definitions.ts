import { categoryOrder } from "./tool-catalog-categories.js"
import { type ToolCatalogEntry, toolCatalogEntries } from "./tool-catalog-entry-data.js"
import { fallbackToolDescription } from "./tool-catalog-types.js"

export { categoryOrder, toolCatalogEntries, type ToolCatalogEntry }

export const toolCatalog = Object.fromEntries(toolCatalogEntries.map((entry) => [entry.name, entry])) as Record<
	string,
	ToolCatalogEntry
>

export const toolDescription = (name: string) => toolCatalog[name]?.description ?? fallbackToolDescription(name)
