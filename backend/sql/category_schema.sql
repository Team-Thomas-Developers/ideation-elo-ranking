-- multi category elo:
-- Extends the single-score model in elo_schema.sql so that ideas
-- are ranked along 5 categories, each with its own ELO rating
-- A matchup is still a pair of ideas; the vote step now records a
-- winner per category, so one matchup yields five `votes` rows


-- The categories every idea is ranked on. `id` is a stable slug.
create table if not exists categories (
  id          text primary key,             -- slug, e.g. 'enjoyment'
  label       text not null,                -- display label, e.g. 'Enjoyment'
  sort_order  integer not null default 0
);

insert into categories (id, label, sort_order) values
  ('enjoyment',     'Enjoyment',     1),
  ('feasibility',   'Feasibility',   2),
  ('marketability', 'Marketability', 3),
  ('innovation',    'Innovation',    4),
  ('impact',        'Impact',        5)
on conflict (id) do nothing;

-- One idea's live ELO rating within a single category
create table if not exists idea_scores (
  idea_id     uuid not null references ideas (id) on delete cascade,
  category_id text not null references categories (id),
  curr_score  integer not null default 1200,   -- mirrors STARTING_ELO in src/elo/elo.ts
  curr_rank   integer,                          -- rank within this category
  updated_at  timestamptz not null default now(),
  primary key (idea_id, category_id)
);

create index if not exists idea_scores_category_idx on idea_scores (category_id);

-- votes gains a category_id (see elo_schema.sql for the base votes table)
alter table votes
  add column if not exists category_id text references categories (id);

drop index if exists votes_matchup_user_unique;
create unique index if not exists votes_matchup_user_category_unique
  on votes (matchup_id, user_id, category_id);

-- Seed a score row for every existing idea in every category
insert into idea_scores (idea_id, category_id)
select i.id, c.id
from ideas i
cross join categories c
on conflict (idea_id, category_id) do nothing;
