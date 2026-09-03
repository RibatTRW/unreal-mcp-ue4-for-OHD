def get_available_materials(args):
    search_term = str(args.get("search_term") or "").strip().lower()
    include_engine = bool(args.get("include_engine", True))
    limit = int(args.get("limit", 100))

    material_assets = []
    for asset_data in get_asset_registry().get_all_assets():
        asset_class_name = get_asset_class_name(asset_data)
        if asset_class_name not in ("Material", "MaterialInstanceConstant", "MaterialInstance"):
            continue

        package_name = get_asset_package_name(asset_data)
        if not include_engine and package_name.startswith("/Engine/"):
            continue

        searchable_text = "{0} {1}".format(
            package_name,
            get_asset_object_path(asset_data),
        ).lower()
        if search_term and search_term not in searchable_text:
            continue

        material_assets.append(
            {
                "name": unreal_text(asset_data.asset_name),
                "class": asset_class_name,
                "path": package_name,
            }
        )

    material_assets.sort(key=lambda material: (material["path"].startswith("/Engine/"), material["path"]))
    return {
        "success": True,
        "count": len(material_assets[:limit]),
        "materials": material_assets[:limit],
    }


def apply_material_to_actor(args):
    material_path = args.get("material_path")
    slot_index = int(args.get("slot_index", 0))

    try:
        actor, component = _resolve_actor_and_component(args)
        material_asset = apply_material_to_component(component, material_path, slot_index)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    return {
        "success": True,
        "actor": get_actor_summary(actor),
        "component": get_object_name(component),
        "slot_index": slot_index,
        "material": get_material_summary(material_asset),
    }


def apply_material_to_blueprint(args):
    blueprint_name = args.get("blueprint_name")
    component_name = args.get("component_name")
    material_path = args.get("material_path")
    slot_index = int(args.get("slot_index", 0))

    try:
        blueprint, component_node, component_template = _get_blueprint_component(
            blueprint_name, component_name
        )
        material_asset = apply_material_to_component(
            component_template, material_path, slot_index
        )
        finalize_blueprint_change(blueprint, structural=False)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    resolved_component_name = (
        get_scs_node_name(component_node)
        or get_object_name(component_template)
        or str(component_name or "")
    )

    return {
        "success": True,
        "blueprint": get_asset_package_name(blueprint),
        "component": resolved_component_name,
        "slot_index": slot_index,
        "material": get_material_summary(material_asset),
    }
