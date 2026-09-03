import fs from "node:fs"
import path from "node:path"

export function readEditorScript(filePath: string): string {
	return fs.readFileSync(path.join(__dirname, filePath), "utf8")
}

export function buildOrderedPrelude(relativeDir: string): string {
	const absoluteDir = path.join(__dirname, relativeDir)
	if (!fs.existsSync(absoluteDir)) {
		return ""
	}

	return fs
		.readdirSync(absoluteDir)
		.filter((fileName) => fileName.endsWith(".py"))
		.sort()
		.map((fileName) => readEditorScript(`${relativeDir}/${fileName}`))
		.join("\n\n")
}

export const editorPreludes = {
	actor: buildOrderedPrelude("./scripts/ue_actor"),
	compat: buildOrderedPrelude("./scripts/ue_compat"),
	blueprint: buildOrderedPrelude("./scripts/ue_blueprint"),
	contentFactory: buildOrderedPrelude("./scripts/ue_content_factory"),
	data: buildOrderedPrelude("./scripts/ue_data"),
	material: buildOrderedPrelude("./scripts/ue_material"),
	sourceControl: buildOrderedPrelude("./scripts/ue_source_control"),
	sequence: buildOrderedPrelude("./scripts/ue_sequence"),
	umg: buildOrderedPrelude("./scripts/ue_umg"),
	worldBuilding: buildOrderedPrelude("./scripts/ue_world_building"),
}
