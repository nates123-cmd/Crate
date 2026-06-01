# Crate — QA Testing Plan

Automated harness for the Crate single-file PWA. **Additive only** — no app source is
modified, no build step is introduced. Tests drive the app's **real code** in a real
browser (Playwright + Chromium), calling the actual `window`-scoped functions via
`page.evaluate`. Logic is never re-implemented in the tests.

- **App under test:** `index.html` (one inline classic `<script>`, no framework/bundler).
- **Framework:** Playwright Test. Served via `python3 -m http.server 8217 --directory ..`
  (baseURL `http://localhost:8217`, `reuseExistingServer: true`).
- **How real internals are reached:** top-level `function` declarations are already on
  `window` in a classic script. The block-scoped `const CONFIG` / `state` / `CAMELOT_MAP`
  are not — so the fixture appends a one-line re-export (`window.CONFIG=CONFIG; …`) to the
  **served** HTML response only. The on-disk app is untouched and the exposed objects are
  the *same instances* the app's functions close over.

Run: `cd tests && npm install && npx playwright test`

---

## NOT covered (gaps / deliberate exclusions)

These carry real risk but are **not** exercised here. Listed first on purpose.

1. **ACR / AudD recognition flow + Supabase Edge Function** (`acr-recognize`, mic capture,
   `MediaRecorder`, base64 audio). Requires real mic, network, and server-side secrets.
   No coverage.
2. **Metadata waterfall network lookups** (`lookupSongstats` / `lookupSoundNet` /
   `lookupGetSongBpm`). These hit live third-party APIs with auth keys; their internal
   normalization (e.g. AudD key-number → musical → Camelot) is only indirectly covered via
   `musicalToCamelot`. The waterfall *ordering / fallthrough* logic in the catch handler is
   untested.
3. **Rekordbox XML / TXT-MyTags import + merge** (`DOMParser`, the `normKey` title/artist
   join, color/rating/tag enrichment). Per STATUS.md this code is "slated for deletion"
   in the Supabase pivot, so it was de-prioritized. Untested.
4. **Persistence round-trip** (`load` / `save` against `localStorage`) and the
   session-window restore-to-stage logic in `init()`. Not directly asserted.
5. **`reasonFor` natural-language copy** — generated, exercised only insofar as `rankRail`
   asserts the reason string is non-empty. Exact wording ("cooldown move" etc.) not pinned.
6. **Full UI interaction** — mic tap → listening → identify state machine, long-press
   "played next", star toggling, scope-toggle buttons. Only static render presence is
   smoke-checked.
7. **Cross-browser** — Chromium only.

---

## Risk-ranked coverage

### Risk 1 (highest) — Camelot wheel harmonic compatibility — `camelot.spec.js`
CLAUDE.md explicitly flags this: *"Don't approximate — implement it correctly."* Subtle,
high-blast-radius math (wheel wrap, directional +7 energy boost, relative maj/minor).
Covers `parseCamelot`, `keyCompat`, `musicalToCamelot`:
- same key → 1.0; adjacent ±1 same letter → 0.8; relative maj/minor → 0.8;
  directional +7 same letter → 0.6; else 0.
- wheel wrap (12↔1), the **directionality** of +7 (the −7/+5 reverse must score 0),
  letter-mismatch rejection, out-of-range/garbage/null inputs.
- `musicalToCamelot`: minor/major maps, unicode ♭/♯ normalization, Open Key (m/d),
  Camelot pass-through, null/unknown.

### Risk 2 — Track ranking / suggestion scoring — `ranking.spec.js`
The core "suggestion machine." Covers `bpmCompat`, `energyMatch`, `tagOverlap`,
`scoreTransition`, `rankRail`:
- `bpmCompat`: 1.0 inside 3% perfect band, 0 at/over 8% zero band, linear falloff between,
  null handling.
- `energyMatch`: 0.1/step falloff, clamp at distance 10, neutral 0.5 on missing energy.
- `tagOverlap`: Jaccard (intersection/union), no-overlap 0, empty/null 0.
- `scoreTransition`: perfect self-transition = 1.0 with all-1 breakdown; `total` always
  equals the weighted sum of `breakdown` (guards weight/breakdown drift).
- `rankRail`: ≤ `railSize`, descending sort, ranks 1..n, every item has non-empty
  reason + breakdown + positive score, empty-metadata source → empty rail, no zero-score
  leakage.

### Risk 3 — Library filtering/search + ranking-pool scope — `library.spec.js`
Covers the real `renderLibrary` filter pipeline (driven via `state` + DOM assertions) and
the pure `effectiveCrate`:
- text query across title / artist / Camelot key (case-insensitive).
- BPM bands (100-120 inclusive-low exclusive-high; 120-130; 130+ inclusive).
- `colored`, `txt`, `rated4`/`rated5` (≥ thresholds), `starred` (title|artist key into
  catches), ascending BPM sort with null→0 ordering, "N of N" count.
- `effectiveCrate`: all / colored / `crateRequireTxt`, composability, and that `rankRail`
  honors the narrowed pool.

### Boot / smoke — `smoke.spec.js`
App loads with **no uncaught page errors**, all expected window globals exist after
`init()`, `CONFIG.weights` sum to 1.0, the three-zone cockpit (Stage / Rail / Log) renders,
mock crate seeds ≥ 20 tracks.

---

## Real app bugs found

None. All 57 assertions pass against the real code; the harness found no defects in the
ranking, Camelot, or filtering logic. (The `const`-not-on-`window` situation is correct app
scoping, not a bug — handled by the additive served-response shim described above.)
