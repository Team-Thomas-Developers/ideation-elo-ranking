// Turns raw per-category ELO ratings into the /5 scores the UI ranks by.
// Mirrors backend/src/lib/rating.ts: min-max normalise each category across all
// ideas (worst: 1, best: 5), then average the five for an idea's overall.

export const CATEGORY_IDS = [
  'enjoyment',
  'feasibility',
  'marketability',
  'innovation',
  'impact',
]

const round1 = (n) => Math.round(n * 10) / 10

export function toRating5(elo, min, max) {
  if (max === min) return 3.0
  return round1(1 + (4 * (elo - min)) / (max - min))
}

// ideas: [{ id, scores: [{ category_id, curr_score }] }]
// returns Map<id, { scores: [{category_id, elo, rating5}], overall_rating }>
export function computeRatings(ideas) {
  const bounds = new Map()
  for (const categoryId of CATEGORY_IDS) {
    const values = ideas
      .map(
        (i) => i.scores?.find((s) => s.category_id === categoryId)?.curr_score,
      )
      .filter((v) => typeof v === 'number')
    if (values.length === 0) continue
    bounds.set(categoryId, {
      min: Math.min(...values),
      max: Math.max(...values),
    })
  }

  const result = new Map()
  for (const idea of ideas) {
    const scores = CATEGORY_IDS.map((categoryId) => {
      const elo =
        idea.scores?.find((s) => s.category_id === categoryId)?.curr_score ??
        1200
      const b = bounds.get(categoryId)
      const rating5 = b ? toRating5(elo, b.min, b.max) : 3.0
      return { category_id: categoryId, elo, rating5 }
    })
    const overall_rating = scores.length
      ? round1(scores.reduce((sum, s) => sum + s.rating5, 0) / scores.length)
      : 3.0
    result.set(idea.id, { scores, overall_rating })
  }
  return result
}
