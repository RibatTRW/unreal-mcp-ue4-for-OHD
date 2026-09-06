"""Mock `unreal` module for host-side Python unit tests (arch-review W1).

Inside the editor, `unreal` is provided by UE's embedded interpreter and the
scripts under `server/editor/scripts/` are concatenated per package
(`server/editor/prelude-loader.ts`) and exec'd with that module available.
Outside the editor there is no `unreal`, so host-side tests install this
shim into `sys.modules` before loading a prelude package. See
`prelude_runner.py` for the loader that wires this up.

Only stub what tests need; extend per package as coverage grows. Backing
state is plain module-level data so tests can drive behaviour::

    import mock_unreal
    mock_unreal.install()
    mock_unreal.Paths.project_dir_path = "/tmp/fakeproj"
"""

import sys


# ---------------------------------------------------------------------------
# Configurable backing state (tests mutate this)
# ---------------------------------------------------------------------------
class _State:
    project_dir = "/tmp/mock-unreal-project"
    project_file_path = ""
    assets = {}          # path -> object
    saved_assets = []    # paths passed to save_asset
    level_actors = []    # actors "in the level"
    selected_actors = []  # subset "selected"


state = _State()


def reset():
    """Restore default backing state between tests."""
    state.project_dir = "/tmp/mock-unreal-project"
    state.project_file_path = ""
    state.assets = {}
    state.saved_assets = []
    state.level_actors = []
    state.selected_actors = []


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
class Paths:
    """Stub of unreal.Paths covering what the preludes call."""

    @staticmethod
    def project_dir():
        return state.project_dir

    @staticmethod
    def get_project_file_path():
        return state.project_file_path

    @staticmethod
    def project_content_dir():
        return state.project_dir + "/Content/"

    @staticmethod
    def convert_relative_path_to_full(relative_path):
        if relative_path.startswith("/"):
            return relative_path
        return state.project_dir + "/" + relative_path

    @staticmethod
    def file_exists(path):
        import os

        return os.path.exists(path)

    @staticmethod
    def directory_exists(path):
        import os

        return os.path.isdir(path)


# ---------------------------------------------------------------------------
# EditorAssetLibrary (minimal in-memory asset store)
# ---------------------------------------------------------------------------
class EditorAssetLibrary:
    @staticmethod
    def list_assets(base_path, recursive=True, include_folder=False):
        prefix = base_path.rstrip("/") + "/"
        return [p for p in state.assets if p == base_path or p.startswith(prefix)]

    @staticmethod
    def does_asset_exist(asset_path):
        return asset_path in state.assets

    @staticmethod
    def load_asset(asset_path):
        return state.assets.get(asset_path)

    @staticmethod
    def save_asset(asset_path, only_if_is_dirty=True):
        state.saved_assets.append(asset_path)
        return True

    @staticmethod
    def delete_asset(asset_path):
        return state.assets.pop(asset_path, None) is not None

    @staticmethod
    def duplicate_asset(source_path, dest_path):
        if source_path not in state.assets:
            return None
        state.assets[dest_path] = state.assets[source_path]
        return state.assets[dest_path]

    @staticmethod
    def get_path_name_for_loaded_asset(asset):
        for path, obj in state.assets.items():
            if obj is asset:
                return path
        return ""


# ---------------------------------------------------------------------------
# EditorLevelLibrary (minimal in-memory level)
# ---------------------------------------------------------------------------
class EditorLevelLibrary:
    @staticmethod
    def get_all_level_actors():
        return list(state.level_actors)

    @staticmethod
    def get_selected_level_actors():
        return list(state.selected_actors)

    @staticmethod
    def spawn_actor_from_class(actor_class, location=None, rotation=None):
        actor = {"class": actor_class, "location": location, "rotation": rotation}
        state.level_actors.append(actor)
        return actor


# ---------------------------------------------------------------------------
# Lightweight value types
# ---------------------------------------------------------------------------
class Vector:
    def __init__(self, x=0.0, y=0.0, z=0.0):
        self.x, self.y, self.z = x, y, z

    def __eq__(self, other):
        return (
            isinstance(other, Vector)
            and (self.x, self.y, self.z) == (other.x, other.y, other.z)
        )

    def __repr__(self):
        return "Vector(%r, %r, %r)" % (self.x, self.y, self.z)


class Rotator:
    def __init__(self, pitch=0.0, yaw=0.0, roll=0.0):
        self.pitch, self.yaw, self.roll = pitch, yaw, roll

    def __eq__(self, other):
        return (
            isinstance(other, Rotator)
            and (self.pitch, self.yaw, self.roll)
            == (other.pitch, other.yaw, other.roll)
        )

    def __repr__(self):
        return "Rotator(%r, %r, %r)" % (self.pitch, self.yaw, self.roll)


class Name(str):
    """unreal.Name coerces to FName; str is a faithful host stand-in."""


class FrameNumber:
    def __init__(self, value=0):
        self.value = value


# ---------------------------------------------------------------------------
# Free functions / logging used across preludes
# ---------------------------------------------------------------------------
def load_object(outer, name):
    return state.assets.get(name)


def load_class(outer, name):
    return name


def new_object(outer, cls, name=None, template=None):
    return {"class": cls, "name": name}


def get_editor_subsystem(subsystem_class):
    return {"subsystem": subsystem_class}


def log(message):
    pass


def log_warning(message):
    pass


def log_error(message):
    pass


def install():
    """Install this module as `unreal` in `sys.modules`; idempotent."""
    sys.modules.setdefault("unreal", sys.modules[__name__])
    sys.modules["unreal"] = sys.modules[__name__]
    return sys.modules[__name__]
