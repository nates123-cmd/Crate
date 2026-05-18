# Crate — Spec

A DJ companion. Hear a track, identify it, get ranked transition suggestions from your own library. Save what catches your ear. Log what you actually played.

The sixth app in the suite. Functional-but-different dialect: not a card stack, not edge-labeled. A three-zone live cockpit.

---

## ⚑ Direction update — 2026-05-18 (supersedes conflicting sections below)

After building the Phase 1 UI shell and a long metadata-provider investigation, the project pivoted. **Read this section first; where it conflicts with the original spec below, this wins.**

**Primary use case is home set-building, not the live booth.** Nate's words: "a more-interesting suggestion machine." The value is the *quality/interestingness of transition suggestions* against records he owns — not on-the-go recognition. This reprioritizes everything.

**Metadata strategy — resolved.** The web-API hunt (GetSongBPM → SoundNet → Songstats) was solving the wrong half:
- GetSongBPM: pop-skewed, whiffs on underground. SoundNet: free tier 429s, accuracy unvalidated. Spotify audio-features: dead for new apps (deprecated Nov 2024, new-app creation disabled Dec 2025).
- Songstats *is* the right web source (Spotify-grade, ISRC-exact) **but** it's Enterprise/sales-gated at €25/mo minimum — not worth it for an audience of one *now* (revisit if Crate gets users). Free test key still worth validating as the *on-the-go* path only; **off the critical path.**
- **The real source already exists locally and free:** Nate's Mixed In Key DB (`~/Library/Application Support/Mixedinkey/Collection11.mikdb`, 94 tracks, pro BPM/Camelot/energy 1–10) + his `~/music-analyzer` tool (3-tier DSP+Gemini+custom: BPM, key+Camelot, energy mean/peak/timeline, sections, mood, genre, harmonic complexity, + a personal model predicting his energy-stars/tags/color).

**Architecture pivot — local enrichment, not in-browser import.** `pyrekordbox` reads the live Rekordbox DB directly (4,744 tracks; 3,542 with local files; 855 Purple + 569 Blue ≈ 1,424 curated). This obsoletes the in-browser XML/TXT/colour/normKey import entirely (it gets gutted). New shape:

- **Local sync script** (`tools/sync_library.py`, runs on Mac, reuses the music-analyzer venv; read-only on Rekordbox so it's safe with RB open): read Rekordbox → resolve BPM/key/energy via local free waterfall (MIK DB → existing `.analysis.json` → flag "needs analysis") → batched upsert to shared Supabase `crate_tracks`, keyed by stable Rekordbox `content.ID` (no fuzzy matching).
- **Crate PWA** stops importing anything; reads `crate_tracks` from Supabase. This finally moves Crate onto the shared suite Supabase project (was localStorage-only).
- `crate_tracks` schema extends with mood/genre/energy-arc/sections/harmonic/bpm-source/confidence so the ranking engine has depth.

**Phasing (revised):**
- **Phase A — library enrichment + Supabase onboarding.** A1: build `tools/sync_library.py` + schema migration + wire Crate to Supabase, using the 94 MIK + 123 already-analyzed tracks (no new analysis runs). A2: run music-analyzer batch (DSP-only pass fast; rich AI/personal pass overnight via the existing checkpointed `batch_tag_library.py` pattern) to fill coverage.
- **Phase B — ranking engine v2.** Beyond key+BPM+energy+tags: mood, energy trajectory, genre adjacency, section-aware mixability, with a UI **intent selector** ("build / hold / cool down / go deeper") that re-ranks the rail. This is the "more-interesting suggestion machine."

**Status at restart (2026-05-18):** investigation complete, design agreed in principle, **A1 not yet started** — awaiting Nate's go-ahead to gut the in-browser import, wire Supabase, and write `sync_library.py` + the schema migration. Phase 1 UI shell (mock + AudD direct test mode + the 3-provider metadata waterfall code) remains committed and deployed at https://nates123-cmd.github.io/Crate/.

---

## What it does

You're somewhere with music — a bar, a friend's set, a record store, your own kitchen. You open Crate, tap the mic, and ten seconds later the app tells you what's playing, what key/BPM/energy it sits at, and which five tracks from your Crate would mix best into it. Tap one to mark it "played next." Tap the star on anything to save it for later listening.

The library is your soul. Crate is built around your Rekordbox export.

---

## Three use cases

1. **In the wild** — you hear something out, catch it, save it for later digging
2. **At home / practice** — you're listening to a reference mix or a track and scouting which of your records would work next
3. **In the booth** — live DJ assist, fast identification and ranked suggestions

Tap-to-listen for all three in v1. Always-on listening (background ACR polling) is a Phase 2 decision once we see real usage patterns.

---

## Grammar — the three-zone live cockpit

This app doesn't inherit either of the suite's existing dialects. It has its own.

```
┌──────────────────────────────┐
│                              │
│   STAGE                      │  ~40% screen height
│   currently playing          │  dominant mass
│   or listening state         │
│                              │
├──────────────────────────────┤
│   RAIL                       │  ~35%
│   top 5 transitions          │  ranked list
│   from your Crate            │
├──────────────────────────────┤
│   LOG                        │  ~25%
│   this session's catches     │  scrollable
└──────────────────────────────┘
```

**Stage** — the currently identified track. Track title, artist, Camelot key, BPM, energy rating. Visual pulse when listening. Becomes the visual anchor of the app.

**Rail** — five ranked transition candidates from your library. Compact rows, not cards. Each row shows: track title, artist, key, BPM, and a one-line "why it fits" (key match, BPM delta, energy curve). Tap to expand for full score breakdown. Long-press or swipe to mark "I played this next" → writes to `transition_history`.

**Log** — every track caught in the current session, time-indexed (`heard 12m ago`), tappable to revisit (restores it to the stage, regenerates the rail against the current crate). Catches you starred get a filled marker.

The hierarchy is structural, not size-based. The live track is categorically more important than anything else on screen.

---

## Two primary states

**Idle / listening**
- Stage shows a pulsing mic indicator with the cream-on-near-black accent
- Microcopy: `Listening…` while capturing, `Caught it.` when resolved
- Rail empty (or shows last session's most-recent identified track + its rail, ghosted)
- Log shows current session's catches if any

**Identified**
- Stage settles into focus — pulse stops, text resolves in
- Rail populates with ranked suggestions underneath, top-down stagger
- Log grows by one row

Transition between states is the defining moment. It should feel like the stage *resolves*, not like a card flies in or a notification pops. Slight ease-out on text, accent pulse decelerates to stop.

---

## Sessions

A session is a continuous listening context — you open Crate, hit "start session," catch some tracks, end it. Sessions have:

- A `mode` — `wild` / `practice` / `booth` (set at start, affects rail tuning later)
- An optional `venue_label` (free text, e.g. "Joe's set at Public Records")
- A start and end timestamp
- All catches and rail interactions roll up under the session

Ending a session is explicit. No auto-close. Course-style: you decide when the work is done.

---

## Palette — booth red

| Element | Value | Notes |
|---|---|---|
| Background | `#120E0E` | Near-black, red in its bones |
| Stage surface | `#1A1414` | One tonal step lighter |
| Card / row surface | `#221A1A` | Two steps lighter |
| Accent (primary) | `#E63946` | CDJ amber-red, saturated |
| Accent (pulse / live) | `#FF5560` | Slightly warmer when listening |
| Text primary | `#F2E8DC` | Cream/bone, not white |
| Text secondary | `#9C8B85` | Muted warm gray, dim booth lighting |
| Text tertiary | `#5E504C` | Almost a whisper |
| Divider | `#2A2020` | Just above bg, subtle |

Three-layer depth holds: background → surface → nested element.

---

## Typography

Consistent with suite conventions:
- App title: large + heavy
- Stage track title: bold, oversized (the hero text of the screen)
- Rail/log titles: bold, medium
- Body: lighter, slightly muted
- Numbers (BPM, key, energy): outsized, tabular figures, accent-colored

The Camelot key gets its own treatment — large, monospaced, accent-colored. It's the most actionable single piece of data on the screen.

---

## Microcopy register

DJ vernacular without affectation. Short, direct.

- `Listening…` (in flight)
- `Caught it.` (success)
- `Couldn't catch that one.` (ACR miss)
- `3 from your Crate fit.` (rail header when fewer than 5)
- `Heard 12m ago` (log timestamp)
- `Played this next` (rail action confirmation)

"Catch" is the canonical verb. Caught tracks go to the log. Keepers get starred.

---

## Data model

One Supabase project, shared with the suite. RLS on every table.

### `crate_tracks`
The imported Rekordbox library. Your soul.

- `id` (uuid, pk)
- `user_id` (uuid, fk auth.users)
- `title` (text)
- `artist` (text)
- `bpm` (int)
- `key_camelot` (text, e.g. `8A`)
- `key_musical` (text, e.g. `Am`) — derived, kept for display
- `energy` (int, 1-10)
- `tags` (jsonb) — your custom tags
- `source_isrc` (text, nullable) — universal id when Rekordbox provides one
- `rekordbox_id` (text) — for re-import deduplication
- `imported_at` (timestamptz)

### `listening_sessions`
A continuous listening context.

- `id` (uuid, pk)
- `user_id` (uuid, fk)
- `mode` (text: `wild` / `practice` / `booth`)
- `venue_label` (text, nullable)
- `started_at` (timestamptz)
- `ended_at` (timestamptz, nullable)

### `caught_tracks`
Every track identified during a session.

- `id` (uuid, pk)
- `session_id` (uuid, fk)
- `user_id` (uuid, fk) — denormalized for RLS
- `title` (text)
- `artist` (text)
- `acr_provider` (text: `audd` / `acrcloud`) — A/B audit column
- `acr_raw` (jsonb) — full response, in case we need to re-derive anything
- `bpm` (int, nullable)
- `key_camelot` (text, nullable)
- `energy` (int, nullable)
- `source_isrc` (text, nullable)
- `starred` (bool, default false) — your "save for later"
- `note` (text, nullable) — optional capture note
- `heard_at` (timestamptz)

### `transition_suggestions`
Generated rankings, persisted for later inspection and tuning.

- `id` (uuid, pk)
- `caught_track_id` (uuid, fk)
- `crate_track_id` (uuid, fk)
- `rank` (int, 1-5)
- `score` (float)
- `score_breakdown` (jsonb) — `{key: 0.9, bpm: 0.7, energy: 0.5, tags: 0.3}`
- `generated_at` (timestamptz)

### `transition_history`
What you actually played next.

- `id` (uuid, pk)
- `user_id` (uuid, fk)
- `source_caught_track_id` (uuid, fk)
- `target_crate_track_id` (uuid, fk)
- `rated` (int, nullable, -1 / 0 / 1) — optional after-the-fact rating
- `mixed_at` (timestamptz)

### Storage
- `crate-imports` bucket — Rekordbox XML uploads, signed URL pattern

---

## Architecture

Single-file PWA, GitHub Pages. Direct browser-to-Supabase REST for everything except the ACR proxy.

### ACR Edge Function

`acr-recognize` — Supabase Edge Function. Browser sends ~10s of base64-encoded audio (or a presigned upload URL to a short clip in Storage). The function:

1. Validates the user via Supabase Auth
2. Forwards to the configured ACR provider (AudD or ACRCloud) with the server-held API key
3. Returns normalized response: `{ title, artist, isrc?, provider, confidence, raw }`
4. Writes the caught_track row server-side (so we never lose a catch to a flaky client connection)

Provider is a runtime config — flip a flag, the function points at the other ACR. The `acr_provider` column on `caught_tracks` records which one served the request, so an A/B period is just running with both for a stretch and querying which one had a higher catch rate or better confidence.

### Metadata lookup

When the ACR returns an ISRC, the browser hits the metadata API directly (no proxy needed — these keys are less sensitive and rate-limited per-IP).

- Primary: GetSongBPM (free, with required backlink on the about/credits view — needs to be present per their TOS)
- Fallback: SoundNet via RapidAPI when GetSongBPM has no match

If neither has it, the track lands in the Stage without key/BPM data and the rail shows: `No metadata — can't rank.` This is a real state and the UI has to handle it cleanly.

### Ranking

In-browser. Pure function over the caught track and the user's `crate_tracks`. Default formula:

```
score =
  0.35 * key_compat(target.camelot, source.camelot) +
  0.25 * bpm_compat(target.bpm, source.bpm) +
  0.20 * energy_match(target.energy, source.energy) +
  0.15 * tag_overlap(target.tags, source.tags) +
  0.05 * freshness(target_last_played)
```

`key_compat` uses the Camelot wheel: same key = 1.0, adjacent (±1 or relative major/minor) = 0.8, energy boost (+7) = 0.6, else 0.

`bpm_compat`: 1.0 within ±3%, linear falloff to 0 at ±8%, zero beyond. (We can revisit half-time/double-time matching once we see how often it comes up in practice.)

Weights live in a config object the user can tune later. v1 ships with the defaults above and no UI to change them.

### Rekordbox import

Two-step flow:
1. User uploads `rekordbox.xml` via file input → Storage bucket
2. Browser parses the XML, extracts `<TRACK>` entries, upserts into `crate_tracks` by `rekordbox_id`

XML parsing happens in-browser with DOMParser. No backend processing needed. Re-imports update existing rows rather than duplicating.

Future: a desktop watcher that syncs the encrypted `master.db` automatically. Not v1.

---

## Screens

Six screens. Five active, one setup.

1. **Home (Idle)** — Stage in idle/listening state, rail empty or showing last identified, log shows session catches. Big mic button bottom-center.
2. **Home (Identified)** — Same layout, populated. Mic button shrinks to a small re-listen control.
3. **Catch detail** — Full info on a single caught track. Camelot wheel visualization, full metadata, note field, star toggle, "regenerate rail" if your crate has changed.
4. **Crate library** — Searchable list of your imported tracks. Filter by key, BPM, tags. Used for browsing, not v1-critical but should exist.
5. **Session review** — End-of-session screen. Lists all catches, all "played next" decisions. Optional rating pass on transitions. Closes the session.
6. **Setup** — Import Rekordbox XML, set defaults, link Supabase account.

---

## Phasing

**Phase 1 — Catch + rank**
- Auth via Supabase
- Rekordbox XML import flow
- Tap-to-listen → ACR Edge Function → caught_track row
- Metadata lookup against ISRC
- Ranking against crate_tracks
- Stage + Rail + Log UI
- Star to save, tap rail item to mark "played next"

**Phase 2 — Sessions + history**
- Explicit session start/end
- Session review screen
- Mode and venue label
- Transition rating

**Phase 3 — Always-on listening**
- Background polling loop (decide on cadence based on Phase 1 data)
- AudD stream subscription evaluation
- Battery-aware throttling

**Phase 4 — Library intelligence**
- Tag inference via Claude API on imported tracks
- Natural language crate queries ("show me everything around 124 that mixes into G-minor stuff")
- Pattern surfacing from transition_history ("you mix into A-minor 73% of the time after F-minor")

---

## What Crate doesn't do

- Audio playback. It listens, it doesn't play. Use your DJ software for that.
- DAW integration. Crate doesn't talk to Rekordbox at runtime, only imports from it.
- Social. No sharing, no friends, no public sets. The library is yours.
- Recommend tracks you don't own. Every rail item is something already in your Crate.

---

## External integrations

- **AudD or ACRCloud** — ACR via Edge Function proxy
- **GetSongBPM** — metadata lookup, free tier, backlink required
- **SoundNet** (RapidAPI) — metadata fallback, paid
- **Rekordbox** — XML import only, one-way

---

## Tone for Claude content

When Claude generates content for Crate (rail "why it fits" explanations, future natural-language responses):

- Tight, DJ-fluent, no hand-holding
- Lead with the technical fit, then the feeling if relevant
- *"Same key, +2 BPM, drops the energy a notch — good cooldown move."*
- Not: *"This track is in the same musical key as your current track and is 2 BPM faster..."*

Claude is the second voice in the booth. Not chatty.
