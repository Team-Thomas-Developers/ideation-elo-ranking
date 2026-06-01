// score every idea starts at
export const STARTING_ELO = 1200;

// k-factor for new ideas (big score swings)
export const K_FACTOR_NEW = 32;

// k-factor for established ideas (small swings)
export const K_FACTOR_STABLE = 16;

// matchups before an idea's k-factor drops
export const STABILITY_THRESHOLD = 30;

export interface EloResult {
  winnerScore: number;
  loserScore: number;
}

// new ideas move fast, established ideas move slow
export function getKFactor(matchupsPlayed: number): number {
  return matchupsPlayed < STABILITY_THRESHOLD ? K_FACTOR_NEW : K_FACTOR_STABLE;
}

// chance that idea a beats idea b based on their ratings
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// new ratings after a result. winner = 1, loser = 0. upsets move scores more.
export function calculateNewRatings(
  winnerRating: number,
  loserRating: number,
  winnerMatchups: number,
  loserMatchups: number
): EloResult {
  const expectedWinner = expectedScore(winnerRating, loserRating);
  const expectedLoser = 1 - expectedWinner;

  const kWinner = getKFactor(winnerMatchups);
  const kLoser = getKFactor(loserMatchups);

  return {
    winnerScore: Math.round(winnerRating + kWinner * (1 - expectedWinner)),
    loserScore: Math.round(loserRating + kLoser * (0 - expectedLoser)),
  };
}
