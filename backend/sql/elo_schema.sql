-- ============================================================
-- CORE ELO RANKING SCHEMA  (ideas, rounds, matchups, votes, scorehistory)
-- ------------------------------------------------------------
-- The base tables the ELO scoring loop reads and writes. These had only
-- ever lived in the Supabase dashboard; this file version-controls them so
-- the data model lives with the code. Mirrors what the backend actually
-- selects/inserts/updates (see src/routes/* and src/services/ratings.ts).
--
-- Idempotent: every object uses `if not exists`, so this is safe to run
-- against the live, already-migrated database (it will be a no-op there).
--
-- Run this in the Supabase SQL editor. Intended run order:
--   users (external, Supabase auth-backed) -> elo_schema.sql -> party_schema.sql
--   -> migrations/*  (the migrations only ALTER columns/indexes that this
--   file already includes, so they become no-ops once this has run).
--
-- `rounds.party_id` is intentionally NOT defined here. party_schema.sql adds
-- it via `alter table rounds add column if not exists party_id ...` after the
-- `parties` table exists, which keeps this file free of a forward reference
-- to a table created later, and matches how the column was added in reality.
-- ============================================================

-- An idea competing in the ranking. curr_score is its live ELO rating.
create table if not exists ideas (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  "desc"      text,                              -- quoted: `desc` is a reserved word
  curr_score  integer not null default 1200,     -- mirrors STARTING_ELO in src/elo/elo.ts
  curr_rank   integer,                           -- recomputed after every vote (recomputeRanks)
  created_by  uuid references users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ideas_created_by_idx on ideas (created_by);

-- A voting round. status = true means open/active.
create table if not exists rounds (
  id         uuid primary key default gen_random_uuid(),
  round_num  integer not null,
  status     boolean not null default false      -- true = active, false = closed
  -- party_id added by party_schema.sql (see header)
);

-- A pairing of two ideas assigned to one user within a round.
create table if not exists matchups (
  id        uuid primary key default gen_random_uuid(),
  round_id  uuid not null references rounds (id),
  user_id   uuid not null references users (id),
  idea_a    uuid not null references ideas (id),
  idea_b    uuid not null references ideas (id),
  status    boolean not null default false       -- false = open, true = voted
);

create index if not exists matchups_round_idx on matchups (round_id);
create index if not exists matchups_user_idx  on matchups (user_id);

-- The recorded outcome of a matchup. One vote per (matchup, user).
create table if not exists votes (
  id          uuid primary key default gen_random_uuid(),
  matchup_id  uuid not null references matchups (id),
  user_id     uuid not null references users (id),
  winner_id   uuid not null references ideas (id),
  loser_id    uuid not null references ideas (id)
);

-- Mirrors migrations/20260614000000_prevent_duplicate_matchup_votes.sql
create unique index if not exists votes_matchup_user_unique
  on votes (matchup_id, user_id);
create index if not exists votes_winner_idx on votes (winner_id);
create index if not exists votes_loser_idx  on votes (loser_id);

-- Snapshot of an idea's score/rank after a round, for the leaderboard chart.
create table if not exists scorehistory (
  id                 uuid primary key default gen_random_uuid(),
  idea_id            uuid not null references ideas (id),
  round_id           uuid not null references rounds (id),
  score_after_round  integer not null,
  rank_after_round   integer
);

create index if not exists scorehistory_idea_idx  on scorehistory (idea_id);
create index if not exists scorehistory_round_idx on scorehistory (round_id);

-- NOTE: RLS is intentionally not toggled here. The live ELO tables may
-- already have RLS configured, and the backend uses the service_role client
-- (which bypasses RLS) for all access. Leave RLS state to the dashboard owner.
