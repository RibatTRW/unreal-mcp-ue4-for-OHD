# DIAG probe: find the exact encode site behind
# "Search data assets: 'ascii' codec can't encode character u'\u041c'".
# Phase A lists every registry string containing U+041C (explains position 52).
# Phase B replays the CURRENT search_data_assets body + helpers verbatim,
# per-asset, with a full traceback on first failure.
# Keep 2.7-clean. Prints DIAG lines only.

import json
import traceback
import unreal

# ---- verbatim copies from server/editor/scripts (post-fix) ----
try:
    _text_type = unicode
except NameError:
    _text_type = str


def unreal_text(value):
    if value is None:
        return _text_type()
    if isinstance(value, _text_type):
        return value
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8")
        except Exception:
            try:
                return value.decode("utf-8", "ignore")
            except Exception:
                return _text_type()
    try:
        return _text_type(value)
    except Exception:
        pass
    try:
        return str(value).decode("utf-8", "ignore")
    except Exception:
        return _text_type()


def get_asset_class_name(asset_or_data):
    try:
        if hasattr(asset_or_data, "asset_class_path"):
            asset_class_path = asset_or_data.asset_class_path
            if hasattr(asset_class_path, "asset_name"):
                return unreal_text(asset_class_path.asset_name)
            return unreal_text(asset_class_path)
    except Exception:
        pass
    try:
        if hasattr(asset_or_data, "asset_class"):
            return unreal_text(asset_or_data.asset_class)
    except Exception:
        pass
    try:
        asset_class = asset_or_data.get_class()
        if asset_class:
            return asset_class.get_name()
    except Exception:
        pass
    return ""


def get_asset_object_path(asset_or_data):
    try:
        if hasattr(asset_or_data, "object_path"):
            return unreal_text(asset_or_data.object_path)
    except Exception:
        pass
    try:
        return asset_or_data.get_path_name()
    except Exception:
        return ""


def normalize_asset_reference_path(path_value):
    if not path_value:
        return ""
    normalized = unreal_text(path_value).strip()
    if not normalized:
        return ""
    if ":" in normalized:
        normalized = normalized.split(":", 1)[0]
    if "." in normalized:
        package_name, object_name = normalized.rsplit(".", 1)
        if package_name.rsplit("/", 1)[-1] == object_name:
            return package_name
    return normalized


def get_asset_package_name(asset_or_data):
    candidates = []
    try:
        package = asset_or_data.get_package()
        if package:
            normalized_package_name = normalize_asset_reference_path(package.get_name())
            if normalized_package_name:
                candidates.append(normalized_package_name)
    except Exception:
        pass
    try:
        if hasattr(asset_or_data, "package_name"):
            normalized_package_name = normalize_asset_reference_path(
                asset_or_data.package_name
            )
            if normalized_package_name:
                candidates.append(normalized_package_name)
    except Exception:
        pass
    try:
        object_path = normalize_asset_reference_path(get_asset_object_path(asset_or_data))
        if object_path:
            candidates.append(object_path)
    except Exception:
        pass
    if candidates:
        return max(candidates, key=len)
    return ""


def get_asset_package_path(asset_or_data):
    try:
        if hasattr(asset_or_data, "package_path"):
            return unreal_text(asset_or_data.package_path)
    except Exception:
        pass
    package_name = get_asset_package_name(asset_or_data)
    if "/" in package_name:
        return package_name.rsplit("/", 1)[0]
    return package_name


def _data_asset_class_matches(asset_class_name):
    normalized = unreal_text(asset_class_name or "").strip().lower()
    if not normalized:
        return False
    return any(
        token in normalized
        for token in (
            "dataasset",
            "primarydataasset",
            "datatable",
            "curvetable",
            "stringtable",
            "compositedatatable",
            "compositecurvetable",
        )
    )


# ---- Phase A: find the offending strings ----
registry = unreal.AssetRegistryHelpers.get_asset_registry()
all_assets = registry.get_all_assets()
print("DIAG total assets=%d" % len(all_assets))

hits = 0
for asset_data in all_assets:
    if hits >= 10:
        break
    for label in ("asset_name", "package_path", "package_name", "object_path"):
        try:
            raw = getattr(asset_data, label)
        except Exception:
            continue
        if isinstance(raw, _text_type):
            text = raw
        else:
            try:
                text = unicode(str(raw), "utf-8", "ignore")
            except Exception:
                continue
        if u"\u041c" in text:
            print("DIAG hit %s len=%d text=%r" % (label, len(text), text))
            hits += 1

print("DIAG hits=%d" % hits)

# ---- Phase B: replay the search body per-asset with traceback ----
failed = False
for asset_data in all_assets:
    try:
        package_name = get_asset_package_name(asset_data)
        if package_name.startswith("/Engine/"):
            continue
        asset_class_name = get_asset_class_name(asset_data)
        searchable_text = "{0} {1} {2}".format(
            package_name,
            get_asset_object_path(asset_data),
            asset_class_name,
        ).lower()
        matched = _data_asset_class_matches(asset_class_name)
        # NOTE: deliberately no load_asset here (disk access per asset takes
        # minutes); text ops are what we are hunting.
    except Exception:
        try:
            where = repr(get_asset_object_path(asset_data))
        except Exception:
            where = "<unprintable>"
        print("DIAG stage-fail asset=%s" % where)
        traceback.print_exc()
        failed = True
        break

print("DIAG replay failed=%s" % failed)
