# RRMCP editor-side prelude cache: warm-path guard (SHIP-S1).
#
# The TS renderer prepends this snippet INSTEAD OF the ~128KB static
# prelude. TS substitutes __RRMCP_PRELUDE_HASH__ (a plain token, never a
# dollar-brace template arg, so the arg codec and the py27 gate keep
# seeing static source)
# with the sha1 of the exact static prefix this call would have shipped.
#
# On a hit the cached namespace merges into globals and the action tail
# below runs unmodified. On a miss a single marker line is printed and
# the tail is NOT executed: the raise stops this payload before any tail
# statement runs, and the TS fallback resends the full prelude once.
#
# Version guard: entries written by an older registration protocol miss
# instead of executing against a stale layout (never partial exec).
import sys as _rrmcp_sys

_rrmcp_entry = _rrmcp_sys.modules.get("rrmcp_preludes", {}).get("__RRMCP_PRELUDE_HASH__")
_rrmcp_hit = _rrmcp_entry is not None and _rrmcp_entry.get("__rrmcp_version__") == 1
if not _rrmcp_hit:
    print("rrmcp:cache-miss:__RRMCP_PRELUDE_HASH__")
if not _rrmcp_hit:
    raise RuntimeError("rrmcp:cache-miss:__RRMCP_PRELUDE_HASH__")
globals().update(_rrmcp_entry)
