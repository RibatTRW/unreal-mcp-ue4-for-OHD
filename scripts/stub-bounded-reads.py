#!/usr/bin/env python3
"""SHIP-S3 stub-world check: exercise the real bounded-read Python sources
(ue_get_world_outliner.py, ue_actor/10_query_ops.py) against a fake
250-actor level, with no Unreal editor.

The script files are exec'd with stubbed editor globals
(get_editor_world / get_all_level_actors / unreal_text / unreal /
get_actor_summary); __name__ is not "__main__" so main() never runs.
Each case asserts paging + truncation-envelope invariants and prints one
canonical JSON summary to stdout. scripts/check-bounded-reads.mjs
snapshots that summary.

Usage:
  python3 scripts/stub-bounded-reads.py
"""
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTLINER_PATH = os.path.join(REPO_ROOT, "server", "editor", "scripts", "ue_get_world_outliner.py")
QUERY_OPS_PATH = os.path.join(REPO_ROOT, "server", "editor", "scripts", "ue_actor", "10_query_ops.py")


class FakeVec(object):
    def __init__(self, x, y, z):
        self.x = x
        self.y = y
        self.z = z


class FakeRot(object):
    def __init__(self, pitch, yaw, roll):
        self.pitch = pitch
        self.yaw = yaw
        self.roll = roll


class FakeClass(object):
    def __init__(self, name):
        self._name = name

    def get_name(self):
        return self._name


class FakeComponent(object):
    def __init__(self, name):
        self._name = name

    def get_class(self):
        return FakeClass(self._name)


class FakeActor(object):
    def __init__(self, index, broken=False):
        self._index = index
        self._broken = broken

    def _guard(self):
        if self._broken:
            raise RuntimeError("broken actor")

    def get_name(self):
        self._guard()
        return "actor_%04d" % self._index

    def get_actor_label(self):
        self._guard()
        return "Label %04d" % self._index

    def get_class(self):
        self._guard()
        return FakeClass(["StaticMeshActor", "PointLight", "PlayerStart"][self._index % 3])

    def get_actor_location(self):
        self._guard()
        return FakeVec(float(self._index), 0.0, 10.0)

    def get_actor_rotation(self):
        self._guard()
        return FakeRot(0.0, 90.0, 0.0)

    def get_actor_scale3d(self):
        self._guard()
        return FakeVec(1.0, 1.0, 1.0)

    def is_hidden_ed(self):
        self._guard()
        return False

    def get_folder_path(self):
        self._guard()
        return "/Folder"

    def get_components_by_class(self, _cls):
        self._guard()
        return [FakeComponent("CompA"), FakeComponent("CompB")]


class FakeWorld(object):
    def get_name(self):
        return "StubWorld"


class FakeUnreal(object):
    ActorComponent = object


CURRENT_ACTORS = []


def stub_unreal_text(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value)


def stub_get_editor_world():
    return FakeWorld()


def stub_get_all_level_actors():
    return list(CURRENT_ACTORS)


def stub_get_actor_summary(actor):
    return {
        "name": actor.get_name(),
        "label": actor.get_actor_label(),
        "class": actor.get_class().get_name(),
    }


def load_source(path, extra_globals):
    with open(path, "r") as handle:
        source = handle.read()
    namespace = {"__name__": "stub", "__file__": path}
    namespace.update(extra_globals)
    exec(compile(source, path, "exec"), namespace)
    return namespace


OUTLINER = load_source(
    OUTLINER_PATH,
    {
        "get_editor_world": stub_get_editor_world,
        "get_all_level_actors": stub_get_all_level_actors,
        "unreal_text": stub_unreal_text,
        "unreal": FakeUnreal(),
    },
)

QUERY_OPS = load_source(
    QUERY_OPS_PATH,
    {
        "get_editor_world": stub_get_editor_world,
        "get_all_level_actors": stub_get_all_level_actors,
        "get_actor_summary": stub_get_actor_summary,
        "unreal_text": stub_unreal_text,
    },
)

CHECKS = 0
FAILURES = []


def check(label, condition, detail=""):
    global CHECKS
    CHECKS += 1
    if not condition:
        FAILURES.append("%s -- %s" % (label, detail))


def set_world(count, broken=()):
    global CURRENT_ACTORS
    CURRENT_ACTORS = [FakeActor(index, broken=index in broken) for index in range(count)]


def summarize(label, result):
    actors = result.get("actors") or []
    summary = {
        "case": label,
        "total_count": result.get("total_count"),
        "returned_count": result.get("returned_count"),
        "truncated": result.get("truncated"),
        "limit": result.get("limit"),
        "offset": result.get("offset"),
    }
    if actors:
        summary["first"] = actors[0].get("name")
        summary["last"] = actors[-1].get("name")
        summary["keys"] = sorted(actors[0].keys())
    return summary


SUMMARIES = []

# --- world_outliner, N=250 ---------------------------------------------
set_world(250)
get_world_outliner = OUTLINER["get_world_outliner"]

result = get_world_outliner()
SUMMARIES.append(summarize("outliner/defaults", result))
check("outliner defaults total", result["total_count"] == 250, json.dumps(SUMMARIES[-1]))
check("outliner defaults legacy total_actors", result["total_actors"] == 250)
check("outliner defaults returned", result["returned_count"] == 200)
check("outliner defaults truncated", result["truncated"] is True)
check("outliner defaults limit echo", result["limit"] == 200)
check("outliner defaults offset echo", result["offset"] == 0)
check("outliner defaults sorted", result["actors"][0]["name"] == "actor_0000")
check("outliner defaults page end", result["actors"][-1]["name"] == "actor_0199")
legacy_keys = {"name", "label", "class", "location", "rotation", "scale",
               "is_hidden", "folder_path", "components"}
check("outliner defaults legacy keys", legacy_keys <= set(result["actors"][0].keys()),
      str(sorted(result["actors"][0].keys())))

result = get_world_outliner(200, 200)
SUMMARIES.append(summarize("outliner/page2", result))
check("outliner page2", (result["returned_count"], result["truncated"]) == (50, False),
      json.dumps(SUMMARIES[-1]))
check("outliner page2 first", result["actors"][0]["name"] == "actor_0200")

result = get_world_outliner(200, 500)
SUMMARIES.append(summarize("outliner/beyond", result))
check("outliner beyond end", (result["returned_count"], result["truncated"]) == (0, False),
      json.dumps(SUMMARIES[-1]))

result = get_world_outliner(0, 0)
SUMMARIES.append(summarize("outliner/zero-limit", result))
check("outliner zero limit", (result["returned_count"], result["truncated"]) == (0, True),
      json.dumps(SUMMARIES[-1]))

result = get_world_outliner(9999, -5)
SUMMARIES.append(summarize("outliner/clamped", result))
check("outliner clamp limit", result["limit"] == 2000, json.dumps(SUMMARIES[-1]))
check("outliner clamp offset", result["offset"] == 0)
check("outliner clamp all returned", (result["returned_count"], result["truncated"]) == (250, False))

result = get_world_outliner(None, None, ["name", "class"])
SUMMARIES.append(summarize("outliner/fields", result))
check("outliner fields projection", all(sorted(a.keys()) == ["class", "name"] for a in result["actors"]),
      json.dumps(SUMMARIES[-1]))
check("outliner fields still paged", result["returned_count"] == 200 and result["truncated"] is True)

result = get_world_outliner(None, None, ["nope"])
check("outliner unknown fields ignored", all(a == {} for a in result["actors"]),
      str(result["actors"][:1]))

result = get_world_outliner(None, None, [])
check("outliner empty fields project to empty", all(a == {} for a in result["actors"]),
      str(result["actors"][:1]))
check("outliner empty fields still paged",
      (result["returned_count"], result["truncated"]) == (200, True))

# --- world_outliner, small world (legacy shape preserved) ---------------
set_world(3)
result = get_world_outliner()
SUMMARIES.append(summarize("outliner/small", result))
check("outliner small untruncated",
      (result["total_count"], result["returned_count"], result["truncated"]) == (3, 3, False),
      json.dumps(SUMMARIES[-1]))
check("outliner small names", [a["name"] for a in result["actors"]] ==
      ["actor_0000", "actor_0001", "actor_0002"])
check("outliner small components", result["actors"][0]["components"] == ["CompA", "CompB"])

# --- world_outliner, broken actor is counted but not serialized ---------
set_world(4, broken=(2,))
result = get_world_outliner()
SUMMARIES.append(summarize("outliner/broken", result))
check("outliner broken counted", result["total_count"] == 4)
check("outliner broken skipped", result["returned_count"] == 3)
check("outliner broken names", [a["name"] for a in result["actors"]] ==
      ["actor_0000", "actor_0001", "actor_0003"])

# --- get_actors_in_level, N=250 ------------------------------------------
set_world(250)
get_actors_in_level = QUERY_OPS["get_actors_in_level"]

result = get_actors_in_level({})
SUMMARIES.append(summarize("actor-list/defaults", result))
check("actor list defaults", result["success"] is True)
check("actor list defaults page",
      (result["total_count"], result["returned_count"], result["truncated"]) == (250, 200, True),
      json.dumps(SUMMARIES[-1]))
check("actor list defaults order",
      (result["actors"][0]["name"], result["actors"][-1]["name"]) == ("actor_0000", "actor_0199"))

result = get_actors_in_level({"limit": 50, "offset": 100})
SUMMARIES.append(summarize("actor-list/paged", result))
check("actor list paged",
      (result["returned_count"], result["truncated"]) == (50, True), json.dumps(SUMMARIES[-1]))
check("actor list paged first", result["actors"][0]["name"] == "actor_0100")

result = get_actors_in_level({"limit": 9999})
check("actor list clamp", result["limit"] == 2000 and result["returned_count"] == 250)

# --- find_actors_by_name --------------------------------------------------
find_actors_by_name = QUERY_OPS["find_actors_by_name"]

result = find_actors_by_name({"pattern": "actor_00"})
SUMMARIES.append(summarize("actor-find/narrow", result))
check("actor find count preserved", result["count"] == 100, json.dumps(SUMMARIES[-1]))
check("actor find narrow untruncated",
      (result["total_count"], result["returned_count"], result["truncated"]) == (100, 100, False))
check("actor find entry shape", result["actors"][0] ==
      {"name": "actor_0000", "label": "Label 0000", "class": "StaticMeshActor"},
      str(result["actors"][0]))

result = find_actors_by_name({"pattern": "actor", "limit": 50, "offset": 60})
SUMMARIES.append(summarize("actor-find/paged", result))
check("actor find paged",
      (result["total_count"], result["returned_count"], result["truncated"]) == (250, 50, True),
      json.dumps(SUMMARIES[-1]))
check("actor find paged first", result["actors"][0]["name"] == "actor_0060")

result = find_actors_by_name({"pattern": "zzz_no_match"})
check("actor find empty", (result["count"], result["actors"], result["truncated"]) == (0, [], False))

result = find_actors_by_name({"pattern": "   "})
check("actor find blank still rejected",
      result["success"] is False and result["message"] == "Pattern is required")

set_world(10)
CURRENT_ACTORS[3].get_actor_label = lambda: None
result = find_actors_by_name({"pattern": "zzz_no_match"})
check("actor find None label no crash",
      result["actors"] == [] and result["total_count"] == 0,
      json.dumps({"total_count": result.get("total_count"), "returned": result.get("returned_count")}))
result = find_actors_by_name({"pattern": "actor_0003"})
check("actor find None label still matched by name",
      len(result["actors"]) == 1 and result["actors"][0]["name"] == "actor_0003",
      str(result["actors"][:1]))

if FAILURES:
    sys.stderr.write("stub-bounded-reads: FAIL (%d/%d):\n" % (len(FAILURES), CHECKS))
    for failure in FAILURES:
        sys.stderr.write("  - %s\n" % failure)
    sys.exit(1)

sys.stderr.write("stub-bounded-reads: %d checks passed\n" % CHECKS)
print(json.dumps({"version": 1, "cases": SUMMARIES}, indent=2, sort_keys=True))
