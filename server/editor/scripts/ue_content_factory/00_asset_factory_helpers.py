import os


def _asset_summary(asset):
    return {
        "name": get_object_name(asset),
        "class": get_object_class_name(asset),
        "asset_path": get_asset_package_name(asset) or get_asset_object_path(asset),
    }


def _load_editor_asset(asset_path):
    normalized_asset_path = normalize_asset_reference_path(asset_path)
    if not normalized_asset_path:
        return None

    try:
        return unreal.EditorAssetLibrary.load_asset(normalized_asset_path)
    except Exception:
        return None


def _resolve_factory_class(class_name):
    try:
        factory_class = getattr(unreal, class_name, None)
        if factory_class:
            return factory_class
    except Exception:
        pass

    return None


def _create_asset_via_factory(
    asset_name,
    content_path,
    factory_class_name,
    asset_class_name,
    module_hints,
    unsupported_message,
):
    if not asset_name:
        return {"success": False, "message": "name or asset_name is required"}

    factory_class = _resolve_factory_class(factory_class_name)
    asset_class = resolve_class_reference(asset_class_name, module_hints)
    if not factory_class or not asset_class:
        return {
            "success": False,
            "message": unsupported_message,
        }

    try:
        asset_leaf_name, package_path = split_asset_name_and_path(asset_name, content_path)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    try:
        factory = factory_class()
        asset = create_asset_with_factory(asset_leaf_name, package_path, asset_class, factory)
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}

    if not asset:
        return {
            "success": False,
            "message": "Failed to create asset '{0}' with factory {1}".format(
                asset_leaf_name, factory_class_name
            ),
        }

    asset_path = "{0}/{1}".format(package_path, asset_leaf_name)
    saved = save_loaded_editor_asset(asset)
    return {
        "success": True,
        "asset": _asset_summary(asset),
        "asset_path": asset_path,
        "saved": bool(saved),
        "factory_class": factory_class_name,
    }
