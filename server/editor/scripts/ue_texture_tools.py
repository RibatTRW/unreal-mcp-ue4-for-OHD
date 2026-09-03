import json
import os


def _texture_summary(asset):
    return {
        "name": get_object_name(asset),
        "class": get_object_class_name(asset),
        "asset_path": get_asset_package_name(asset) or get_asset_object_path(asset),
    }


def _load_texture_asset(asset_identifier):
    try:
        asset = unreal.EditorAssetLibrary.load_asset(asset_identifier)
    except Exception:
        asset = None

    if not asset:
        return None

    texture_class = getattr(unreal, "Texture", None)
    if texture_class and class_is_child_of(asset.get_class(), texture_class):
        return asset

    asset_class_name = get_object_class_name(asset)
    if "Texture" in asset_class_name:
        return asset

    return None


def import_texture(args):
    source_file = str(
        args.get("source_file") or args.get("file_path") or args.get("local_path") or ""
    ).strip()
    destination_path = args.get("destination_path") or args.get("content_path") or "/Game/Imported"
    asset_name = args.get("asset_name") or args.get("name")
    replace_existing = bool(args.get("replace_existing", True))
    save_asset = bool(args.get("save", True))

    if not source_file:
        return {
            "success": False,
            "message": "source_file, file_path, or local_path is required.",
        }

    normalized_source_file = os.path.normpath(source_file)
    if not os.path.isfile(normalized_source_file):
        return {
            "success": False,
            "message": "Source file does not exist: {0}".format(normalized_source_file),
        }

    if not asset_name:
        asset_name = os.path.splitext(os.path.basename(normalized_source_file))[0]

    try:
        asset_leaf_name, package_path = split_asset_name_and_path(asset_name, destination_path)
    except Exception as exc:
        return {"success": False, "message": str(exc)}

    task_class = getattr(unreal, "AssetImportTask", None)
    helpers_class = getattr(unreal, "AssetToolsHelpers", None)
    if not task_class or not helpers_class:
        return {
            "success": False,
            "message": "Asset import tasks are not exposed in this UE4.25 Python environment.",
        }

    try:
        import_task = task_class()
        set_object_property(import_task, "filename", normalized_source_file)
        set_object_property(import_task, "destination_path", package_path)
        set_object_property(import_task, "destination_name", asset_leaf_name)
        set_object_property(import_task, "replace_existing", replace_existing)
        set_object_property(import_task, "automated", True)
        set_object_property(import_task, "save", save_asset)

        texture_factory_class = getattr(unreal, "TextureFactory", None)
        if texture_factory_class:
            try:
                set_object_property(import_task, "factory", texture_factory_class())
            except Exception:
                pass

        asset_tools = helpers_class.get_asset_tools()
        asset_tools.import_asset_tasks([import_task])
    except Exception as exc:
        return {"success": False, "message": str(exc)}

    imported_object_paths = list(
        get_editor_property_value(import_task, "imported_object_paths", []) or []
    )

    texture_asset = None
    for imported_path in imported_object_paths:
        texture_asset = _load_texture_asset(str(imported_path))
        if texture_asset:
            break

    expected_asset_path = "{0}/{1}".format(package_path, asset_leaf_name)
    if texture_asset is None:
        texture_asset = _load_texture_asset(expected_asset_path)

    if texture_asset is None:
        return {
            "success": False,
            "message": "Texture import completed but no texture asset could be resolved.",
            "source_file": normalized_source_file,
            "expected_asset_path": expected_asset_path,
            "imported_object_paths": imported_object_paths,
        }

    if save_asset:
        try:
            save_loaded_editor_asset(texture_asset)
        except Exception:
            pass

    return {
        "success": True,
        "source_file": normalized_source_file,
        "asset": _texture_summary(texture_asset),
        "asset_path": get_asset_package_name(texture_asset) or expected_asset_path,
        "imported_object_paths": imported_object_paths,
        "replace_existing": replace_existing,
        "saved": save_asset,
    }


OPERATIONS = {
    "import_texture": import_texture,
}


def main():
    operation = decode_template_json("""${operation}""")
    args = decode_template_json("""${args}""")

    handler = OPERATIONS.get(operation)
    if not handler:
        print(
            json.dumps(
                {
                    "success": False,
                    "message": "Unknown texture tool operation: {0}".format(operation),
                },
                indent=2,
            )
        )
        return

    try:
        result = handler(args or {})
    except Exception as exc:
        result = {"success": False, "message": str(exc)}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
