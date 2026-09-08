# RRMCP editor-side prelude cache: cold-path registration (SHIP-S1).
#
# Appended to a full-prelude payload so a cold editor stores the exec'd
# namespace under the content hash. TS substitutes
# __RRMCP_PRELUDE_HASH__ (a plain token, never a dollar-brace template
# arg) with the sha1 of
# the static prefix shipped above.
#
# The snapshot is taken first, before this trailer binds its own temps,
# so it holds exactly the prelude + tail + import names of the payload
# above (plus __builtins__, which rebinds to the same object on the warm
# path). The three pops drop warm-path temps that a previous cached run
# may have left in the session globals: they must never become part of a
# stored namespace. The version stamp is the protocol guard the shim
# checks before merging an entry back into globals.
_rrmcp_snapshot = dict(globals())
_rrmcp_snapshot.pop("_rrmcp_snapshot", None)
_rrmcp_snapshot.pop("_rrmcp_entry", None)
_rrmcp_snapshot.pop("_rrmcp_hit", None)
_rrmcp_snapshot["__rrmcp_version__"] = 1
import sys as _rrmcp_sys
_rrmcp_sys.modules.setdefault("rrmcp_preludes", {})["__RRMCP_PRELUDE_HASH__"] = _rrmcp_snapshot
