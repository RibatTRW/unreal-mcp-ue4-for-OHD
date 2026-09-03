def create_data_asset(args):
    asset_name = args.get("name") or args.get("asset_name")
    content_path = args.get("path") or "/Game/Data"
    data_asset_class_name = args.get("data_asset_class") or "DataAsset"

    if not asset_name:
        return {"success": False, "message": "name or asset_name is required"}

    factory_class = getattr(unreal, "DataAssetFactory", None)
    if not factory_class:
        return {
            "success": False,
            "message": "DataAssetFactory is not exposed in this UE4.25 Python environment.",
        }

    data_asset_class = _load_data_asset_class(data_asset_class_name)
    if not data_asset_class:
        return {
            "success": False,
            "message": "Data asset class not found or not derived from DataAsset: {0}".format(
                data_asset_class_name
            ),
        }

    asset_leaf_name, package_path = split_asset_name_and_path(asset_name, content_path)

    try:
        factory = factory_class()
        factory.set_editor_property("data_asset_class", get_UClass(data_asset_class))
        asset = create_asset_with_factory(
            asset_leaf_name,
            package_path,
            data_asset_class,
            factory,
        )
    except Exception as exc:
        return {"success": False, "message": str(exc)}

    if not asset:
        return {
            "success": False,
            "message": "Failed to create data asset '{0}'".format(asset_leaf_name),
        }

    asset_path = "{0}/{1}".format(package_path, asset_leaf_name)
    saved = save_loaded_editor_asset(asset)
    return {
        "success": True,
        "asset": _asset_summary(asset),
        "asset_path": asset_path,
        "saved": bool(saved),
        "data_asset_class": get_object_name(get_UClass(data_asset_class)),
    }


def create_data_table(args):
    asset_name = args.get("name") or args.get("asset_name")
    content_path = args.get("path") or "/Game/Data"
    row_struct_name = args.get("row_struct") or args.get("struct")

    if not asset_name:
        return {"success": False, "message": "name or asset_name is required"}

    if not row_struct_name:
        return {"success": False, "message": "row_struct or struct is required"}

    factory_class = getattr(unreal, "DataTableFactory", None)
    data_table_class = resolve_class_reference("DataTable", ["Engine"])
    if not factory_class or not data_table_class:
        return {
            "success": False,
            "message": "DataTableFactory is not exposed in this UE4.25 Python environment.",
        }

    row_struct = _resolve_script_struct(row_struct_name)
    if not row_struct:
        return {
            "success": False,
            "message": "Row struct could not be resolved: {0}".format(row_struct_name),
        }

    asset_leaf_name, package_path = split_asset_name_and_path(asset_name, content_path)

    try:
        factory = factory_class()
        factory.set_editor_property("struct", row_struct)
        asset = create_asset_with_factory(
            asset_leaf_name,
            package_path,
            data_table_class,
            factory,
        )
    except Exception as exc:
        return {"success": False, "message": str(exc)}

    if not asset:
        return {
            "success": False,
            "message": "Failed to create data table '{0}'".format(asset_leaf_name),
        }

    asset_path = "{0}/{1}".format(package_path, asset_leaf_name)
    saved = save_loaded_editor_asset(asset)
    return {
        "success": True,
        "asset": _asset_summary(asset),
        "asset_path": asset_path,
        "saved": bool(saved),
        "row_struct": unreal_text(row_struct_name),
    }


def create_string_table(args):
    asset_name = args.get("name") or args.get("asset_name")
    content_path = args.get("path") or "/Game/Data"

    if not asset_name:
        return {"success": False, "message": "name or asset_name is required"}

    factory_class = getattr(unreal, "StringTableFactory", None)
    string_table_class = resolve_class_reference("StringTable", ["Engine"])
    if not factory_class or not string_table_class:
        return {
            "success": False,
            "message": "StringTableFactory is not exposed in this UE4.25 Python environment.",
        }

    asset_leaf_name, package_path = split_asset_name_and_path(asset_name, content_path)

    try:
        factory = factory_class()
        asset = create_asset_with_factory(
            asset_leaf_name,
            package_path,
            string_table_class,
            factory,
        )
    except Exception as exc:
        return {"success": False, "message": str(exc)}

    if not asset:
        return {
            "success": False,
            "message": "Failed to create string table '{0}'".format(asset_leaf_name),
        }

    asset_path = "{0}/{1}".format(package_path, asset_leaf_name)
    saved = save_loaded_editor_asset(asset)
    return {
        "success": True,
        "asset": _asset_summary(asset),
        "asset_path": asset_path,
        "saved": bool(saved),
    }
