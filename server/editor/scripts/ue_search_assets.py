import json


def search_assets(
    search_term,
    asset_class=None,
    include_engine=None,
    limit=None,
):
    asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
    all_assets = asset_registry.get_all_assets()

    matching_assets = []
    search_term_lower = unreal_text(search_term or "").lower()
    asset_class_filter = asset_class.strip().lower() if asset_class else None
    should_include_engine = True if include_engine is None else bool(include_engine)

    for asset in all_assets:
        asset_name = unreal_text(asset.asset_name)
        package_path = unreal_text(asset.package_path)
        asset_class_name = get_asset_class_name(asset)

        if not should_include_engine and package_path.startswith("/Engine"):
            continue

        name_match = search_term_lower in asset_name.lower()
        path_match = search_term_lower in package_path.lower()

        class_match = True
        if asset_class_filter:
            class_match = asset_class_filter in asset_class_name.lower()

        if name_match or path_match:
            if class_match:
                matching_assets.append(
                    {
                        "name": asset_name,
                        "path": package_path,
                        "object_path": get_asset_object_path(asset),
                        "class": asset_class_name,
                        "package_name": get_asset_package_name(asset),
                    }
                )

    def relevance_score(asset_info):
        name_exact = search_term_lower == asset_info["name"].lower()
        name_starts = asset_info["name"].lower().startswith(search_term_lower)
        return (name_exact * 3) + (name_starts * 2) + 1

    matching_assets.sort(key=relevance_score, reverse=True)

    normalized_limit = 50
    if limit is not None:
        try:
            normalized_limit = max(0, int(limit))
        except Exception:
            normalized_limit = 50

    return {
        "search_term": search_term,
        "asset_class_filter": asset_class_filter,
        "include_engine": should_include_engine,
        "total_matches": len(matching_assets),
        "assets": matching_assets[:normalized_limit],
    }


def main():
    search_term = decode_template_json("""${search_term}""")
    asset_class = decode_template_json("""${asset_class}""")
    include_engine = decode_template_json("""${include_engine}""")
    limit = decode_template_json("""${limit}""")
    result = search_assets(search_term, asset_class, include_engine, limit)
    print(json.dumps(result, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
