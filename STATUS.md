# Crate — Status

_Last updated 2026-05-18, before a machine restart. See the "⚑ Direction update" section at the top of `crate-spec.md` for the full reasoning — this is the operational summary._

## Where we are

**Phase 1 UI shell: built, committed, deployed.** https://nates123-cmd.github.io/Crate/ (auto-redeploys on push to `main`). Repo: https://github.com/nates123-cmd/Crate. Local: `~/Documents/Claude-Code-projects/Crate App/crate`.

Working in the deployed app:
- Three-zone cockpit (Stage / Rail / Log); states idle → listening → identifying → identified → miss/error
- Real mic capture (MediaRecorder, live audio meter, stop button) + **AudD direct test mode** — recognition works end-to-end, returns ISRC
- Ranking engine (Camelot wheel, BPM tolerance, energy, tag Jaccard) — works against the imported library
- Metadata waterfall wired: **Songstats (ISRC) → SoundNet (title/artist) → GetSongBPM**, each with a "Test … now" button in Setup
- In-browser library import: Rekordbox XML + TXT/MyTags merge, stars, colors (⚠ **slated for deletion** — see pivot)
- localStorage persistence (Crate is **not yet on Supabase**)

## The pivot (decided, not yet built)

Primary use case clarified: **home set-building — "a more-interesting suggestion machine"**, not the live booth. This de-prioritizes on-the-go/Songstats and prioritizes deep local library enrichment + a richer ranking engine.

Metadata is solved **locally and free**, not via web APIs:
- **Mixed In Key DB** — `~/Library/Application Support/Mixedinkey/Collection11.mikdb`, 94 tracks, pro BPM + Camelot + energy 1–10 (ZSONG: ZNAME/ZARTIST/ZTEMPO/ZKEY/ZENERGY/ZTAGENERGY).
- **`~/music-analyzer`** — 3-tier analyzer; rich schema (dsp.bpm, dsp.key+camelot, custom.energy_mean/peak/timeline, sections, harmonic_complexity, ai.mood/genre, personal.predicted_rating/tags/color). 123 `.analysis.json` already exist in `~/Music`. Venv at `~/music-analyzer/.venv`.
- **`pyrekordbox`** (in that venv) reads the live Rekordbox DB directly — read-only is safe with RB open. 4,744 tracks / 3,542 with files / 855 Purple + 569 Blue ≈ 1,424 curated. Gives stable `content.ID`, title, artist, FolderPath, ColorID, MyTags, Rating, Genre. **Obsoletes the in-browser import.**

## Next action (awaiting go-ahead)

**Phase A1** — gut the in-browser XML/TXT import; wire Crate to the shared suite Supabase project (`xsmnfcmtbpeaccnyinkr`); write `tools/sync_library.py` (Rekordbox read → MIK + existing `.analysis.json` join → batched upsert to `crate_tracks` keyed by Rekordbox content.ID); extend the `crate_tracks` schema (mood/genre/energy-arc/sections/harmonic/bpm-source/confidence). Use only the 94 MIK + 123 analyzed tracks — no new analysis runs in A1.

**Phase A2** — run the analyzer batch to fill coverage (DSP-only pass first ≈ fast; rich AI/personal pass overnight via existing checkpointed `batch_tag_library.py` pattern).

**Phase B** — ranking v2: mood / energy-trajectory / genre-adjacency / section-aware scoring + a UI intent selector ("build / hold / cool down / go deeper").

## Parked / de-prioritized

- **Songstats** — right web source but €25/mo Enterprise minimum, not worth it for solo use now. Free test key requested from rep (Evan Sacks) for the *on-the-go* path only; revalidate if Crate gets users. Not the critical path.
- SoundNet (free tier 429s), GetSongBPM (whiffs on underground), Spotify audio-features (dead for new apps) — all dead ends, documented in `crate-spec.md`.
- Always-on listening (Phase 3), session review (Phase 2), service worker / PWA icons.

## Risks / notes for next session

- Phase A **deletes** the recent in-browser import code (hundreds of lines). Intentional — superseded by the sync script. Nate okayed the direction; confirm before deleting.
- Crate moving onto Supabase is new scope folded into Phase A (was deferred).
- MIK/Rekordbox join is by **file path / content.ID**, not fuzzy title — clean.
- Don't write to the Rekordbox DB from the sync (read-only). `batch_tag_library.py` is the only thing that writes RB, and it refuses to run while RB is open.
