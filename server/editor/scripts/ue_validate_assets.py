import json


def validate_assets(
    asset_paths=None,
):
    validation_results = {
        "total_validated": 0,
        "valid_assets": [],
        "invalid_assets": [],
        "validation_summary": {},
    }

    if asset_paths:
        assets_to_validate = (
            asset_paths if isinstance(asset_paths, list) else [asset_paths]
        )
    else:
        asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
        all_assets = asset_registry.get_all_assets()
        assets_to_validate = [
            get_asset_object_path(asset)
            or "{0}/{1}".format(unreal_text(asset.package_path), unreal_text(asset.asset_name))
            for asset in all_assets[:100]
        ]

    validation_results["total_validated"] = len(assets_to_validate)

    for asset_path in assets_to_validate:
        try:
            if not unreal.EditorAssetLibrary.does_asset_exist(asset_path):
                validation_results["invalid_assets"].append(
                    {"path": asset_path, "error": "Asset does not exist"}
                )
                continue

            asset = unreal.EditorAssetLibrary.load_asset(asset_path)
            if not asset:
                validation_results["invalid_assets"].append(
                    {"path": asset_path, "error": "Failed to load asset"}
                )
                continue

            asset_data = unreal.EditorAssetLibrary.find_asset_data(asset_path)
            if not asset_data.is_valid():
                validation_results["invalid_assets"].append(
                    {"path": asset_path, "error": "Asset data is invalid"}
                )
                continue

            validation_results["valid_assets"].append(
                {
                    "path": asset_path,
                    "class": asset.get_class().get_name(),
                    "size": get_asset_data_tag_value(asset_data, "AssetFileSize")
                    or "Unknown",
                }
            )
        except Exception as e:
            validation_results["invalid_assets"].append(
                {"path": asset_path, "error": unreal_text(e)}
            )

    validation_results["validation_summary"] = {
        "valid_count": len(validation_results["valid_assets"]),
        "invalid_count": len(validation_results["invalid_assets"]),
        "success_rate": round(
            len(validation_results["valid_assets"])
            / validation_results["total_validated"]
            * 100,
            2,
        )
        if validation_results["total_validated"] > 0
        else 0,
    }

    return validation_results


def normalize_asset_path_list(decoded_value):
    """Explicit multi-shape normalization for the validate_assets call site.

    The codec decodes exactly one value; the shapes callers actually send
    (list, single path, comma-separated paths) are normalized here, in the
    open, instead of hiding inside wire-format guessing. Returns None for
    empty input so validate_assets falls back to the registry scan.
    """
    if decoded_value is None:
        return None

    if isinstance(decoded_value, list):
        return decoded_value

    if isinstance(decoded_value, _string_types):
        if "," in decoded_value:
            return [
                path.strip()
                for path in decoded_value.split(",")
                if path.strip()
            ]
        stripped = decoded_value.strip()
        if stripped:
            return stripped
        return None

    return decoded_value


def main():
    try:
        decoded_paths = decode_template_arg("asset_paths", """${asset_paths}""")
    except ArgDecodeError as exc:
        print(json.dumps(arg_decode_failure(exc.arg_name), indent=2, ensure_ascii=True))
        return

    result = validate_assets(normalize_asset_path_list(decoded_paths))
    print(json.dumps(result, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
