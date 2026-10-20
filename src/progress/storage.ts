import type { RoundResult } from '../game/types';

const KEY = 'tg_progress_v1';
// A card scoring below this (out of 200) comes back in "review mistakes"
export const REVIEW_THRESHOLD = 100;

export interface CardProgress {
  plays: number;
  best: number;
  last: number;
  lastPlayed: string;
}

type Progress = Record<string, CardProgress>;

export function loadProgress(): Progress {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Progress;
  } catch {
    return {};
  }
}

export function saveResult(r: RoundResult): void {
  const all = loadProgress();
  const score = r.yearScore + r.placeScore;
  const prev = all[r.cardId];
  all[r.cardId] = {
    plays: (prev?.plays ?? 0) + 1,
    best: Math.max(prev?.best ?? 0, score),
    last: score,
    lastPlayed: new Date().toISOString(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

export function mistakeIds(): string[] {
  return Object.entries(loadProgress())
    .filter(([, p]) => p.last < REVIEW_THRESHOLD)
    .map(([id]) => id);
}
