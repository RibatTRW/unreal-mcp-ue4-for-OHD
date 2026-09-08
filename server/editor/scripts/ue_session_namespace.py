# W3 session-namespace SPIKE — not shipped, not merged.
#
# Offline prototype for the architecture-review go/no-go memo: an
# editor-lifetime namespace (rrmcp_session) holding generation-guarded
# world/registry handles plus bounded per-generation caches, with a dispatch
# entry point addressed through the UNCHANGED render seam
# (renderEditorScript + the same EncodedArg codec). No TS Interface change.
#
# Persistence model: this file is exec'd into the editor interpreter once;
# the try/except NameError guard below keeps the first rrmcp_session alive
# across later per-call execs (which only re-exec action tails). An editor
# restart wipes the interpreter, so the next call rebuilds cold — the same
# cold path as today, no new failure mode.
#
# Invalidation policy is deliberately conservative: any doubt re-inits.
# The live editor signals behind the fingerprint (level load, restart) are
# approximated here by world name + path; a real ship must confirm which
# editor signals reliably change on map load before trusting the cache.
#
# Depends only on globals the render seam always provides today:
# unreal_text from the ue_text_codec prelude and get_editor_world from the
# ue_object_access prelude. Everything here parses under 2.7 (py27 gate).

try:
    rrmcp_session
except NameError:
    rrmcp_session = {
        "generation": None,
        "world": None,
        "asset_registry": None,
        "caches": {
            "actors_by_name": {},
            "assets_by_path": {},
            "sequence_handles": {},
        },
        "init_count": 0,
        "dispatch_count": 0,
        "in_dispatch": False,
    }

SESSION_CACHE_CAPS = {
    "actors_by_name": 512,
    "assets_by_path": 512,
    "sequence_handles": 64,
}

SESSION_GENERATION_UNKNOWN = "<unknown>"


def session_generation_now():
    try:
        world = get_editor_world()
    except Exception:
        return SESSION_GENERATION_UNKNOWN
    if world is None:
        return SESSION_GENERATION_UNKNOWN
    try:
        world_name = unreal_text(world.get_name())
    except Exception:
        return SESSION_GENERATION_UNKNOWN
    try:
        world_path = unreal_text(world.get_path_name())
    except Exception:
        world_path = SESSION_GENERATION_UNKNOWN
    if world_path == SESSION_GENERATION_UNKNOWN:
        return SESSION_GENERATION_UNKNOWN
    return world_name + "\n" + world_path


def session_init():
    world = get_editor_world()
    try:
        registry = unreal.AssetRegistryHelpers.get_asset_registry()
    except Exception:
        registry = None
    rrmcp_session["world"] = world
    rrmcp_session["asset_registry"] = registry
    rrmcp_session["generation"] = session_generation_now()
    for cache_name in rrmcp_session["caches"]:
        rrmcp_session["caches"][cache_name] = {}
    rrmcp_session["init_count"] = rrmcp_session["init_count"] + 1
    return True


def session_ensure_current():
    try:
        if rrmcp_session.get("in_dispatch"):
            # A dispatch already validated this generation; the editor runs
            # one exec single-threaded, so nothing can stale mid-dispatch.
            # Without this guard every nested session_get_* re-pays a full
            # fingerprint lookup per call (found by the spike harness).
            return False
    except Exception:
        pass
    try:
        now_generation = session_generation_now()
    except Exception:
        now_generation = SESSION_GENERATION_UNKNOWN
    try:
        live_generation = rrmcp_session.get("generation")
        cached_world = rrmcp_session.get("world")
    except Exception:
        live_generation = None
        cached_world = None
    if (
        now_generation == SESSION_GENERATION_UNKNOWN
        or live_generation != now_generation
        or cached_world is None
    ):
        session_init()
        return True
    return False


def session_get_world():
    session_ensure_current()
    try:
        return rrmcp_session.get("world")
    except Exception:
        return None


def session_get_asset_registry():
    session_ensure_current()
    try:
        registry = rrmcp_session.get("asset_registry")
    except Exception:
        registry = None
    if registry is None:
        try:
            registry = unreal.AssetRegistryHelpers.get_asset_registry()
        except Exception:
            registry = None
        try:
            rrmcp_session["asset_registry"] = registry
        except Exception:
            pass
    return registry


def session_cache_get(cache_name, key):
    try:
        return rrmcp_session["caches"][cache_name].get(key)
    except Exception:
        return None


def session_cache_put(cache_name, key, value):
    try:
        cache = rrmcp_session["caches"][cache_name]
    except Exception:
        return value
    try:
        cap = SESSION_CACHE_CAPS.get(cache_name, 64)
    except Exception:
        cap = 64
    if key not in cache and len(cache) >= cap:
        try:
            oldest = next(iter(cache))
            del cache[oldest]
        except Exception:
            pass
    cache[key] = value
    return value


def session_dispatch(operation, args, handlers):
    session_ensure_current()
    try:
        rrmcp_session["in_dispatch"] = True
    except Exception:
        pass
    try:
        result = _session_dispatch_inner(operation, args, handlers)
    finally:
        try:
            rrmcp_session["in_dispatch"] = False
        except Exception:
            pass
    return result


def _session_dispatch_inner(operation, args, handlers):
    try:
        rrmcp_session["dispatch_count"] = rrmcp_session["dispatch_count"] + 1
    except Exception:
        pass
    try:
        handler = handlers.get(operation)
    except Exception:
        handler = None
    if handler is None:
        return {
            "success": False,
            "message": "Unknown session operation: " + unreal_text(operation),
        }
    try:
        return handler(args or {})
    except Exception as exc:
        return {"success": False, "message": unreal_text(exc)}


def session_stats():
    sizes = {}
    try:
        for cache_name in rrmcp_session["caches"]:
            try:
                sizes[cache_name] = len(rrmcp_session["caches"][cache_name])
            except Exception:
                sizes[cache_name] = -1
    except Exception:
        pass
    try:
        init_count = rrmcp_session.get("init_count", -1)
    except Exception:
        init_count = -1
    try:
        dispatch_count = rrmcp_session.get("dispatch_count", -1)
    except Exception:
        dispatch_count = -1
    try:
        generation = unreal_text(rrmcp_session.get("generation"))
    except Exception:
        generation = SESSION_GENERATION_UNKNOWN
    return {
        "init_count": init_count,
        "dispatch_count": dispatch_count,
        "generation": generation,
        "cache_sizes": sizes,
        "cache_caps": dict(SESSION_CACHE_CAPS),
    }
