alter table public.ideas
  add column if not exists created_by uuid references public.users(id),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists ideas_created_by_idx
  on public.ideas (created_by);
