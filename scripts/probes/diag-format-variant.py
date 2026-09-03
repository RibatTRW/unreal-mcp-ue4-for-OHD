# DIAG probe 2: why does "{0} {1} {2}".format(...) raise UnicodeEncodeError
# on the Cyrillic asset? Print raw types, then test fix candidates.
# Keep 2.7-clean. Prints DIAG2 lines only.

import traceback
import unreal

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


def describe(label, value):
    try:
        kind = type(value).__name__
    except Exception:
        kind = "<unknown-type>"
    try:
        text = repr(value)
    except Exception as exc:
        text = "<unprintable %s>" % exc
    print("DIAG2 %s type=%s value=%s" % (label, kind, text))


registry = unreal.AssetRegistryHelpers.get_asset_registry()
target = None
for asset_data in registry.get_all_assets():
    try:
        path_text = unreal_text(asset_data.get_path_name())
    except Exception:
        continue
    if u"\u041c" in path_text:
        target = asset_data
        break

if target is None:
    print("DIAG2 no cyrillic asset found")
else:
    print("DIAG2 target found=True")
    raw_name = target.asset_name
    raw_pkg = target.package_path
    try:
        raw_class_path = target.asset_class_path
        raw_class_name = (
            raw_class_path.asset_name
            if hasattr(raw_class_path, "asset_name")
            else raw_class_path
        )
    except Exception:
        raw_class_name = "<unreadable>"
    try:
        raw_path_name = target.get_path_name()
    except Exception as exc:
        raw_path_name = "<error %s>" % exc

    describe("asset_name", raw_name)
    describe("package_path", raw_pkg)
    describe("class_name", raw_class_name)
    describe("path_name", raw_path_name)

    # Variant 1: current code (byte format string, raw values) — expect FAIL.
    try:
        out = "{0} {1} {2}".format(raw_pkg, raw_path_name, raw_class_name)
        print("DIAG2 byte-format-raw ok=True")
    except Exception:
        print("DIAG2 byte-format-raw ok=False")
        traceback.print_exc()

    # Variant 2: unicode format + coerced values (fix candidate).
    try:
        out = u"{0} {1} {2}".format(
            unreal_text(raw_pkg),
            unreal_text(raw_path_name),
            unreal_text(raw_class_name),
        ).lower()
        print("DIAG2 unicode-format-coerced ok=True len=%d" % len(out))
    except Exception:
        print("DIAG2 unicode-format-coerced ok=False")
        traceback.print_exc()
