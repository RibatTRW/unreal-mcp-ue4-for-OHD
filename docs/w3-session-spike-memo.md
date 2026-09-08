# SHIP-W3 memo: session-namespace spike — verdict STOP (deferred, not merged)

Date: 2026-09-08. Spike branch: `fm/unreal-w3-session-spike-01`. No editor was
available, so every number below is offline evidence; live profiling is
marked not-run throughout. Per the brief, session machinery is NOT merged on
offline evidence alone.

## Question

After S1, does per-call setup (world/registry handle resolution, repeated
every stateless `exec`) dominate enough that a persistent editor-side session
namespace (`rrmcp_session` + generation counter) earns a real ship?

## What was built (spike only, 4 new files, zero modified files)

- `server/editor/scripts/ue_session_namespace.py` — the Adapter: `rrmcp_session`
  dict (world/registry handles, generation, three bounded caches with caps
  512/512/64, init/dispatch counters), `session_init`,
  `session_ensure_current` (conservative: any doubt re-inits),
  `session_get_world` / `session_get_asset_registry`, bounded
  `session_cache_put` with oldest-first eviction, `session_dispatch` entry
  point, `session_stats`. Same `EncodedArg` codec, py2.7-clean.
- `server/editor/scripts/ue_session_dispatch_tail.py` — spike tail addressed
  through the UNCHANGED M3 seam (`renderEditorScript` + `jsonArg`, no TS
  Interface change) with three ops mirroring the real setup paths: actor
  list, asset search, sequence create.
- `scripts/session-spike-driver.py` + `scripts/check-session-spike.mjs` —
  offline gate: py27 gate, render-seam probe (zero unrendered tokens, exact
  blob round-trips), then cold/share/stale/restart/growth/envelope scenarios
  on python3 against a fake `unreal` transport.
- Re-run: `npm run build && node scripts/check-session-spike.mjs`
  (green 2026-09-08), plus `npm run typecheck` and `npm run test:no-unreal`
  (both green; no snapshot/README churn).

## Numbers

Per-call setup acquisitions (world + registry handle resolutions), 60 calls
per op, fake transport:

| op | stateless acq/call | session acq/call | stub setup-time share before → after |
|---|---|---|---|
| actor list | 1.0 | 1.05 | 0.012 → 0.000 |
| asset search | 1.0 | 1.05 | 0.004 → 0.000 |
| sequence create | 1.0 | 1.05 | 0.149 → 0.000 |

The 1.05 is one fingerprint lookup per call plus amortized cold init. The
stub time shares are CPython-harness artifacts (microsecond stub lookups vs
millisecond exec overhead), NOT editor evidence — they must not be read as
a setup-share finding.

Staleness fault injection: 5 clean calls hold `init_count == 1`; simulated
level reload → next call succeeds with exactly one self-invalidation
(`init_count == 2`); following call succeeds with no further re-init
(stays 2). Broken world-path (doubt) → succeeds and re-inits
conservatively (3). Wiped namespace (editor restart) → cold recovery,
`init_count == 1`. Unknown-op and handler-throw dispatch envelopes both
return `{success: False, ...}`.

Growth: 200 dispatches against caps lowered to 8/8/8 → sizes exactly
8/8/8, `dispatch_count == 200`, oldest entries evicted, newest kept. No
unbounded structure exists in the shim (fixed key set + capped caches).

## Verdict: STOP

Do not schedule a real session ship on this evidence, for two independent
reasons:

1. **Missing gate (decisive).** The W3 gate is S1's LIVE setup-time share,
   which is not-run (no editor on Linux). Offline proxies cannot promote a
   stateful-seam ship with silent-corruption risk. If S1's live numbers later
   show setup is small, this stays STOP; only a large live setup share plus
   a live fault-injection pass flips it to GO.
2. **Negative structural finding (spike value).** The prototype shows the
   generation guard as designed re-pays one world lookup per call to check
   the fingerprint — so per-call handle acquisitions go 1.0 → ~1.05, i.e.
   the guard costs roughly what it saves. A real ship would first need a
   generation signal CHEAPER than `get_editor_world` (e.g. a level-load event
   hook rather than a per-call query), otherwise the session can only ever
   save the registry acquisition plus import re-resolution (which is S1's
   territory anyway). The harness also caught a real bug class during the
   spike: nested `session_get_*` inside a dispatch re-fingerprinted every
   call (2.05 acq/call, double re-init on doubt) until dispatch ensured
   exactly once with a re-entrancy guard — any future ship must keep that
   single-ensure shape.

## What a GO would require

S1 live profile showing per-call setup (not wire bytes) dominant on at
least one of actor list / asset search / sequence create; a cheap
generation signal confirmed against a live level load; live fault injection
(reload mid-session → one re-init, recover next call); 200-call live growth
check. Until then: no merge, spike retained on this branch for reference.
