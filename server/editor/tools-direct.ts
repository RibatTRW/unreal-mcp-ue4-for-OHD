import { jsonArg, renderScript } from "./tools-base.js"

export const UEGetAssetInfo = (asset_path: string) => renderScript("./scripts/ue_get_asset_info.py", { asset_path })

export const UEListAssets = (
	root_path?: string,
	recursive?: boolean,
	limit?: number,
) =>
	renderScript("./scripts/ue_list_assets.py", {
		root_path: jsonArg(root_path),
		recursive: jsonArg(recursive),
		limit: jsonArg(limit),
	})

export const UEExportAsset = (
	asset_path: string,
	destination_path?: string,
	overwrite?: boolean,
) =>
	renderScript("./scripts/ue_export_asset.py", {
		asset_path: jsonArg(asset_path),
		destination_path: jsonArg(destination_path),
		overwrite: jsonArg(overwrite),
	})

export const UEGetAssetReferences = (asset_path: string) =>
	renderScript("./scripts/ue_get_asset_references.py", { asset_path })

export const UEConsoleCommand = (command: string) =>
	renderScript("./scripts/ue_console_command.py", {
		command: jsonArg(command),
	})

export const UEGetConsoleVariable = (variable_name: string) =>
	renderScript("./scripts/ue_get_console_variable.py", {
		variable_name: jsonArg(variable_name),
	})

export const UEGetProjectInfo = () => renderScript("./scripts/ue_get_project_info.py", {})

export const UEGetMapInfo = () => renderScript("./scripts/ue_get_map_info.py", {})

export const UESearchAssets = (
	search_term: string,
	asset_class?: string,
	include_engine?: boolean,
	limit?: number,
) =>
	renderScript("./scripts/ue_search_assets.py", {
		search_term: jsonArg(search_term),
		asset_class: jsonArg(asset_class || ""),
		include_engine: jsonArg(include_engine),
		limit: jsonArg(limit),
	})

export const UEGetWorldOutliner = () => renderScript("./scripts/ue_get_world_outliner.py", {})

export const UEValidateAssets = (asset_paths?: string) =>
	renderScript("./scripts/ue_validate_assets.py", {
		asset_paths: asset_paths || "",
	})

export const UECreateObject = (
	object_class: string,
	object_name: string,
	location?: { x: number; y: number; z: number },
	rotation?: { pitch: number; yaw: number; roll: number },
	scale?: { x: number; y: number; z: number },
	properties?: Record<string, any>,
) => {
	return renderScript("./scripts/ue_create_object.py", {
		object_class,
		object_name,
		location: location ? JSON.stringify(location) : "null",
		rotation: rotation ? JSON.stringify(rotation) : "null",
		scale: scale ? JSON.stringify(scale) : "null",
		properties: properties ? JSON.stringify(properties) : "null",
	})
}

export const UEUpdateObject = (
	actor_name: string,
	location?: { x: number; y: number; z: number },
	rotation?: { pitch: number; yaw: number; roll: number },
	scale?: { x: number; y: number; z: number },
	properties?: Record<string, any>,
	new_name?: string,
) => {
	return renderScript("./scripts/ue_update_object.py", {
		actor_name,
		location: location ? JSON.stringify(location) : "null",
		rotation: rotation ? JSON.stringify(rotation) : "null",
		scale: scale ? JSON.stringify(scale) : "null",
		properties: properties ? JSON.stringify(properties) : "null",
		new_name: new_name || "null",
	})
}

export const UEDeleteObject = (actor_names: string) =>
	renderScript("./scripts/ue_delete_object.py", {
		actor_names,
	})

export const UETakeScreenshot = () => renderScript("./scripts/ue_take_screenshot.py", {})

export const UEMoveCamera = (
	location: { x: number; y: number; z: number },
	rotation: { pitch: number; yaw: number; roll: number },
) => {
	return renderScript("./scripts/ue_move_camera.py", {
		location: JSON.stringify(location),
		rotation: JSON.stringify(rotation),
	})
}

export const UEUMGAddWidget = (
	widget_blueprint_path: string,
	widget_class: string,
	widget_name: string,
	parent_widget_name?: string,
	position?: { x: number; y: number },
	z_order?: number,
) =>
	renderScript("./scripts/ue_umg_add_widget.py", {
		widget_blueprint_path: jsonArg(widget_blueprint_path),
		widget_class: jsonArg(widget_class),
		widget_name: jsonArg(widget_name),
		parent_widget_name: jsonArg(parent_widget_name),
		position: jsonArg(position),
		z_order: jsonArg(z_order),
	})

export const UEUMGRemoveWidget = (widget_blueprint_path: string, widget_name: string) =>
	renderScript("./scripts/ue_umg_remove_widget.py", {
		widget_blueprint_path: jsonArg(widget_blueprint_path),
		widget_name: jsonArg(widget_name),
	})

export const UEUMGSetWidgetPosition = (
	widget_blueprint_path: string,
	widget_name: string,
	position: { x: number; y: number },
	z_order?: number,
) =>
	renderScript("./scripts/ue_umg_set_widget_position.py", {
		widget_blueprint_path: jsonArg(widget_blueprint_path),
		widget_name: jsonArg(widget_name),
		position: jsonArg(position),
		z_order: jsonArg(z_order),
	})

export const UEUMGReparentWidget = (
	widget_blueprint_path: string,
	widget_name: string,
	new_parent_widget_name: string,
	position?: { x: number; y: number },
	z_order?: number,
) =>
	renderScript("./scripts/ue_umg_reparent_widget.py", {
		widget_blueprint_path: jsonArg(widget_blueprint_path),
		widget_name: jsonArg(widget_name),
		new_parent_widget_name: jsonArg(new_parent_widget_name),
		position: jsonArg(position),
		z_order: jsonArg(z_order),
	})

export const UEUMGAddChildWidget = (
	widget_blueprint_path: string,
	parent_widget_name: string,
	child_widget_class: string,
	child_widget_name: string,
	position?: { x: number; y: number },
	z_order?: number,
) =>
	renderScript("./scripts/ue_umg_add_child_widget.py", {
		widget_blueprint_path: jsonArg(widget_blueprint_path),
		parent_widget_name: jsonArg(parent_widget_name),
		child_widget_class: jsonArg(child_widget_class),
		child_widget_name: jsonArg(child_widget_name),
		position: jsonArg(position),
		z_order: jsonArg(z_order),
	})

export const UEUMGRemoveChildWidget = (
	widget_blueprint_path: string,
	parent_widget_name: string,
	child_widget_name: string,
) =>
	renderScript("./scripts/ue_umg_remove_child_widget.py", {
		widget_blueprint_path: jsonArg(widget_blueprint_path),
		parent_widget_name: jsonArg(parent_widget_name),
		child_widget_name: jsonArg(child_widget_name),
	})

export const UEUMGSetChildWidgetPosition = (
	widget_blueprint_path: string,
	parent_widget_name: string,
	child_widget_name: string,
	position: { x: number; y: number },
	z_order?: number,
) =>
	renderScript("./scripts/ue_umg_set_child_widget_position.py", {
		widget_blueprint_path: jsonArg(widget_blueprint_path),
		parent_widget_name: jsonArg(parent_widget_name),
		child_widget_name: jsonArg(child_widget_name),
		position: jsonArg(position),
		z_order: jsonArg(z_order),
	})
