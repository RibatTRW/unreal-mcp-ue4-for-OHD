import json


def list_assets(root_path=None, recursive=True, limit=None):
    normalized_root = str(root_path or "/Game").strip() or "/Game"
    is_recursive = bool(True if recursive is None else recursive)

    try:
        assets = unreal.EditorAssetLibrary.list_assets(
            normalized_root, recursive=is_recursive, include_folder=False
        )
    except TypeError:
        try:
            assets = unreal.EditorAssetLibrary.list_assets(
                normalized_root, is_recursive, False
            )
        except TypeError:
            assets = unreal.EditorAssetLibrary.list_assets(normalized_root, is_recursive)

    normalized_assets = [unreal_text(asset_path) for asset_path in (assets or []) if asset_path]
    total_found = len(normalized_assets)

    normalized_limit = None
    if limit is not None:
        try:
            normalized_limit = max(0, int(limit))
        except Exception:
            normalized_limit = None

    if normalized_limit is not None:
        normalized_assets = normalized_assets[:normalized_limit]

    return {
        "success": True,
        "root_path": normalized_root,
        "recursive": is_recursive,
        "count": len(normalized_assets),
        "total_found": total_found,
        "assets": normalized_assets,
    }


def main():
    root_path = decode_template_json("""${root_path}""")
    recursive = decode_template_json("""${recursive}""")
    limit = decode_template_json("""${limit}""")
    print(json.dumps(list_assets(root_path, recursive, limit), indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
