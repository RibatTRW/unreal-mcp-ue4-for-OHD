import json


def get_asset_references(asset_path):
    asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
    referencer_packages = []

    try:
        if hasattr(unreal.EditorAssetLibrary, "find_package_referencers_for_asset"):
            referencer_packages = unreal.EditorAssetLibrary.find_package_referencers_for_asset(
                asset_path, False
            )
    except Exception:
        referencer_packages = []

    if not referencer_packages:
        asset_data = asset_registry.get_asset_by_object_path(asset_path)
        if asset_data and asset_data.is_valid():
            referencer_packages = asset_registry.get_referencers(
                asset_data.package_name, unreal.AssetRegistryDependencyOptions()
            )

    references = []
    seen = set()
    for referencer in referencer_packages:
        try:
            assets = asset_registry.get_assets_by_package_name(referencer)
        except Exception:
            continue

        for asset in assets:
            object_path = get_asset_object_path(asset)
            if object_path in seen:
                continue

            seen.add(object_path)
            references.append(
                {
                    "name": str(asset.asset_name),
                    "class": get_asset_class_name(asset),
                    "path": object_path,
                }
            )

    return references


def main():
    references = get_asset_references("${asset_path}")
    print(json.dumps(references))


if __name__ == "__main__":
    main()
