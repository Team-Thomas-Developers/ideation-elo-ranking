-- ============================================================
-- PARTY / ROOM SYSTEM  (additive schema for the ELO ranking app)
-- ------------------------------------------------------------
-- Models a "voting room" that the whole team joins for a session.
-- One member is the ROOM LEADER (the host) — they control when the
-- session starts and when rounds open/close. Mirrors the party/host
-- pattern from the takeaux project, adapted to Supabase/Postgres.
--
-- Run this in the Supabase SQL editor. It assumes the existing
-- `users` and `rounds` tables already exist (see ER diagram).
-- ============================================================

-- A party is one voting session/room.
create table if not exists parties (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,            -- short join code, e.g. "ABCD"
  room_name   text not null,                   -- leader-editable display name
  leader_id   uuid not null references users (id),  -- the ROOM LEADER (host)
  status      text not null default 'lobby',   -- 'lobby' | 'active' | 'done'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Who is in which party. The leader also has a row here (is_leader = true).
create table if not exists party_members (
  id         uuid primary key default gen_random_uuid(),
  party_id   uuid not null references parties (id) on delete cascade,
  user_id    uuid not null references users (id),
  is_leader  boolean not null default false,
  joined_at  timestamptz not null default now(),
  unique (party_id, user_id)             -- a user joins a party at most once
);

create index if not exists party_members_party_idx on party_members (party_id);
create index if not exists party_members_user_idx  on party_members (user_id);

-- Tie each round to the party it belongs to, so a room runs its own rounds.
alter table rounds add column if not exists party_id uuid references parties (id);
create index if not exists rounds_party_idx on rounds (party_id);

-- keep parties.updated_at fresh on any change
create or replace function touch_parties_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_parties on parties;
create trigger trg_touch_parties
  before update on parties
  for each row execute function touch_parties_updated_at();
