-- Crate — Phase 1 schema
-- Single Supabase project shared with the suite. RLS scoped by auth.uid().

create extension if not exists pgcrypto;

-- ── crate_tracks ──────────────────────────────────────────────
create table if not exists crate_tracks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  artist        text not null,
  bpm           int,
  key_camelot   text,
  key_musical   text,
  energy        int check (energy between 1 and 10),
  tags          jsonb default '[]'::jsonb,
  source_isrc   text,
  rekordbox_id  text,
  imported_at   timestamptz not null default now(),
  unique (user_id, rekordbox_id)
);
create index if not exists crate_tracks_user_idx on crate_tracks(user_id);
create index if not exists crate_tracks_bpm_idx  on crate_tracks(user_id, bpm);
create index if not exists crate_tracks_key_idx  on crate_tracks(user_id, key_camelot);

alter table crate_tracks enable row level security;
create policy "crate_tracks_owner" on crate_tracks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── listening_sessions ────────────────────────────────────────
create table if not exists listening_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  mode         text not null check (mode in ('wild','practice','booth')),
  venue_label  text,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz
);
create index if not exists sessions_user_idx on listening_sessions(user_id, started_at desc);

alter table listening_sessions enable row level security;
create policy "sessions_owner" on listening_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── caught_tracks ────────────────────────────────────────────
create table if not exists caught_tracks (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references listening_sessions(id) on delete set null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  artist        text not null,
  acr_provider  text not null check (acr_provider in ('audd','acrcloud')),
  acr_raw       jsonb,
  bpm           int,
  key_camelot   text,
  key_musical   text,
  energy        int check (energy between 1 and 10),
  source_isrc   text,
  starred       boolean not null default false,
  note          text,
  heard_at      timestamptz not null default now()
);
create index if not exists catches_user_idx     on caught_tracks(user_id, heard_at desc);
create index if not exists catches_session_idx  on caught_tracks(session_id);
create index if not exists catches_starred_idx  on caught_tracks(user_id) where starred;

alter table caught_tracks enable row level security;
create policy "catches_owner" on caught_tracks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── transition_suggestions ───────────────────────────────────
create table if not exists transition_suggestions (
  id                uuid primary key default gen_random_uuid(),
  caught_track_id   uuid not null references caught_tracks(id) on delete cascade,
  crate_track_id    uuid not null references crate_tracks(id) on delete cascade,
  rank              int  not null check (rank between 1 and 5),
  score             float not null,
  score_breakdown   jsonb not null,
  generated_at      timestamptz not null default now(),
  unique (caught_track_id, rank)
);
create index if not exists suggestions_catch_idx on transition_suggestions(caught_track_id);

alter table transition_suggestions enable row level security;
create policy "suggestions_via_catch" on transition_suggestions
  for all using (
    exists (
      select 1 from caught_tracks c
      where c.id = transition_suggestions.caught_track_id
        and c.user_id = auth.uid()
    )
  );

-- ── transition_history ───────────────────────────────────────
create table if not exists transition_history (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  source_caught_track_id   uuid not null references caught_tracks(id) on delete cascade,
  target_crate_track_id    uuid not null references crate_tracks(id) on delete cascade,
  rated                    int check (rated in (-1, 0, 1)),
  mixed_at                 timestamptz not null default now()
);
create index if not exists history_user_idx on transition_history(user_id, mixed_at desc);

alter table transition_history enable row level security;
create policy "history_owner" on transition_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── crate-imports storage bucket ─────────────────────────────
-- Run separately: select storage.create_bucket('crate-imports', false);
