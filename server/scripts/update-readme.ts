import fs from "node:fs"
import path from "node:path"

import {
	categoryOrder,
	excludedCapabilities,
	supportForTool,
	toolCatalogEntries,
	type ExcludedCapabilityInfo,
	type ToolCatalogEntry,
} from "../tool-catalog.js"

const categoryOrderSet = new Set<string>(categoryOrder)

function formatTableCell(value?: string): string {
	return value && value.trim() ? value.replace(/\|/g, "\\|") : "-"
}

function escapeHtml(value?: string, emptyValue: string = "-"): string {
	if (!value || !value.trim()) {
		return emptyValue
	}

	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function summarizeDescription(description: string): string {
	return description.split("\n\n")[0].split("\n")[0].trim()
}

function generateToolsTable(tools: ToolCatalogEntry[]): string {
	const rows = tools
		.map((tool) => {
			const support = supportForTool(tool.name)
			return [
				"\t<tr>",
				`\t\t<td width="18%"><code>${escapeHtml(tool.name)}</code></td>`,
				`\t\t<td width="52%">${escapeHtml(summarizeDescription(tool.description))}</td>`,
				`\t\t<td width="30%">${escapeHtml(support.note, "&nbsp;")}</td>`,
				"\t</tr>",
			].join("\n")
		})
		.join("\n")

	return [
		'<table width="100%">',
		"\t<colgroup>",
		'\t\t<col width="18%">',
		'\t\t<col width="52%">',
		'\t\t<col width="30%">',
		"\t</colgroup>",
		"\t<thead>",
		"\t\t<tr>",
		'\t\t\t<th width="18%">Tool</th>',
		'\t\t\t<th width="52%">Description</th>',
		'\t\t\t<th width="30%">Notes</th>',
		"\t\t</tr>",
		"\t</thead>",
		"\t<tbody>",
		rows,
		"\t</tbody>",
		"</table>",
	].join("\n")
}

function generateToolsSections(tools: ToolCatalogEntry[]): string {
	const sections: string[] = []

	for (const category of categoryOrder) {
		const categoryTools = tools.filter((tool) => tool.category === category)
		if (categoryTools.length === 0) {
			continue
		}

		sections.push(`### ${category}\n\n${generateToolsTable(categoryTools)}`)
	}

	const uncategorizedTools = tools.filter((tool) => !categoryOrderSet.has(tool.category))
	if (uncategorizedTools.length > 0) {
		sections.push(`### Other Tools\n\n${generateToolsTable(uncategorizedTools)}`)
	}

	return sections.join("\n\n")
}

function generateExcludedCapabilitiesTable(entries: ExcludedCapabilityInfo[]): string {
	const header =
		"| Capability Area | Effect on MCP Surface | Why It Is Excluded |\n|-----------------|-----------------------|---------------------|\n"
	const rows = entries
		.map((entry) => {
			return `| ${formatTableCell(entry.capability)} | ${formatTableCell(entry.affectedSurface)} | ${formatTableCell(entry.reason)} |`
		})
		.join("\n")
	return header + rows
}

function replaceToolsSection(content: string, toolsSection: string): string {
	const sectionHeaderRegex = /^##.*Available Tools\s*$/m
	const headerMatch = sectionHeaderRegex.exec(content)

	if (!headerMatch || headerMatch.index === undefined) {
		return insertToolsSection(content, toolsSection)
	}

	const sectionStart = headerMatch.index
	const contentAfterHeader = content.slice(sectionStart + headerMatch[0].length)
	const nextTopLevelHeaderIndex = contentAfterHeader.search(/\n##\s/)
	const sectionEnd =
		nextTopLevelHeaderIndex === -1 ? content.length : sectionStart + headerMatch[0].length + nextTopLevelHeaderIndex + 1

	return content.slice(0, sectionStart) + toolsSection + content.slice(sectionEnd)
}

function insertToolsSection(content: string, toolsSection: string): string {
	const insertMarkers = ["## Contributing", "## License", "## ?諭?License", "## ?姨?Contributing"]
	const insertPoints = insertMarkers
		.map((marker) => ({ found: content.indexOf(marker), marker }))
		.filter((point) => point.found !== -1)
		.sort((a, b) => a.found - b.found)

	const insertPoint = insertPoints[0]
	return insertPoint
		? content.slice(0, insertPoint.found) + toolsSection + content.slice(insertPoint.found)
		: content + "\n" + toolsSection
}

function updateReadmeWithTools() {
	const readmePath = path.join(__dirname, "../../README.md")
	const readmeContent = fs.readFileSync(readmePath, "utf-8")

	const toolsSection = `## Available Tools

Notes call out important requirements or UE4.25 limitations when they matter. Empty notes mean there are no additional caveats beyond normal editor setup.

The recommended public surface is the \`manage_*\` namespace layer. Prefer \`manage_editor.project_info\`, \`manage_editor.map_info\`, and \`manage_level.world_outliner\` as canonical read entry points, and treat the small direct-tool set as low-level primitives for path discovery and actor CRUD.

${generateToolsSections(toolCatalogEntries)}

### Excluded Capability Areas

These capability areas are intentionally not exposed through the MCP surface in this UE4.25 port because they fail reliably in the current Python environment and only add prompt or context overhead until a native bridge exists.

${generateExcludedCapabilitiesTable(excludedCapabilities)}

`

	const updatedContent = replaceToolsSection(readmeContent, toolsSection)

	fs.writeFileSync(readmePath, updatedContent)
	console.log(
		`Updated README.md with ${toolCatalogEntries.length} tools and ${excludedCapabilities.length} excluded capability areas`,
	)
}

updateReadmeWithTools()
