import { editorPreludes, jsonArg, renderDomainScript } from "./tools-base.js"

export const UEAssetManagementTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderDomainScript("./scripts/ue_asset_management_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	})

// SHIP-S1 pilot: UEActorTool traffic runs through the editor-side prelude
// cache behind the UNREAL_MCP_PRELUDE_CACHE kill-switch (default off,
// same "1" convention as the UNREAL_MCP_* readers in
// server/remote-execution.ts). Off: cached and full are the same reference
// to today's byte-identical render, so dispatch skips the miss fallback
// and takes its existing send path. On: cached is SHIM(hash) + TAIL and
// full is the registering PRELUDE + TAIL, which dispatch resends exactly
// once on a cache miss (runWithPreludeCacheFallback at the python-send
// site). UEActorTool keeps its string signature and delegates to the
// cached half; handlers opt into the pair via dispatch's
// cacheablePythonAction so every shimmed send carries its fallback.
const actorPreludeCacheEnabled = process.env.UNREAL_MCP_PRELUDE_CACHE === "1"

export interface ActorToolCommands {
	readonly cached: string
	readonly full: string
}

export const UEActorToolCommands = (operation: string, args: Record<string, unknown> = {}): ActorToolCommands => {
	const vars = {
		operation: jsonArg(operation),
		args: jsonArg(args),
	}
	if (!actorPreludeCacheEnabled) {
		const full = renderDomainScript("./scripts/ue_actor_tools.py", vars, editorPreludes.actor)
		return { cached: full, full }
	}
	return {
		cached: renderDomainScript("./scripts/ue_actor_tools.py", vars, editorPreludes.actor, { cacheable: true }),
		full: renderDomainScript("./scripts/ue_actor_tools.py", vars, editorPreludes.actor, { registerCache: true }),
	}
}

export const UEActorTool = (operation: string, args: Record<string, unknown> = {}) =>
	UEActorToolCommands(operation, args).cached

export const UEBlueprintTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderDomainScript(
		"./scripts/ue_blueprint_tools.py",
		{
			operation: jsonArg(operation),
			args: jsonArg(args),
		},
		editorPreludes.blueprint,
	)

export const UEBlueprintAnalysisTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderDomainScript("./scripts/ue_blueprint_analysis_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	})

export const UEProjectTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderDomainScript("./scripts/ue_project_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	})

export const UEMaterialTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderDomainScript(
		"./scripts/ue_material_tools.py",
		{
			operation: jsonArg(operation),
			args: jsonArg(args),
		},
		editorPreludes.material,
	)

export const UETextureTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderDomainScript("./scripts/ue_texture_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	})

export const UEUMGTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderDomainScript(
		"./scripts/ue_umg_tools.py",
		{
			operation: jsonArg(operation),
			args: jsonArg(args),
		},
		editorPreludes.umg,
	)

export const UESourceControlTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderDomainScript(
		"./scripts/ue_source_control_tools.py",
		{
			operation: jsonArg(operation),
			args: jsonArg(args),
		},
		editorPreludes.sourceControl,
	)

export const UEDataTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderDomainScript(
		"./scripts/ue_data_tools.py",
		{
			operation: jsonArg(operation),
			args: jsonArg(args),
		},
		editorPreludes.data,
	)

export const UEContentFactoryTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderDomainScript(
		"./scripts/ue_content_factory_tools.py",
		{
			operation: jsonArg(operation),
			args: jsonArg(args),
		},
		editorPreludes.contentFactory,
	)

export const UESequenceTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderDomainScript(
		"./scripts/ue_sequence_tools.py",
		{
			operation: jsonArg(operation),
			args: jsonArg(args),
		},
		editorPreludes.sequence,
	)

export const UEWorldBuildingTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderDomainScript(
		"./scripts/ue_world_building_tools.py",
		{
			operation: jsonArg(operation),
			args: jsonArg(args),
		},
		editorPreludes.worldBuilding,
	)

export const UEPIETool = (operation: string, args: Record<string, unknown> = {}) =>
	renderDomainScript("./scripts/ue_pie_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	})
