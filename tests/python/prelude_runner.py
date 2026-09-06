"""Runner: load editor Python preludes on the host with the mock `unreal`.

Mirrors `server/editor/prelude-loader.ts`: files of one package directory
under `server/editor/scripts/` are exec'd in filename-sorted order into a
shared namespace, with the `mock_unreal` shim installed as `unreal` first.
That covers both styles used in the repo: `import unreal` (e.g.
`ue_text_codec/00_text_codec.py`, `ue_move_camera.py`) and bare-global
`unreal.*` references (every other prelude relies on the editor injecting
the global, so the runner pre-seeds it in the namespace).

Usage::

    from prelude_runner import load_package
    ns = load_package("ue_text_codec")
    ns["decode_template_arg"]("value", payload)

Every rendered editor script is textCodec + objectAccess + assetResolution +
widgetTree + body (`script-renderer.ts`), so later preludes freely use the
stdlib imports (`re`, `os`, `io`, `json`, ...) from `00_text_codec.py` as
globals. `load_package` therefore exec's `ue_text_codec` first by default
(`with_common=()` opts out), mirroring that assembly.
"""

import io
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_SCRIPTS_ROOT = os.path.normpath(
    os.path.join(_HERE, "..", "..", "server", "editor", "scripts")
)

sys.path.insert(0, _HERE)

import mock_unreal  # noqa: E402  (path wired above)


def load_package(package, scripts_root=_SCRIPTS_ROOT, extra_globals=None,
                 with_common=("ue_text_codec",)):
    """Exec every .py in `scripts_root/package` (sorted) into one namespace.

    Installs the mock `unreal` into `sys.modules` so `import unreal` inside
    the preludes resolves, and seeds it as a global for preludes that
    reference `unreal` without importing it. `with_common` lists packages
    exec'd first to mirror the renderer assembly (default: textCodec, whose
    stdlib imports later preludes rely on). Returns the namespace dict.
    """
    mock_unreal.install()
    namespace = {"unreal": sys.modules["unreal"]}
    if extra_globals:
        namespace.update(extra_globals)

    ordered = list(with_common or ()) + [package]
    seen = set()
    for pkg in ordered:
        if pkg in seen:
            continue  # e.g. load_package("ue_text_codec"): don't exec twice
        seen.add(pkg)
        _exec_package(scripts_root, pkg, namespace)
    return namespace


def _exec_package(scripts_root, package, namespace):
    package_dir = os.path.join(scripts_root, package)
    if not os.path.isdir(package_dir):
        raise ValueError("unknown prelude package: %r (%s)" % (package, package_dir))
    for file_name in sorted(os.listdir(package_dir)):
        if not file_name.endswith(".py"):
            continue
        file_path = os.path.join(package_dir, file_name)
        with io.open(file_path, encoding="utf-8") as handle:
            source = handle.read()
        code = compile(source, file_path, "exec")
        exec(code, namespace)
