// src/config/rounds.ts
// Placeholder numbers: tune these once you've settled on the research
export const ROUNDS = [
  { round: 1, afterDays: 7, difficulty: 1 },
  { round: 2, afterDays: 21, difficulty: 2 },
  { round: 3, afterDays: 45, difficulty: 3 },
];

// A round past the end of the list uses the last one
export function getRound(round: number) {
  return ROUNDS.find((r) => r.round === round) ?? ROUNDS[ROUNDS.length - 1];
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}