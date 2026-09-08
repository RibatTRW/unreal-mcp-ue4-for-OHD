# W3 session-namespace SPIKE tail — not shipped, not merged.
#
# Demonstrates addressing the rrmcp_session namespace through the UNCHANGED
# render seam: two codec blobs (operation + args) substituted by
# renderEditorScript, zero new TS surface. The three ops mirror the real
# per-call setup paths under test (actor list, asset search, sequence
# create): each takes its world/registry handle from the session instead of
# re-resolving it, and parks generation-stable lookups in bounded caches.
#
# Caching honesty notes for the memo: the actor enumeration itself is NOT
# cached (spawns change mid-generation); only the session handles and
# package-keyed class labels are. A real ship needs a reimport/mutation
# invalidation story before caching anything content-derived.
import json


def spike_actor_list(args):
    world = session_get_world()
    if world is None:
        return {"success": False, "message": "No world loaded"}
    try:
        world_label = unreal_text(world.get_name())
    except Exception:
        return {"success": False, "message": "No world loaded"}
    names = []
    for actor in get_all_level_actors():
        try:
            names.append(unreal_text(actor.get_name()))
        except Exception:
            continue
    return {
        "success": True,
        "world": world_label,
        "count": len(names),
        "actors": names,
    }


def spike_asset_search(args):
    registry = session_get_asset_registry()
    if registry is None:
        return {"success": False, "message": "No asset registry"}
    try:
        wanted = unreal_text((args or {}).get("search_term") or "").lower()
    except Exception:
        wanted = unreal_text("")
    matches = []
    for asset in registry.get_all_assets():
        try:
            package_path = unreal_text(asset.package_path)
            asset_name = unreal_text(asset.asset_name)
        except Exception:
            continue
        label = session_cache_get("assets_by_path", package_path)
        if label is None:
            try:
                label = unreal_text(asset.asset_class_name)
            except Exception:
                label = unreal_text("")
            session_cache_put("assets_by_path", package_path, label)
        if wanted in asset_name.lower() or wanted in package_path.lower():
            matches.append({"name": asset_name, "path": package_path, "class": label})
    return {"success": True, "search_term": wanted, "count": len(matches), "assets": matches}


def spike_sequence_create(args):
    world = session_get_world()
    if world is None:
        return {"success": False, "message": "No world loaded"}
    try:
        wanted = unreal_text((args or {}).get("sequence_name") or "SpikeSequence")
    except Exception:
        wanted = unreal_text("SpikeSequence")
    handle = session_cache_get("sequence_handles", wanted)
    found = handle is not None
    if not found:
        handle = {"sequence": wanted, "world": unreal_text(world.get_name())}
        session_cache_put("sequence_handles", wanted, handle)
    return {"success": True, "sequence": handle, "reused": found}


SESSION_SPIKE_OPERATIONS = {
    "actor_list": spike_actor_list,
    "asset_search": spike_asset_search,
    "sequence_create": spike_sequence_create,
}


def main():
    operation = decode_template_json("""${operation}""")
    args = decode_template_json("""${args}""")
    result = session_dispatch(operation, args or {}, SESSION_SPIKE_OPERATIONS)
    print(json.dumps(result, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
