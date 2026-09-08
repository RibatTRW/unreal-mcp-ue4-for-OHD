#!/usr/bin/env python
"""W3 session-namespace spike driver — offline, no editor.

Executes the real spike sources (ue_text_codec prelude, ue_object_access
probe/world helpers, ue_session_namespace shim) plus tails rendered through
the unchanged M3 render seam, against a fake ``unreal`` module that stands
in for the editor transport. Covers:

  cold      — fresh interpreter recovers via the cold path.
  share     — per-call setup acquisitions before/after the session, on
              actor list + asset search + sequence create.
  stale     — level reload mid-session self-invalidates exactly once and
              the next call is clean; doubt (broken path) re-inits too.
  restart   — wiped namespace (editor restart) recovers cold.
  growth    — 200 calls against lowered caps stay bounded with eviction.
  envelope  — unknown-op and handler-throw envelopes.

Syntax stays 2.7-compatible (fidelity with the editor) but the harness runs
on python3. Prints SPIKE_NOTE lines and one SPIKE_RESULT JSON document;
exits nonzero on the first broken expectation.
"""

import io
import json
import sys
import time
import types


def fail(message):
    sys.stderr.write("SPIKE_FAIL " + message + "\n")
    sys.exit(1)


def note(message):
    sys.stdout.write("SPIKE_NOTE " + message + "\n")


def check(name, cond, detail=""):
    if cond:
        note("[PASS] " + name + (" — " + detail if detail else ""))
    else:
        fail(name + (" — " + detail if detail else ""))


# ---------------------------------------------------------------------------
# Fake editor transport (stub `unreal` module).
# ---------------------------------------------------------------------------

setup_calls = {"world": 0, "registry": 0, "actors": 0}
setup_time = [0.0]


def reset_meters():
    setup_calls["world"] = 0
    setup_calls["registry"] = 0
    setup_calls["actors"] = 0
    setup_time[0] = 0.0


class FakeWorld(object):
    def __init__(self, name, path):
        self._name = name
        self._path = path
        self.path_broken = False

    def get_name(self):
        return self._name

    def get_path_name(self):
        if self.path_broken:
            raise RuntimeError("path unavailable (simulated doubt)")
        return self._path


class FakeActor(object):
    def __init__(self, name):
        self._name = name

    def get_name(self):
        return self._name


class FakeAsset(object):
    def __init__(self, name, path, class_name):
        self.asset_name = name
        self.package_path = path
        self.asset_class_name = class_name


class FakeRegistry(object):
    def __init__(self, assets):
        self._assets = assets

    def get_all_assets(self):
        return list(self._assets)


class StubState(object):
    def __init__(self):
        self.world = FakeWorld("SpikeMap", "/Game/Maps/SpikeMap.SpikeMap")
        self.actors = [FakeActor("Actor_%03d" % i) for i in range(120)]
        self.assets = [
            FakeAsset("Asset_%03d" % i, "/Game/Folder/Asset_%03d" % i, "StaticMesh")
            for i in range(300)
        ]
        self.registry = FakeRegistry(self.assets)

    def reload_level(self):
        self.world = FakeWorld(
            "SpikeMap_Reloaded", "/Game/Maps/SpikeMap_Reloaded.SpikeMap_Reloaded"
        )

    def break_path(self):
        self.world.path_broken = True

    def fix_path(self):
        self.world.path_broken = False


STATE = StubState()

unreal = types.ModuleType("unreal")


class EditorLevelLibrary(object):
    @staticmethod
    def get_editor_world():
        start = time.time()
        try:
            setup_calls["world"] = setup_calls["world"] + 1
            return STATE.world
        finally:
            setup_time[0] = setup_time[0] + (time.time() - start)

    @staticmethod
    def get_all_level_actors():
        setup_calls["actors"] = setup_calls["actors"] + 1
        return list(STATE.actors)


class AssetRegistryHelpers(object):
    @staticmethod
    def get_asset_registry():
        start = time.time()
        try:
            setup_calls["registry"] = setup_calls["registry"] + 1
            return STATE.registry
        finally:
            setup_time[0] = setup_time[0] + (time.time() - start)


unreal.EditorLevelLibrary = EditorLevelLibrary
unreal.AssetRegistryHelpers = AssetRegistryHelpers
sys.modules["unreal"] = unreal


# ---------------------------------------------------------------------------
# Exec helpers (one shared dict = the editor interpreter across execs).
# ---------------------------------------------------------------------------

def read_text(path):
    with open(path, "r") as handle:
        return handle.read()


def fresh_namespace(sources):
    namespace = {}
    for label, source in sources:
        exec(compile(source, "<" + label + ">", "exec"), namespace)
    return namespace


def run_rendered(namespace, rendered):
    namespace["__name__"] = "__main__"
    buffer = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = buffer
    try:
        exec(compile(rendered, "<tail>", "exec"), namespace)
    finally:
        sys.stdout = old_stdout
        namespace["__name__"] = "spike"
    return json.loads(buffer.getvalue())


def run_snippet(namespace, snippet):
    namespace["__name__"] = "spike"
    exec(compile(snippet, "<snippet>", "exec"), namespace)


def main():
    if len(sys.argv) != 6:
        fail("usage: driver.py codec.py probe.py world.py shim.py tails_dir")
    codec_path, probe_path, world_path, shim_path, tails_dir = (
        sys.argv[1],
        sys.argv[2],
        sys.argv[3],
        sys.argv[4],
        sys.argv[5],
    )
    sources = [
        ("codec", read_text(codec_path)),
        ("probe", read_text(probe_path)),
        ("world", read_text(world_path)),
        ("shim", read_text(shim_path)),
    ]
    tails = {}
    for op in ("actor_list", "asset_search", "sequence_create"):
        tails[op] = read_text(tails_dir + "/" + op + ".rendered.py")

    base = fresh_namespace(sources)
    get_editor_world = base["get_editor_world"]
    unreal_text = base["unreal_text"]

    # --- cold: fresh interpreter recovers via the cold path ------------------
    cold_ns = fresh_namespace(sources)
    result = run_rendered(cold_ns, tails["actor_list"])
    check("cold actor_list succeeds", result.get("success") is True)
    check("cold actor_list count", result.get("count") == 120, repr(result.get("count")))
    check(
        "cold performs exactly one init",
        cold_ns["rrmcp_session"]["init_count"] == 1,
        repr(cold_ns["rrmcp_session"]["init_count"]),
    )
    check(
        "cold generation is known",
        cold_ns["rrmcp_session"]["generation"] != base["SESSION_GENERATION_UNKNOWN"],
    )

    # --- share: stateless baseline vs session, 60 calls per op ---------------
    share = {}

    def baseline_actor_list():
        world = get_editor_world()
        names = []
        for actor in base["get_all_level_actors"]():
            names.append(unreal_text(actor.get_name()))
        return {"world": unreal_text(world.get_name()), "names": names}

    def baseline_asset_search():
        registry = unreal.AssetRegistryHelpers.get_asset_registry()
        matches = []
        for asset in registry.get_all_assets():
            name = unreal_text(asset.asset_name)
            path = unreal_text(asset.package_path)
            if "asset_01" in name.lower() or "asset_01" in path.lower():
                matches.append(name)
        return matches

    def baseline_sequence_create(name):
        world = get_editor_world()
        return {"sequence": name, "world": unreal_text(world.get_name())}

    baselines = {
        "actor_list": lambda: baseline_actor_list(),
        "asset_search": lambda: baseline_asset_search(),
        "sequence_create": lambda: baseline_sequence_create("SpikeSequence"),
    }
    REPS = 60
    for op in ("actor_list", "asset_search", "sequence_create"):
        reset_meters()
        start = time.time()
        for _i in range(REPS):
            baselines[op]()
        base_total = time.time() - start
        base_setup = setup_time[0]
        base_acq = setup_calls["world"] + setup_calls["registry"]

        sess_ns = fresh_namespace(sources)
        reset_meters()
        start = time.time()
        last = None
        for _i in range(REPS):
            last = run_rendered(sess_ns, tails[op])
        sess_total = time.time() - start
        sess_setup = setup_time[0]
        sess_acq = setup_calls["world"] + setup_calls["registry"]
        check("session " + op + " succeeds", last.get("success") is True)
        share[op] = {
            "reps": REPS,
            "base_acq_per_call": round(base_acq / float(REPS), 3),
            "sess_acq_per_call": round(sess_acq / float(REPS), 3),
            "base_setup_share": round(base_setup / base_total, 3) if base_total > 0 else 0,
            "sess_setup_share": round(sess_setup / sess_total, 3) if sess_total > 0 else 0,
        }
        note(
            "share " + op + ": acq/call "
            + repr(share[op]["base_acq_per_call"])
            + " -> "
            + repr(share[op]["sess_acq_per_call"])
            + ", stub setup-time share "
            + repr(share[op]["base_setup_share"])
            + " -> "
            + repr(share[op]["sess_setup_share"])
        )

    # --- stale: level reload mid-session invalidates exactly once ------------
    stale_ns = fresh_namespace(sources)
    for _i in range(5):
        result = run_rendered(stale_ns, tails["actor_list"])
        check("stale warmup succeeds", result.get("success") is True)
    check(
        "stale warmup holds one init",
        stale_ns["rrmcp_session"]["init_count"] == 1,
    )
    STATE.reload_level()
    result = run_rendered(stale_ns, tails["asset_search"])
    check("post-reload call succeeds", result.get("success") is True)
    check(
        "reload self-invalidates exactly once",
        stale_ns["rrmcp_session"]["init_count"] == 2,
        repr(stale_ns["rrmcp_session"]["init_count"]),
    )
    result = run_rendered(stale_ns, tails["sequence_create"])
    check("next call succeeds", result.get("success") is True)
    check(
        "next call performs no re-init",
        stale_ns["rrmcp_session"]["init_count"] == 2,
        repr(stale_ns["rrmcp_session"]["init_count"]),
    )
    STATE.break_path()
    result = run_rendered(stale_ns, tails["actor_list"])
    check("doubt call still succeeds", result.get("success") is True)
    check(
        "doubt re-inits conservatively",
        stale_ns["rrmcp_session"]["init_count"] == 3,
        repr(stale_ns["rrmcp_session"]["init_count"]),
    )
    STATE.fix_path()

    # --- restart: wiped namespace recovers cold ------------------------------
    restart_ns = fresh_namespace(sources)
    result = run_rendered(restart_ns, tails["sequence_create"])
    check("restarted session recovers", result.get("success") is True)
    check(
        "restarted session inits once",
        restart_ns["rrmcp_session"]["init_count"] == 1,
    )

    # --- growth: 200 calls against lowered caps stay bounded -----------------
    growth_ns = fresh_namespace(sources)
    run_snippet(
        growth_ns,
        "SESSION_CACHE_CAPS['actors_by_name'] = 8\n"
        "SESSION_CACHE_CAPS['assets_by_path'] = 8\n"
        "SESSION_CACHE_CAPS['sequence_handles'] = 8\n",
    )
    run_snippet(
        growth_ns,
        "def _seq_put(args):\n"
        "    return session_cache_put('sequence_handles', args.get('sequence_name'), args.get('sequence_name'))\n"
        "for _gi in range(200):\n"
        "    session_cache_put('actors_by_name', 'actor_' + str(_gi), _gi)\n"
        "    session_cache_put('assets_by_path', '/Game/A_' + str(_gi), _gi)\n"
        "    session_dispatch('sequence_create', {'sequence_name': 'Seq_' + str(_gi)}, {'sequence_create': _seq_put})\n",
    )
    stats = growth_ns["session_stats"]()
    check(
        "growth actors cache bounded",
        stats["cache_sizes"]["actors_by_name"] <= 8,
        repr(stats["cache_sizes"]),
    )
    check(
        "growth assets cache bounded",
        stats["cache_sizes"]["assets_by_path"] <= 8,
        repr(stats["cache_sizes"]),
    )
    check(
        "growth sequence cache bounded",
        stats["cache_sizes"]["sequence_handles"] <= 8,
        repr(stats["cache_sizes"]),
    )
    check(
        "growth runs 200 dispatches",
        stats["dispatch_count"] == 200,
        repr(stats["dispatch_count"]),
    )
    check(
        "growth evicts oldest entries",
        growth_ns["session_cache_get"]("actors_by_name", "actor_0") is None,
    )
    check(
        "growth keeps newest entries",
        growth_ns["session_cache_get"]("actors_by_name", "actor_199") == 199,
    )

    # --- envelope: unknown op + handler throw --------------------------------
    env_ns = fresh_namespace(sources)
    run_snippet(
        env_ns,
        "ENV_RESULT_UNKNOWN = session_dispatch('nope', {}, {})\n"
        "def _boom(args):\n"
        "    raise RuntimeError('boom')\n"
        "ENV_RESULT_THROW = session_dispatch('x', {}, {'x': _boom})\n",
    )
    check(
        "unknown op envelope",
        env_ns["ENV_RESULT_UNKNOWN"].get("success") is False,
    )
    check(
        "handler throw envelope",
        env_ns["ENV_RESULT_THROW"].get("success") is False
        and env_ns["ENV_RESULT_THROW"].get("message") == "boom",
        repr(env_ns["ENV_RESULT_THROW"]),
    )

    summary = {
        "setup_acquisitions_per_call": share,
        "stale_reinits": stale_ns["rrmcp_session"]["init_count"],
        "growth_cache_sizes": stats["cache_sizes"],
        "growth_dispatches": stats["dispatch_count"],
    }
    sys.stdout.write("SPIKE_RESULT " + json.dumps(summary, sort_keys=True) + "\n")
    note("all spike scenarios green")


main()
