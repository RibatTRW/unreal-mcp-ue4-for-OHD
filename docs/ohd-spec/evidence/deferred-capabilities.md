# Deferred capabilities (SPEC section 3 expansive rule)

Per SPEC section 3, each expansive-rule probe failure is a deferred tool with
evidence, not a new scope debate. This file records the deferrals confirmed
by live `run_python` probes against the OHD kit (UE 4.25.4, Python 2.7.14).

## Widget viewport instantiation (deferred)

- Surface: `add_widget_to_viewport` (Partial) and the e2e widget viewport
  steps, which the harness reports as skips via the `unsupported_capability`
  signal instead of failures.
- Probe evidence: `scripts/probes/widget-surface-instantiate.py`,
  `scripts/probes/unreal-widgetlibrary-surface.py`,
  `scripts/probes/unreal-factory-surface.py`.
- Outcome (commit `d839d30`): generated widget classes are not callable on
  this build and no widget factory exists, so viewport instantiation steps
  are skipped as unsupported. Tree authoring and inspection remain supported;
  only instantiation is deferred.
- Revisit only if a constructible widget class or factory surface appears in
  a newer kit build.

## Advanced sequencer actions (deferred pending plugin enable + probe)

- Covered by `compat-4.25.md` (SequencerScripting ships OFF; scripting
  symbols absent from the live snapshot). No change here beyond that record.

## Source-control mutations without a provider (defined fallback, not deferred)

- Surface: the 14 provider-dependent mutation tools plus
  `revert_and_reload_packages` (Partial).
- Defined no-provider behavior (SPEC section 3): with no provider enabled,
  mutations return `success:false` with
  `unavailable:'source_control_no_provider'` and the provider snapshot
  instead of attempting the engine call
  (`server/editor/scripts/ue_source_control/20_mutation_ops.py`).
  Read tools (`get_source_control_provider`, `query_source_control_state(s)`)
  already report structured state with the provider disabled.
