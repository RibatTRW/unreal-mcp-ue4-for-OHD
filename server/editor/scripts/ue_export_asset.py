import json
import os
import tempfile


def _default_export_suffix(asset):
    asset_class_name = get_object_class_name(asset)
    normalized = unreal_text(asset_class_name or "").lower()

    if "texture" in normalized:
        return ".tga"
    if "staticmesh" in normalized or "skeletalmesh" in normalized:
        return ".fbx"
    if "soundwave" in normalized or "soundcue" in normalized:
        return ".wav"

    return ".export"


def export_asset(asset_path, destination_path=None, overwrite=True):
    normalized_asset_path = unreal_text(asset_path or "").strip()
    if not normalized_asset_path:
        return {"success": False, "message": "asset_path is required"}

    asset = unreal.EditorAssetLibrary.load_asset(normalized_asset_path)
    if not asset:
        return {
            "success": False,
            "message": "Asset not found at {0}".format(normalized_asset_path),
        }

    created_temp_file = False
    export_file_path = unreal_text(destination_path or "").strip()
    if export_file_path:
        export_file_path = os.path.abspath(export_file_path)
        parent_directory = os.path.dirname(export_file_path)
        if parent_directory and not os.path.exists(parent_directory):
            try:
                os.makedirs(parent_directory)
            except OSError:
                if not os.path.isdir(parent_directory):
                    raise
        if os.path.exists(export_file_path) and not bool(overwrite):
            return {
                "success": False,
                "message": "Destination file already exists: {0}".format(
                    export_file_path
                ),
            }
    else:
        temp_handle = tempfile.NamedTemporaryFile(
            delete=False, suffix=_default_export_suffix(asset)
        )
        export_file_path = temp_handle.name
        temp_handle.close()
        created_temp_file = True

    export_task = unreal.AssetExportTask()
    export_task.automated = True
    export_task.prompt = False
    export_task.replace_identical = bool(overwrite)
    export_task.exporter = None
    export_task.object = asset
    export_task.filename = export_file_path

    try:
        result = unreal.Exporter.run_asset_export_task(export_task)
    except Exception as exc:
        if created_temp_file and os.path.exists(export_file_path):
            try:
                os.unlink(export_file_path)
            except Exception:
                pass
        return {"success": False, "message": unreal_text(exc)}

    if not result or not os.path.exists(export_file_path):
        if created_temp_file and os.path.exists(export_file_path):
            try:
                os.unlink(export_file_path)
            except Exception:
                pass
        return {
            "success": False,
            "message": "Failed to export asset {0} to {1}".format(
                unreal_text(asset.get_name()), export_file_path
            ),
        }

    return {
        "success": True,
        "asset_name": unreal_text(asset.get_name()),
        "asset_class": get_object_class_name(asset),
        "asset_path": normalized_asset_path,
        "exported_file": export_file_path,
        "size_bytes": int(os.path.getsize(export_file_path)),
        "temporary_file": created_temp_file,
    }


def main():
    asset_path = decode_template_json("""${asset_path}""")
    destination_path = decode_template_json("""${destination_path}""")
    overwrite = decode_template_json("""${overwrite}""")
    print(json.dumps(export_asset(asset_path, destination_path, overwrite), indent=2))


if __name__ == "__main__":
    main()
