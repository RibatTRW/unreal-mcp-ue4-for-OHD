# Probe 3: retry SCS/generated-class with PascalCase names + class-call variants.
# Creates a scratch Actor blueprint, probes, then deletes it.
# Keep 2.7-clean. Prints PROBE3 lines only.

import unreal

PKG = "/Game/MCP/Tests"
NAME = "ProbeComp_TMP"
OBJ_PATH = PKG + "/" + NAME


def try_read(target, names):
    for prop_name in names:
        try:
            value = target.get_editor_property(prop_name)
            if value is not None:
                return prop_name, value
        except Exception:
            pass
        try:
            value = getattr(target, prop_name)
            if value is not None:
                return prop_name, value
        except Exception:
            pass
    return None, None


tools = unreal.AssetToolsHelpers.get_asset_tools()
factory = unreal.BlueprintFactory()
factory.set_editor_property("ParentClass", unreal.Actor)
created = tools.create_asset(NAME, PKG, unreal.Blueprint, factory)
print("PROBE3 blueprint created=%s" % bool(created))

bp = unreal.EditorAssetLibrary.load_asset(OBJ_PATH)

scs_name, scs = try_read(
    bp, ("SimpleConstructionScript", "simple_construction_script")
)
print("PROBE3 bp scs via=%s present=%s" % (scs_name, bool(scs)))

gen_class = None
try:
    gen_class = bp.generated_class()
    print("PROBE3 generated_class() ok=%s" % bool(gen_class))
except Exception as exc:
    print("PROBE3 generated_class() error=%s" % exc)

if gen_class is None:
    try:
        gen_class = unreal.EditorAssetLibrary.load_blueprint_class(OBJ_PATH)
        print("PROBE3 load_blueprint_class ok=%s" % bool(gen_class))
    except Exception as exc:
        print("PROBE3 load_blueprint_class error=%s" % exc)

if gen_class is None:
    try:
        gen_class = unreal.load_class(None, OBJ_PATH + "." + NAME + "_C")
        print("PROBE3 load_class _C ok=%s" % bool(gen_class))
    except Exception as exc:
        print("PROBE3 load_class _C error=%s" % exc)

if gen_class is not None and scs is None:
    scs_name, scs = try_read(
        gen_class, ("SimpleConstructionScript", "simple_construction_script")
    )
    print("PROBE3 class scs via=%s present=%s" % (scs_name, bool(scs)))

if scs is not None:
    print("PROBE3 scs create_node=%s" % callable(getattr(scs, "create_node", None)))
    print("PROBE3 scs add_node=%s" % callable(getattr(scs, "add_node", None)))

cdo = None
if gen_class is not None:
    try:
        cdo = unreal.get_default_object(gen_class)
    except Exception as exc:
        print("PROBE3 cdo error=%s" % exc)
print("PROBE3 cdo present=%s" % bool(cdo))

outer = cdo if cdo is not None else gen_class
if outer is not None:
    try:
        made_a = unreal.StaticMeshComponent(outer, "ProbeMeshA")
        print("PROBE3 class-call-positional ok=%s" % bool(made_a))
    except Exception as exc:
        print("PROBE3 class-call-positional error=%s" % exc)
    try:
        made_b = unreal.StaticMeshComponent(Outer=outer, Name="ProbeMeshB")
        print("PROBE3 class-call-kwargs ok=%s" % bool(made_b))
    except Exception as exc:
        print("PROBE3 class-call-kwargs error=%s" % exc)
else:
    print("PROBE3 skipped creation variants (no outer)")

try:
    unreal.EditorAssetLibrary.delete_asset(OBJ_PATH)
    print("PROBE3 cleanup deleted=True")
except Exception as exc:
    print("PROBE3 cleanup deleted=False error=%s" % exc)
