import json


def get_asset_info(asset_path):
    asset_data = unreal.EditorAssetLibrary.find_asset_data(asset_path)
    if not asset_data.is_valid():
        return []

    loaded_asset = None
    try:
        loaded_asset = asset_data.get_asset()
    except Exception:
        loaded_asset = None

    asset_info = {
        "name": loaded_asset.get_name() if loaded_asset else str(asset_data.asset_name),
        "is_valid": asset_data.is_valid(),
        "is_u_asset": asset_data.is_u_asset(),
        "is_asset_loaded": asset_data.is_asset_loaded(),
        "class": get_asset_class_name(asset_data),
        "path": get_asset_object_path(asset_data),
        "package": get_asset_package_name(asset_data),
        "package_path": get_asset_package_path(asset_data),
    }

    lod_info = get_lod_info(loaded_asset)
    if lod_info:
        asset_info["lod_levels"] = lod_info

    return [asset_info]


def get_lod_info(asset_object):
    if not asset_object:
        return []

    try:
        if isinstance(asset_object, unreal.StaticMesh):
            return get_static_mesh_lod_info(asset_object)

        if isinstance(asset_object, unreal.SkeletalMesh):
            return get_skeletal_mesh_lod_info(asset_object)
    except Exception:
        return []

    return []


def main():
    asset_info = get_asset_info("${asset_path}")
    print(json.dumps(asset_info))


if __name__ == "__main__":
    main()
