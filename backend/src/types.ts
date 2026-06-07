// table shapes, kept in one place so routes and services agree on columns

export interface Idea {
  id: string;
  title: string;
  desc: string | null;
  curr_score: number;
  curr_rank: number;
}

export interface Round {
  id: string;
  round_num: number;
  status: boolean; // true = active, false = closed
}

export interface Matchup {
  id: string;
  round_id: string;
  user_id: string;
  idea_a: string; // fk -> ideas.id
  idea_b: string; // fk -> ideas.id
  status: boolean; // false = awaiting a vote, true = voted
}

export interface Vote {
  id: string;
  matchup_id: string;
  user_id: string;
  winner_id: string; // fk -> ideas.id
  loser_id: string; // fk -> ideas.id
}

export interface ScoreHistory {
  id: string;
  idea_id: string;
  round_id: string;
  score_after_round: number;
  rank_after_round: number;
}
