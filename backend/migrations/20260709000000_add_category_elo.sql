-- multi category elo:
-- Ideas are ranked along five categories, each with its own ELO.
-- A matchup vote now records a winner per category (5 votes per
-- matchup). An idea's overall score is the average of its five
-- per-category ratings (normalised to /5 at read time).

-- The categories every idea is ranked on. `id` is a stable slug.
create table if not exists public.categories (
  id          text primary key,             -- slug, e.g. 'enjoyment'
  label       text not null,                -- display label, e.g. 'Enjoyment'
  sort_order  integer not null default 0
);

insert into public.categories (id, label, sort_order) values
  ('enjoyment',     'Enjoyment',     1),
  ('feasibility',   'Feasibility',   2),
  ('marketability', 'Marketability', 3),
  ('innovation',    'Innovation',    4),
  ('impact',        'Impact',        5)
on conflict (id) do nothing;

-- one idea's live elo rating within a single category
create table if not exists public.idea_scores (
  idea_id     uuid not null references public.ideas (id) on delete cascade,
  category_id text not null references public.categories (id),
  curr_score  integer not null default 1200,   -- mirrors STARTING_ELO in src/elo/elo.ts
  curr_rank   integer,                          -- rank within this category
  updated_at  timestamptz not null default now(),
  primary key (idea_id, category_id)
);

create index if not exists idea_scores_category_idx on public.idea_scores (category_id);

-- Tag each vote with the category it was cast for 
alter table public.votes
  add column if not exists category_id text references public.categories (id);

-- One vote per (matchup, user, category) 
drop index if exists public.votes_matchup_user_unique;
create unique index if not exists votes_matchup_user_category_unique
  on public.votes (matchup_id, user_id, category_id);

-- seed a score row for every existing idea in every category (starting elo).
insert into public.idea_scores (idea_id, category_id)
select i.id, c.id
from public.ideas i
cross join public.categories c
on conflict (idea_id, category_id) do nothing;
