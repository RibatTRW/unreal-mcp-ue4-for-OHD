# Probe: which component-creation doors exist in this kit's Python?
# Runs INSIDE the OHD editor (Python 2.7) via manage_editor run_python.
# Keep 2.7-clean (no f-strings, no annotations). Prints PROBE lines only.

import unreal

print("PROBE module new_object=%s" % hasattr(unreal, "new_object"))
print("PROBE module SimpleConstructionScript=%s" % hasattr(unreal, "SimpleConstructionScript"))
print("PROBE module BlueprintEditorUtils=%s" % hasattr(unreal, "BlueprintEditorUtils"))
print("PROBE module KismetEditorUtilities=%s" % hasattr(unreal, "KismetEditorUtilities"))

# Find one Blueprint asset and inspect its live SCS object. Dynamic dispatch
# on a live object works even for classes absent from dir(unreal).
found = None
registry = unreal.AssetRegistryHelpers.get_asset_registry()
for asset_data in registry.get_all_assets():
    try:
        class_path = asset_data.asset_class_path
        class_name = class_path.asset_name if hasattr(class_path, "asset_name") else class_path
    except Exception:
        continue
    try:
        text = unicode(class_name)
    except Exception:
        try:
            text = str(class_name)
        except Exception:
            continue
    if text == u"Blueprint" or text == "Blueprint":
        found = asset_data
        break

if found is None:
    print("PROBE blueprint none found")
else:
    print("PROBE blueprint %s" % repr(found.object_path))
    bp = unreal.EditorAssetLibrary.load_asset(found.object_path)
    scs = None
    try:
        scs = bp.get_editor_property("simple_construction_script")
    except Exception as exc:
        print("PROBE scs-prop error=%s" % exc)
    print("PROBE scs present=%s" % bool(scs))
    if scs is not None:
        print("PROBE scs create_node=%s" % callable(getattr(scs, "create_node", None)))
        print("PROBE scs add_node=%s" % callable(getattr(scs, "add_node", None)))
        try:
            names = [m for m in dir(scs) if "node" in m.lower() or "component" in m.lower()]
            print("PROBE scs methods=%s" % sorted(names))
        except Exception as exc:
            print("PROBE scs dir error=%s" % exc)
