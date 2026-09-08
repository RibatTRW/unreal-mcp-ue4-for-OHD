# SHIP-W1: Batch-path design-it-twice memo

- Status: memo landed; offline prototype green (`scripts/check-batch-prototype.mjs`,
  wired into `test:no-unreal`). **Live gate NOT RUN — no UE4 editor on Linux.**
- Constraint honored: S1/S2/S3/S4 seams untouched. This ship adds one doc plus one
  offline harness; no registrar, renderer, transport, or session file changed.
- Recommendation entering and leaving the comparison: **(b) harness-level chaining**.

## 1. The two designs

### (a) `run_batch` envelope-in/envelope-out through the namespace seam

New action `run_batch { calls: [{ tool, action, params }] }` registered on the
existing namespace seam (`registerToolNamespace`). The server fans the N calls out
— either as N sequential `ConnectionSessionService.runCommand` trips (keeps every
existing envelope, but keeps all N wire+exec serializations: no win at all), or by
fusing the N scripts server-side into one payload (which re-implements the
harness-chaining assembler one layer up, duplicating the M3 codec Interface in a
second place).

### (b) Harness-level chaining: N EncodedArg blobs, one exec

One script carries N `(operation, args)` blob-pairs through the existing
`ue_tools_dispatch.py` harness in a single `exec`. The script reuses the one
render seam (`renderDomainScript`): shared prelude + harness + `OPERATIONS` table
paid once, then a chaining stanza decodes each pair with the same
`decode_template_json` codec, dispatches through the same `OPERATIONS` table as a
single call, and collects per-call result envelopes in order. The prototype stanza
lives in `scripts/check-batch-prototype.mjs` (`BATCH_CHAIN_STANZA`); the only
production-shaped artifact is that stanza text.

## 2. Comparison on Depth, Locality, seam placement

| Axis | (a) envelope-in/envelope-out | (b) harness chaining |
|---|---|---|
| Depth (Leverage per unit Interface) | Shallow: a parallel envelope world (`calls[]` in, `results[]` out, partial-failure schema, ordering guarantees) whose Interface is nearly as complex as its Implementation. Fan-out variant has zero Leverage (N trips remain). | Deep: zero new TS Interface. The existing M3 codec Interface (`jsonArg`/`EncodedArg`/`decode_template_json`) gains its second Adapter (single-pair vs N-pair), so by the one-Adapter-hypothetical/two-Adapters-real test the seam becomes real instead of hypothetical. |
| Locality (one place vs N callers) | Failure Locality leaks: partial-failure semantics, ordering, and atomicity questions land on every `run_batch` caller and every client parsing the new envelope. | Failure Locality stays inside the harness: per-call `try/except` already exists in `dispatch_main`; the stanza repeats that pattern per call. Callers keep reading the per-call envelopes they already parse. |
| Seam placement | Cuts a new seam at the namespace layer for a single hypothetical Adapter — exactly what the skill forbids. | No new seam. Render seam (`renderDomainScript`), codec seam (`EncodedArg`), dispatch seam (`OPERATIONS` table) all reused unchanged. |

Kill-shot against (a): its fuse-server-side variant converges on re-implementing (b)
with the assembler in the wrong layer (TS string surgery instead of harness-native
chaining), while its fan-out variant wins nothing. (b) dominates on all three axes.

## 3. Interface contract (binding on any future production batch path)

- **Per-call envelopes.** The outer payload reports transport/exec success only;
  each call yields its own `{success, ...}` result envelope in `results[]`.
- **Sequential, non-atomic.** Calls run in list order; a failed call does not roll
  back earlier calls and does not skip later ones. Documented in the Interface,
  never implied otherwise.
- **Never throw the batch.** Unknown operation and handler exception both fold into
  that call's envelope (`Unknown batch operation: …` / exception text). The batch
  `exec` itself throws only when the harness is broken (missing table, undecodable
  blob list) — i.e. a programming error, not a call failure.
- **Codec discipline.** Every arg crosses `jsonArg` → `decode_template_json`; no
  raw interpolation (the `check-py27` `${...}` rule applies to the stanza).
- **py2.7 grammar.** The stanza uses `.format`, `range`, `len`, `continue`,
  `try/except` only — no f-strings, no `str(`, no walrus, no bare `super()`.

## 4. Offline evidence (this ship, no editor)

`scripts/check-batch-prototype.mjs` renders 3 real singles through
`renderDomainScript` (the same seam callers use) and asserts:

- byte-count: 3-call batch (one shared carrier + stanza) strictly smaller than 3
  singles (in this worktree: ~140 KB carrier vs ~421 KB sum — the shared prelude
  paid once; conservative: the carrier still holds the first single's dead blobs);
- ordering: the 3 operation/args blob-pairs decode in order to the exact inputs;
- failure locality: executed under python3 with stubbed `OPERATIONS`
  (ok / unknown-op / raising-handler), results are
  `[success, Unknown-batch-operation failure, exception failure]` in order inside
  one outer `{"success": true}` envelope — the batch never throws;
- py2.7 gate: the stanza passes the ported subset of `check-py27` bans;
- no unrendered `${...}` outside the substituted codec sites.

## 5. Live gate (NOT RUN — no editor on Linux) and kill condition

Gate, when an editor exists: wall-clock 20× single `actor list` vs 20× batched
(4 batches × 5) on a fixture level, same harness as baseline §6
(`probe-once.mjs`, `run-e2e.mjs` style). Pass bar: batched clearly faster
(serial-exec is the binding constraint).

**If the live gate fails, kill the idea.** Rationale: S1 (editor-side prelude cache)
already takes the wire win (~94% per call); batching's remaining prize is purely
exec-serialization, and editor `exec` seriality bounds it. A failed gate means the
bound bit — schedule nothing, keep this memo as the record. Do not re-litigate
without new live numbers.
