def create_blueprint(args):
    blueprint_name = args.get("name")
    parent_class_name = args.get("parent_class") or "Actor"
    content_path = args.get("path") or "/Game/Blueprints"

    asset_name, package_path = split_asset_name_and_path(blueprint_name, content_path)
    parent_class = resolve_class_reference(parent_class_name, ["Engine", "UMG"])
    if not parent_class:
        return {
            "success": False,
            "message": "Parent class not found: {0}".format(parent_class_name),
        }

    factory = unreal.BlueprintFactory()
    parent_uclass = get_UClass(parent_class)
    if not parent_uclass:
        return {
            "success": False,
            "message": "Could not resolve UClass for parent class: {0}".format(
                parent_class_name
            ),
        }

    try:
        factory.set_editor_property("parent_class", parent_uclass)
    except Exception as exc:
        return {
            "success": False,
            "message": "Failed to assign Blueprint parent class '{0}': {1}".format(
                parent_class_name, exc
            ),
        }

    blueprint = create_asset_with_factory(
        asset_name,
        package_path,
        unreal.Blueprint,
        factory,
    )
    if not blueprint:
        return {
            "success": False,
            "message": "Failed to create blueprint asset '{0}'".format(asset_name),
        }

    asset_path = "{0}/{1}".format(package_path, asset_name)
    finalize_blueprint_change(blueprint, structural=True)
    return {
        "success": True,
        "blueprint_name": asset_name,
        "asset_path": asset_path,
        "parent_class": get_object_name(parent_uclass),
    }


def compile_blueprint(args):
    blueprint_name = args.get("blueprint_name")

    try:
        blueprint = load_blueprint_asset(blueprint_name)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    compiled = try_compile_blueprint(blueprint)
    saved = save_loaded_editor_asset(blueprint)
    return {
        "success": bool(compiled or saved),
        "compiled": bool(compiled),
        "saved": bool(saved),
        "blueprint": get_asset_package_name(blueprint),
    }


def set_blueprint_property(args):
    blueprint_name = args.get("blueprint_name")
    property_name = args.get("property_name")
    property_value = args.get("property_value")

    try:
        blueprint = load_blueprint_asset(blueprint_name)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    cdo = get_blueprint_default_object(blueprint)
    if not cdo:
        return {
            "success": False,
            "message": "Could not resolve class default object for blueprint: {0}".format(
                blueprint_name
            ),
        }

    if not apply_component_property(cdo, property_name, property_value) and not set_object_property(
        cdo, property_name, property_value
    ):
        return {
            "success": False,
            "message": "Failed to set blueprint property '{0}'".format(property_name),
        }

    finalize_blueprint_change(blueprint, structural=False)
    return {
        "success": True,
        "blueprint": get_asset_package_name(blueprint),
        "property_name": property_name,
        "property_value": property_value,
    }
