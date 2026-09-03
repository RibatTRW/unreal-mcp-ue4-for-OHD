import json


def _normalize_content_path(path_value, default_path="/Game"):
    normalized = unreal_text(path_value or "").strip()
    if not normalized:
        normalized = default_path

    if not normalized.startswith("/"):
        normalized = "/Game/{0}".format(normalized.strip("/"))

    return normalized.rstrip("/") or "/Game"


def _asset_summary(asset):
    if not asset:
        return None

    return {
        "name": get_object_name(asset),
        "class": get_object_class_name(asset),
        "asset_path": get_asset_package_name(asset) or get_asset_object_path(asset),
        "object_path": get_asset_object_path(asset),
    }


def _resolve_destination_asset_path(args, source_asset_path, require_new_path=False):
    explicit_destination = unreal_text(
        args.get("destination_asset_path")
        or args.get("target_asset_path")
        or args.get("asset_path")
        or ""
    ).strip()
    if explicit_destination:
        return normalize_asset_reference_path(explicit_destination)

    source_package = normalize_asset_reference_path(source_asset_path)
    source_name = source_package.rsplit("/", 1)[-1]
    source_directory = source_package.rsplit("/", 1)[0] if "/" in source_package else "/Game"

    destination_path = args.get("destination_path") or args.get("path")
    new_name = unreal_text(args.get("new_name") or args.get("name") or "").strip()

    if require_new_path and not destination_path and not new_name:
        raise ValueError(
            "destination_asset_path, destination_path, or new_name is required."
        )

    destination_directory = _normalize_content_path(destination_path, source_directory)
    destination_name = new_name or source_name
    return "{0}/{1}".format(destination_directory, destination_name)


def _collect_asset_paths(args):
    candidate_paths = args.get("asset_paths")
    if isinstance(candidate_paths, list):
        normalized_paths = [
            normalize_asset_reference_path(asset_path)
            for asset_path in candidate_paths
            if unreal_text(asset_path or "").strip()
        ]
        return [asset_path for asset_path in normalized_paths if asset_path]

    single_path = args.get("asset_path") or args.get("path") or args.get("name")
    normalized_single = normalize_asset_reference_path(single_path)
    return [normalized_single] if normalized_single else []


def _list_directory_entries(directory_path, recursive=False):
    normalized_directory = _normalize_content_path(directory_path)
    is_recursive = bool(recursive)

    try:
        entries = unreal.EditorAssetLibrary.list_assets(
            normalized_directory, recursive=is_recursive, include_folder=True
        )
    except TypeError:
        try:
            entries = unreal.EditorAssetLibrary.list_assets(
                normalized_directory, is_recursive, True
            )
        except TypeError:
            entries = unreal.EditorAssetLibrary.list_assets(
                normalized_directory, is_recursive
            )

    asset_paths = []
    folder_paths = []
    for entry in entries or []:
        normalized_entry = normalize_asset_reference_path(entry)
        if not normalized_entry:
            continue

        try:
            if unreal.EditorAssetLibrary.does_directory_exist(normalized_entry):
                folder_paths.append(normalized_entry)
                continue
        except Exception:
            pass

        asset_paths.append(normalized_entry)

    return normalized_directory, sorted(set(folder_paths)), sorted(set(asset_paths))


def asset_exists(args):
    asset_paths = _collect_asset_paths(args)
    if not asset_paths:
        return {"success": False, "message": "asset_path, path, name, or asset_paths is required."}

    results = []
    for asset_path in asset_paths:
        exists = False
        try:
            exists = bool(unreal.EditorAssetLibrary.does_asset_exist(asset_path))
        except Exception:
            exists = False
        results.append({"asset_path": asset_path, "exists": exists})

    if len(results) == 1:
        result = results[0]
        return {
            "success": True,
            "asset_path": result["asset_path"],
            "exists": result["exists"],
        }

    return {
        "success": True,
        "count": len(results),
        "all_exist": all(result["exists"] for result in results),
        "results": results,
    }


def duplicate_asset(args):
    source_asset_path = normalize_asset_reference_path(
        args.get("source_asset_path")
        or args.get("source_path")
        or args.get("asset_path")
        or args.get("path")
    )
    if not source_asset_path:
        return {
            "success": False,
            "message": "source_asset_path, source_path, asset_path, or path is required.",
        }

    if not unreal.EditorAssetLibrary.does_asset_exist(source_asset_path):
        return {"success": False, "message": "Source asset does not exist: {0}".format(source_asset_path)}

    destination_asset_path = _resolve_destination_asset_path(
        args, source_asset_path, require_new_path=True
    )
    duplicated_asset = unreal.EditorAssetLibrary.duplicate_asset(
        source_asset_path, destination_asset_path
    )

    if not duplicated_asset:
        return {
            "success": False,
            "message": "Failed to duplicate asset.",
            "source_asset_path": source_asset_path,
            "destination_asset_path": destination_asset_path,
        }

    return {
        "success": True,
        "operation": "duplicate",
        "source_asset_path": source_asset_path,
        "destination_asset_path": destination_asset_path,
        "asset": _asset_summary(duplicated_asset),
    }


def rename_asset(args):
    source_asset_path = normalize_asset_reference_path(
        args.get("source_asset_path")
        or args.get("source_path")
        or args.get("asset_path")
        or args.get("path")
    )
    if not source_asset_path:
        return {
            "success": False,
            "message": "source_asset_path, source_path, asset_path, or path is required.",
        }

    destination_asset_path = _resolve_destination_asset_path(
        args, source_asset_path, require_new_path=True
    )
    renamed = bool(
        unreal.EditorAssetLibrary.rename_asset(source_asset_path, destination_asset_path)
    )

    return {
        "success": renamed,
        "operation": "rename",
        "source_asset_path": source_asset_path,
        "destination_asset_path": destination_asset_path,
        "exists_after": bool(
            unreal.EditorAssetLibrary.does_asset_exist(destination_asset_path)
        ),
    }


def move_asset(args):
    source_asset_path = normalize_asset_reference_path(
        args.get("source_asset_path")
        or args.get("source_path")
        or args.get("asset_path")
        or args.get("path")
    )
    if not source_asset_path:
        return {
            "success": False,
            "message": "source_asset_path, source_path, asset_path, or path is required.",
        }

    destination_path = args.get("destination_path")
    if not destination_path and not args.get("destination_asset_path"):
        return {
            "success": False,
            "message": "destination_path or destination_asset_path is required for move.",
        }

    destination_asset_path = _resolve_destination_asset_path(
        args, source_asset_path, require_new_path=True
    )
    moved = bool(
        unreal.EditorAssetLibrary.rename_asset(source_asset_path, destination_asset_path)
    )

    return {
        "success": moved,
        "operation": "move",
        "source_asset_path": source_asset_path,
        "destination_asset_path": destination_asset_path,
        "exists_after": bool(
            unreal.EditorAssetLibrary.does_asset_exist(destination_asset_path)
        ),
    }


def delete_assets(args):
    asset_paths = _collect_asset_paths(args)
    if not asset_paths:
        return {"success": False, "message": "asset_path, path, name, or asset_paths is required."}

    deleted = []
    failed = []
    for asset_path in asset_paths:
        try:
            result = bool(unreal.EditorAssetLibrary.delete_asset(asset_path))
        except Exception as exc:
            failed.append({"asset_path": asset_path, "message": unreal_text(exc)})
            continue

        if result:
            deleted.append(asset_path)
        else:
            failed.append({"asset_path": asset_path, "message": "delete_asset returned False"})

    return {
        "success": len(failed) == 0,
        "operation": "delete",
        "deleted": deleted,
        "failed": failed,
        "processed_count": len(asset_paths),
        "deleted_count": len(deleted),
    }


def save_assets(args):
    asset_paths = _collect_asset_paths(args)
    if not asset_paths:
        return {"success": False, "message": "asset_path, path, name, or asset_paths is required."}

    only_if_is_dirty = bool(args.get("only_if_is_dirty", True))
    saved = []
    failed = []
    for asset_path in asset_paths:
        try:
            result = bool(
                unreal.EditorAssetLibrary.save_asset(asset_path, only_if_is_dirty)
            )
        except Exception as exc:
            failed.append({"asset_path": asset_path, "message": unreal_text(exc)})
            continue

        if result:
            saved.append(asset_path)
        else:
            failed.append({"asset_path": asset_path, "message": "save_asset returned False"})

    return {
        "success": len(failed) == 0,
        "operation": "save",
        "only_if_is_dirty": only_if_is_dirty,
        "saved": saved,
        "failed": failed,
        "processed_count": len(asset_paths),
        "saved_count": len(saved),
    }


def create_folder(args):
    directory_path = _normalize_content_path(
        args.get("directory_path") or args.get("folder_path") or args.get("path")
    )
    created = bool(unreal.EditorAssetLibrary.make_directory(directory_path))
    return {
        "success": created,
        "operation": "create_folder",
        "directory_path": directory_path,
        "exists_after": bool(
            unreal.EditorAssetLibrary.does_directory_exist(directory_path)
        ),
    }


def list_folder(args):
    directory_path = (
        args.get("directory_path") or args.get("folder_path") or args.get("path") or "/Game"
    )
    recursive = bool(args.get("recursive", False))
    normalized_directory, folder_paths, asset_paths = _list_directory_entries(
        directory_path, recursive
    )

    return {
        "success": True,
        "operation": "list_folder",
        "directory_path": normalized_directory,
        "recursive": recursive,
        "folders": folder_paths,
        "assets": asset_paths,
        "folder_count": len(folder_paths),
        "asset_count": len(asset_paths),
    }


def delete_folder(args):
    directory_path = _normalize_content_path(
        args.get("directory_path") or args.get("folder_path") or args.get("path")
    )
    existed_before = bool(unreal.EditorAssetLibrary.does_directory_exist(directory_path))
    deleted = bool(unreal.EditorAssetLibrary.delete_directory(directory_path))
    return {
        "success": deleted,
        "operation": "delete_folder",
        "directory_path": directory_path,
        "existed_before": existed_before,
        "exists_after": bool(
            unreal.EditorAssetLibrary.does_directory_exist(directory_path)
        ),
    }


OPERATIONS = {
    "exists": asset_exists,
    "duplicate": duplicate_asset,
    "rename": rename_asset,
    "move": move_asset,
    "delete": delete_assets,
    "save": save_assets,
    "create_folder": create_folder,
    "list_folder": list_folder,
    "delete_folder": delete_folder,
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
                    "message": "Unknown asset management operation: {0}".format(
                        operation
                    ),
                },
                indent=2,
            )
        )
        return

    try:
        result = handler(args or {})
    except Exception as exc:
        result = {"success": False, "message": unreal_text(exc)}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
