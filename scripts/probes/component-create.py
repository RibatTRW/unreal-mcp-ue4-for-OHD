# Probe 2: how to create a component template for a Blueprint in this kit?
# Creates a scratch Actor blueprint, tries creation variants, then deletes it.
# Keep 2.7-clean. Prints PROBE2 lines only.

import unreal

PKG = "/Game/MCP/Tests"
NAME = "ProbeComp_TMP"
OBJ_PATH = PKG + "/" + NAME

tools = unreal.AssetToolsHelpers.get_asset_tools()
factory = unreal.BlueprintFactory()
factory.set_editor_property("parent_class", unreal.Actor)
created = tools.create_asset(NAME, PKG, unreal.Blueprint, factory)
print("PROBE2 blueprint created=%s" % bool(created))

bp = unreal.EditorAssetLibrary.load_asset(OBJ_PATH)
print("PROBE2 blueprint loaded=%s" % bool(bp))

gen_class = None
try:
    gen_class = bp.get_editor_property("generated_class")
except Exception as exc:
    print("PROBE2 generated_class error=%s" % exc)
print("PROBE2 generated_class present=%s" % bool(gen_class))

cdo = None
if gen_class is not None:
    try:
        cdo = unreal.get_default_object(gen_class)
    except Exception as exc:
        print("PROBE2 cdo error=%s" % exc)
print("PROBE2 cdo present=%s" % bool(cdo))

scs = None
try:
    scs = bp.get_editor_property("simple_construction_script")
except Exception as exc:
    print("PROBE2 scs-prop error=%s" % exc)
print("PROBE2 scs present=%s" % bool(scs))
if scs is not None:
    print("PROBE2 scs create_node=%s" % callable(getattr(scs, "create_node", None)))
    print("PROBE2 scs add_node=%s" % callable(getattr(scs, "add_node", None)))

outer = cdo if cdo is not None else gen_class
if outer is not None:
    # Variant A: positional (Outer, Name)
    try:
        made_a = unreal.StaticMeshComponent(outer, "ProbeMeshA")
        print("PROBE2 class-call-positional ok=%s type=%s" % (bool(made_a), type(made_a)))
    except Exception as exc:
        print("PROBE2 class-call-positional error=%s" % exc)
    # Variant B: keyword Outer=/Name=
    try:
        made_b = unreal.StaticMeshComponent(Outer=outer, Name="ProbeMeshB")
        print("PROBE2 class-call-kwargs ok=%s type=%s" % (bool(made_b), type(made_b)))
    except Exception as exc:
        print("PROBE2 class-call-kwargs error=%s" % exc)
    # Variant C: SCS create_node (only if the door exists)
    if scs is not None and callable(getattr(scs, "create_node", None)):
        try:
            node = scs.create_node(unreal.StaticMeshComponent, "ProbeMeshC")
            print("PROBE2 scs-create_node ok=%s" % bool(node))
        except Exception as exc:
            print("PROBE2 scs-create_node error=%s" % exc)
    # Variant D: SCS add_node with a template (only if both doors exist)
    if scs is not None and callable(getattr(scs, "add_node", None)):
        print("PROBE2 scs-add_node present=True")
else:
    print("PROBE2 skipped creation variants (no outer)")

# Cleanup: remove the scratch blueprint either way.
try:
    unreal.EditorAssetLibrary.delete_asset(OBJ_PATH)
    print("PROBE2 cleanup deleted=True")
except Exception as exc:
    print("PROBE2 cleanup deleted=False error=%s" % exc)
