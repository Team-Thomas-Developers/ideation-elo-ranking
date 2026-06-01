// interactive cli to try out the elo algorithm: it deals two random ideas,
// you pick the winner, and it prints how both ratings change.
// run with: npm run elo

import { createInterface } from 'readline';
import { calculateNewRatings, getKFactor, STABILITY_THRESHOLD } from './elo';

// random starting rating in a realistic spread (1000-1799)
function randomRating(): number {
  return Math.floor(1000 + Math.random() * 800);
}

// random matchups already played, so the k-factor varies between rounds (0-59)
function randomMatchups(): number {
  return Math.floor(Math.random() * 2 * STABILITY_THRESHOLD);
}

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

interface Idea {
  label: string;
  rating: number;
  matchups: number;
}

function randomIdea(label: string): Idea {
  return { label, rating: randomRating(), matchups: randomMatchups() };
}

function describe(idea: Idea): string {
  const k = getKFactor(idea.matchups);
  return `${bold(idea.label)}: ${idea.rating} elo  (${idea.matchups} matchups played, K=${k})`;
}

// "1340 -> 1352 (+12)" with the delta coloured green for a gain, red for a loss
function formatChange(before: number, after: number): string {
  const delta = after - before;
  const sign = delta >= 0 ? `+${delta}` : `${delta}`;
  return `${before} -> ${after} (${delta >= 0 ? green(sign) : red(sign)})`;
}

function showResult(winner: Idea, loser: Idea): void {
  const { winnerScore, loserScore } = calculateNewRatings(
    winner.rating,
    loser.rating,
    winner.matchups,
    loser.matchups,
  );
  console.log('');
  console.log(`  ${bold(winner.label)} wins`);
  console.log(`  ${winner.label}  ${formatChange(winner.rating, winnerScore)}`);
  console.log(`  ${loser.label}  ${formatChange(loser.rating, loserScore)}`);
  console.log('');
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> =>
  new Promise((resolve) => rl.question(q, resolve));

async function main(): Promise<void> {
  console.log(bold('\nElo algorithm demo — pick the winner of each matchup.\n'));

  let playing = true;
  while (playing) {
    const a = randomIdea('A');
    const b = randomIdea('B');
    console.log(describe(a));
    console.log(describe(b));

    const answer = (await ask('\nWho wins? (a / b, or q to quit) '))
      .trim()
      .toLowerCase();

    if (answer === 'q') {
      playing = false;
    } else if (answer === 'a') {
      showResult(a, b);
    } else if (answer === 'b') {
      showResult(b, a);
    } else {
      console.log("Please type 'a', 'b', or 'q'.\n");
    }
  }

  rl.close();
  console.log('Bye!');
}

main();
