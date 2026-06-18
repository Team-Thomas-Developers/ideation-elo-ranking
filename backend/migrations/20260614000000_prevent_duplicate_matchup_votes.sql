create unique index if not exists votes_matchup_user_unique
  on public.votes (matchup_id, user_id);
