// turns raw per-category ELO ratings into the /5 scores the UI ranks by
// normalisation is min-max within each category: the lowest-scoring idea in a
// category maps to 1, the highest to 5. Shared by the ratings service (to store
// overall ranks) and the ideas route
import { CATEGORY_IDS } from "./categories";

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Map a single ELO onto a 1-5 scale given the category's min/max elo
export function toRating5(elo: number, min: number, max: number): number {
  if (max === min) return 3.0; // everyone tied, neutral midpoint
  return round1(1 + (4 * (elo - min)) / (max - min));
}

export interface CategoryScoreInput {
  category_id: string;
  curr_score: number;
}

export interface RatedCategory {
  category_id: string;
  elo: number;
  rating5: number;
}

export interface RatedIdea {
  scores: RatedCategory[];
  overall_rating: number;
}

// given every idea's raw per-category elos, compute each idea's per-category /5
// rating and its overall (mean of the five). Returns a map keyed by idea id
export function computeRatings(
  ideas: { id: string; scores: CategoryScoreInput[] }[],
): Map<string, RatedIdea> {
  // per-category min/max ELO across all ideas
  const bounds = new Map<string, { min: number; max: number }>();
  for (const categoryId of CATEGORY_IDS) {
    const values = ideas
      .map(
        (i) => i.scores.find((s) => s.category_id === categoryId)?.curr_score,
      )
      .filter((v): v is number => typeof v === "number");
    if (values.length === 0) continue;
    bounds.set(categoryId, {
      min: Math.min(...values),
      max: Math.max(...values),
    });
  }

  const result = new Map<string, RatedIdea>();
  for (const idea of ideas) {
    const scores: RatedCategory[] = CATEGORY_IDS.map((categoryId) => {
      const elo =
        idea.scores.find((s) => s.category_id === categoryId)?.curr_score ??
        1200;
      const b = bounds.get(categoryId);
      const rating5 = b ? toRating5(elo, b.min, b.max) : 3.0;
      return { category_id: categoryId, elo, rating5 };
    });
    const overall_rating =
      scores.length > 0
        ? round1(scores.reduce((sum, s) => sum + s.rating5, 0) / scores.length)
        : 3.0;
    result.set(idea.id, { scores, overall_rating });
  }
  return result;
}
