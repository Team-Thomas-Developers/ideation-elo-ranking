-- Track who submitted each idea so edits/deletes can be restricted to the
-- author (or a room host). Ideas created before this migration have a null
-- created_by and are therefore host-only to edit.
alter table public.ideas
  add column if not exists created_by uuid references public.users (id);

create index if not exists ideas_created_by_idx on public.ideas (created_by);
