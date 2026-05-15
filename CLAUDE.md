# Crate — Claude Code Brief

You're picking up Crate, the sixth app in Nate's personal suite. The spec and mockups already exist. Read them before touching code.

---

## Read these first, in this order

1. **`../suite-context-Nate-Apps.md`** (if present at suite root) — the family Crate belongs to. Establishes the shared stack, design grammar, and workflow conventions across all six apps.
2. **`crate-spec.md`** — the full spec for this app. Read end to end before writing anything. Pay attention to the **Grammar — three-zone live cockpit** section; that's the load-bearing design decision.
3. **`mockups/01-stage-idle.html`**, **`02-stage-listening.html`**, **`03-stage-identified.html`** — the three core screens. Open them in a browser. The annotations toggle in the bottom-right of each overlays design rationale on hover.

---

## What this app is, in one line

Hear a track, identify it, get ranked transition suggestions from your own Rekordbox library. Save what catches your ear. Log what you actually played.

---

## What's already decided

These are settled — don't re-litigate without explicit go-ahead:

- **Name**: Crate
- **Palette**: booth red (`#120E0E` bg, `#E63946` accent, cream text)
- **Grammar**: three-zone live cockpit — Stage / Rail / Log. Not card stack, not edge-labeled.
- **ACR provider for v1**: AudD (simpler auth, clearer pricing). `acr_provider` column on `caught_tracks` lets us A/B against ACRCloud later.
- **Metadata source**: GetSongBPM primary (free, backlink required), SoundNet via RapidAPI as paid fallback.
- **Listening mode for v1**: tap-to-listen only. Always-on polling is a Phase 3 decision.
- **Rail size**: top 5 always.
- **"I played this next"**: persisted via long-press or swipe gesture, writes to `transition_history`.

---

## Stack — same as the rest of the suite

- Single-file `index.html` PWA
- GitHub Pages deploy (own repo)
- Direct browser-to-Supabase REST for everything except ACR
- Supabase Edge Function for ACR proxy only (API key cannot live in bundle)
- Direct Claude API calls from browser (for "why it fits" content, future tag inference)
- No build step, no framework, no bundler. Plain HTML/CSS/JS.
- iOS install-to-home-screen friendly

The Supabase project is shared with the other five apps. RLS on every Crate table, scoped by `auth.uid()`.

---

## Phase 1 — what to build

Spec section "Phasing" lays this out. Briefly:

- Supabase Auth (email magic link, matching the suite's pattern)
- Rekordbox XML import — file upload → in-browser DOMParser → upsert into `crate_tracks` by `rekordbox_id`. **Batch the upserts** (Supabase REST takes arrays) — libraries can be 10K+ tracks.
- ACR Edge Function (`acr-recognize`) — validates auth, forwards ~10s base64 audio to AudD, normalizes response, writes `caught_tracks` row server-side. Server-side write is deliberate; protects against network drops mid-catch.
- Metadata lookup — direct browser call to GetSongBPM by ISRC (when AudD returns one), SoundNet fallback when GetSongBPM misses.
- Ranking — in-browser, pure function. Formula in spec. Weights live in a config object; no UI to tune them in v1.
- The three core screens — Idle, Listening, Identified — wired together.
- Star to save (toggles `caught_tracks.starred`).
- Long-press a rail item → "played next" confirmation → writes to `transition_history`.

Out of scope for Phase 1: explicit session start/end (Phase 2), session review screen (Phase 2), always-on listening (Phase 3), tag inference (Phase 4), natural-language crate queries (Phase 4).

---

## Things to flag, not assume

Stop and ask before deciding any of these:

- **Audio capture format and length.** AudD works on 5–12s clips. We're targeting 10s. The exact codec/sample rate matters for ACR accuracy on noisy real-world audio. Don't pick silently.
- **The Camelot wheel logic for ranking.** Spec gives a starting formula. Adjacent ±1, relative major/minor, and energy boost (+7) all score differently. Don't approximate — implement it correctly or surface the question.
- **GetSongBPM backlink placement.** TOS-required. Most natural home is the credits/about view inside setup. Confirm before placing it anywhere else.
- **What "ended a session" means without explicit start/end in Phase 1.** v1 has no session UI. Either every catch in a 24h window is one implicit session, or every catch is its own session. Spec doesn't fully decide. Ask.
- **The fallback DSP path.** Nate has an existing music analyzer that can compute BPM/key locally. It's the fallback for tracks the ACR misses or that have no metadata in the lookup APIs. Hooking it in is Phase 1 *nice-to-have*, Phase 2 *must-have*. Ask whether to include it now or defer.

---

## Tone for Claude-generated content in the app

Suite-wide: short, direct, often slightly poetic. Crate-specific: DJ vernacular without affectation.

When generating "why it fits" explanations for rail items, lead with the technical fit, then the feeling if relevant:

- ✓ *"Same key, +2 BPM, drops the energy a notch — good cooldown move."*
- ✗ *"This track is in the same musical key as your current track and is 2 BPM faster..."*

You are the second voice in the booth. Not chatty.

---

## What this app doesn't do

Don't add scope. These are excluded by design:

- Audio playback. Crate listens, it doesn't play.
- DAW integration. One-way import from Rekordbox XML only.
- Social features. No sharing, no friends, no public sets.
- Recommending tracks the user doesn't own. Every rail item is from the user's Crate.

---

## File layout for this repo

```
crate/
├── index.html                  ← the app (single-file PWA)
├── crate-spec.md               ← the spec
├── CLAUDE.md                   ← this file
├── mockups/
│   ├── 01-stage-idle.html
│   ├── 02-stage-listening.html
│   └── 03-stage-identified.html
└── supabase/
    └── functions/
        └── acr-recognize/
            └── index.ts        ← the only Edge Function for v1
```

The spec and mockups live in the repo, not just in chat. They're the source of truth for what we're building.

---

## When in doubt

If a design decision isn't in the spec or the mockups, surface it as a question rather than guessing. Crate's grammar is deliberate — small consistency wins (or losses) compound across the suite.
