# Safety rules (normative for all builder and AI work)

1. **Throwaway test mod first.** All experiments run in a content-only mod made via Create Mod (the live `ProbeThrowaway` mod exists for this). Never probe, generate into, or cook shipped content (`Plugins/OML|OOV|ORS|OSB|DLC`, `HDAssets`, engine content).
2. **Play-mode checks before keeping.** Changes are validated with PIE + screenshots before they count as done.
3. **Project-level switches are reversible; content edits may not be.** Enabling plugins / remote execution (writes `.uproject`, `DefaultEngine.ini`) is fine. Touching `.umap`/`.uasset` files outside the sandbox is not.
4. **Package against the pinned release** (`PackageUGCAgainstGameReleaseVersion`) for local testing/sharing; Workshop upload is a manual human step under the workshop terms.
5. **2.7-clean always.** Any Python reaching the editor must parse under 2.7.14 — lint it before sending.
