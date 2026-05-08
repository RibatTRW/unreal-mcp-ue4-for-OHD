import { editorPreludes, jsonArg, renderScript } from "./tools-base.js"

export const UEAssetManagementTool = (
	operation: string,
	args: Record<string, unknown> = {},
) =>
	renderScript("./scripts/ue_asset_management_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	})

export const UEActorTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderScript("./scripts/ue_actor_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	}, editorPreludes.actor)

export const UEBlueprintTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderScript("./scripts/ue_blueprint_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	}, editorPreludes.blueprint)

export const UEBlueprintAnalysisTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderScript("./scripts/ue_blueprint_analysis_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	})

export const UEBlueprintGraphTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderScript("./scripts/ue_blueprint_graph_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	}, editorPreludes.blueprintGraph)

export const UEProjectTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderScript("./scripts/ue_project_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	})

export const UEMaterialTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderScript("./scripts/ue_material_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	}, editorPreludes.material)

export const UETextureTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderScript("./scripts/ue_texture_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	})

export const UEUMGTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderScript("./scripts/ue_umg_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	}, editorPreludes.umg)

export const UESourceControlTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderScript("./scripts/ue_source_control_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	}, editorPreludes.sourceControl)

export const UEDataTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderScript("./scripts/ue_data_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	}, editorPreludes.data)

export const UEContentFactoryTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderScript("./scripts/ue_content_factory_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	}, editorPreludes.contentFactory)

export const UEWorldBuildingTool = (operation: string, args: Record<string, unknown> = {}) =>
	renderScript("./scripts/ue_world_building_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	}, editorPreludes.worldBuilding)

export const UEPIETool = (operation: string, args: Record<string, unknown> = {}) =>
	renderScript("./scripts/ue_pie_tools.py", {
		operation: jsonArg(operation),
		args: jsonArg(args),
	})
