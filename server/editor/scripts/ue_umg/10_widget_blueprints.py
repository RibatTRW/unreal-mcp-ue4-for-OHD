def create_umg_widget_blueprint(args):
    widget_name = args.get("widget_name")
    parent_class_name = args.get("parent_class") or "UserWidget"
    content_path = args.get("path") or "/Game/UI"

    asset_name, package_path = split_asset_name_and_path(widget_name, content_path)
    asset_path = "{0}/{1}".format(package_path, asset_name)
    if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        return {
            "success": False,
            "message": "Widget blueprint asset already exists: {0}".format(asset_path),
            "reason": "asset_already_exists",
            "asset_path": asset_path,
        }

    parent_class = resolve_class_reference(parent_class_name, ["UMG"])
    if not parent_class:
        return {
            "success": False,
            "message": "Widget parent class not found: {0}".format(parent_class_name),
        }

    factory = unreal.WidgetBlueprintFactory()
    parent_uclass = get_UClass(parent_class)
    if not parent_uclass:
        return {
            "success": False,
            "message": "Could not resolve UClass for widget parent class: {0}".format(
                parent_class_name
            ),
        }

    try:
        factory.set_editor_property("parent_class", parent_uclass)
    except Exception as exc:
        return {
            "success": False,
            "message": "Failed to assign widget blueprint parent class '{0}': {1}".format(
                parent_class_name, exc
            ),
        }
    widget_blueprint = create_asset_with_factory(
        asset_name,
        package_path,
        unreal.WidgetBlueprint,
        factory,
    )
    if not widget_blueprint:
        return {
            "success": False,
            "message": "Failed to create widget blueprint asset '{0}'".format(asset_name),
            "asset_path": asset_path,
        }

    save_widget_blueprint(widget_blueprint)
    return {
        "success": True,
        "widget_name": asset_name,
        "asset_path": asset_path,
        "parent_class": get_object_name(parent_uclass),
    }
