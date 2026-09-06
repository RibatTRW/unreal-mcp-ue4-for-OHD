export interface ToolCatalogEntry {
	category: string
	description: string
	name: string
}

/**
 * Placeholder description used when a registered tool has no catalog entry
 * co-located with its registration. Registration keeps working (the startup
 * crash this fallback replaces is worse than a generic description), and the
 * missing entry is reported on stderr so it gets fixed.
 */
export const fallbackToolDescription = (name: string): string => `Tool ${name}.`

/**
 * Build a description lookup over entries declared alongside a tool's
 * registration. Unknown names fall back instead of throwing so a missing
 * entry can never crash the server at startup.
 */
export const createToolDescriptionLookup = (entries: ToolCatalogEntry[]): ((name: string) => string) => {
	const descriptionByName = new Map(entries.map((entry) => [entry.name, entry.description]))

	return (name: string) => {
		const description = descriptionByName.get(name)
		if (description !== undefined) {
			return description
		}

		console.error(`Missing tool catalog entry for registered tool: ${name}. Using a fallback description.`)
		return fallbackToolDescription(name)
	}
}
