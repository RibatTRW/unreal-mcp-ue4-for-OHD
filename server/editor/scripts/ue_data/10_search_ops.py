def search_data_assets(args):
    search_term = unreal_text(args.get("search_term") or args.get("query") or "").strip().lower()
    include_engine = bool(args.get("include_engine", False))
    limit = int(args.get("limit", 100))
    results = []

    for asset_data in get_asset_registry().get_all_assets():
        package_name = get_asset_package_name(asset_data)
        if not include_engine and package_name.startswith("/Engine/"):
            continue

        asset_class_name = get_asset_class_name(asset_data)
        searchable_text = u"{0} {1} {2}".format(
            unreal_text(package_name),
            unreal_text(get_asset_object_path(asset_data)),
            unreal_text(asset_class_name),
        ).lower()
        if search_term and search_term not in searchable_text:
            continue

        if not _data_asset_class_matches(asset_class_name):
            try:
                asset = unreal.EditorAssetLibrary.load_asset(package_name)
            except Exception:
                asset = None

            if not asset:
                continue

            asset_class_name = get_object_class_name(asset)
            if not (
                _data_asset_class_matches(asset_class_name)
                or class_is_child_of(asset.get_class(), unreal.DataAsset)
            ):
                continue

        results.append(
            {
                "name": unreal_text(asset_data.asset_name),
                "class": asset_class_name,
                "path": package_name,
            }
        )

    results.sort(key=lambda entry: (entry["path"].startswith("/Engine/"), entry["path"]))
    return {
        "success": True,
        "count": len(results[:limit]),
        "assets": results[:limit],
    }
