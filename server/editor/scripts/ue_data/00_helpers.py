_KNOWN_DATA_CLASS_TOKENS = (
    "dataasset",
    "primarydataasset",
    "datatable",
    "curvetable",
    "stringtable",
    "compositedatatable",
    "compositecurvetable",
)


def _asset_summary(asset):
    return {
        "name": get_object_name(asset),
        "class": get_object_class_name(asset),
        "asset_path": get_asset_package_name(asset) or get_asset_object_path(asset),
    }


def _data_asset_class_matches(asset_class_name):
    normalized = unreal_text(asset_class_name or "").strip().lower()
    if not normalized:
        return False

    return any(token in normalized for token in _KNOWN_DATA_CLASS_TOKENS)


def _load_data_asset_class(class_name):
    normalized = unreal_text(class_name or "DataAsset").strip()
    resolved = resolve_class_reference(normalized, ["Engine"])

    if not resolved:
        try:
            resolved = unreal.load_class(None, normalized)
        except Exception:
            resolved = None

    if not resolved:
        return None

    if not class_is_child_of(resolved, unreal.DataAsset):
        return None

    return resolved


def _resolve_script_struct(struct_name):
    normalized = unreal_text(struct_name or "").strip()
    if not normalized:
        return None

    struct_type = getattr(unreal, normalized, None)
    if struct_type:
        try:
            static_struct = getattr(struct_type, "static_struct", None)
            if callable(static_struct):
                return static_struct()
        except Exception:
            pass

    candidates = [normalized]
    if not normalized.startswith("/Script/"):
        candidates.extend(
            [
                "/Script/Engine.{0}".format(normalized),
                "/Script/CoreUObject.{0}".format(normalized),
            ]
        )

    for candidate in candidates:
        try:
            loaded = unreal.load_object(None, candidate)
            if loaded:
                return loaded
        except Exception:
            continue

    return None
