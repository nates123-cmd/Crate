# Crate — Status

## Phase 1 — what's in this build

UI-shell with mock data. End-to-end interactive, no live backend yet.

**Working in the browser:**
- Three-zone live cockpit (Stage / Rail / Log) per spec
- Stage states: idle → listening → identified → miss
- 10-second mock listen flow (real timer, fake ACR result)
- Pure-function ranking against a 24-track mock crate library
  - Camelot wheel: same key 1.0, adjacent / relative 0.8, energy boost (+7) 0.6, else 0
  - BPM: 1.0 within ±3%, linear falloff to 0 at ±8%
  - Energy delta, tag Jaccard, freshness (flat 1.0 for now)
- Tap rail row → expand score breakdown
- Long-press rail row → "Played this next?" confirmation → writes to local history
- Tap log row → restore that catch to stage, regenerate rail
- Star toggle inline on log rows (persists)
- 24-hour implicit session window — log shows everything caught in last 24h
- Library view: search + BPM filter chips + starred-catches filter
- Setup view: real Rekordbox XML parser (DOMParser, dedupes by Rekordbox ID, persists to localStorage); credential fields for Supabase / GetSongBPM / RapidAPI
- GetSongBPM backlink in Setup credit footer (per TOS)
- LocalStorage persistence across reloads

**Stubbed but not live:**
- `supabase/functions/acr-recognize/index.ts` — full AudD-backed Edge Function ready to deploy
- `supabase/migrations/0001_init.sql` — schema for all 5 Phase 1 tables with RLS
- `manifest.json` — PWA install metadata (no icons yet)

## Decisions taken (per Nate's go-ahead)

- **Sessions**: 24h implicit window. Each catch within last 24h = same session in the UI. Explicit start/end lands in Phase 2.
- **Audio format**: MediaRecorder webm/opus, 10s. Locked when the Edge Function ships.
- **DSP fallback**: deferred to Phase 2. Phase 1 surfaces "No metadata — can't rank." cleanly.
- **API integration**: UI shell first; live wiring follows.

## What's next (to ship Phase 1 fully)

1. Stand up Supabase project + apply `0001_init.sql`
2. Deploy `acr-recognize` Edge Function with AudD token in env
3. Wire Supabase Auth (email magic-link) — mirror the suite's pattern
4. Replace the mock ACR flow in `index.html` with:
   - MediaRecorder capture (webm/opus, 10s)
   - base64 encode + POST to `acr-recognize`
   - On success, read returned `caught_tracks` row instead of building one client-side
5. Wire GetSongBPM ISRC lookup (browser → API directly with stored key)
6. Replace localStorage crate with Supabase REST upsert (batch 200/request)

## What's deliberately out of scope for Phase 1

- Always-on listening (Phase 3 — depends on Phase 1 usage data)
- Tag inference via Claude API (Phase 4)
- Session review screen with transition ratings (Phase 2)
- Local DSP fallback for ACR misses (Phase 2)
- Natural-language crate queries (Phase 4)
- Service worker / offline cache
- PWA icons

## Open question to revisit

The mock currently picks "wild" tracks from a cycling pool with a 15% miss rate. That's instrumentation for feel — real ACR will have its own miss profile. Once AudD is wired, decide whether to surface confidence on the stage (e.g., show "low confidence" badge below `Caught it`) or hide it.
