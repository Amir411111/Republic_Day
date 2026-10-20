import { distanceKm } from '../map/distance';
import type { Card, LatLng, RoundResult } from './types';

export const ROUNDS = 5;
export const YEAR_MIN = 1400;
export const YEAR_MAX = 2025;
export const MAX_ROUND_SCORE = 200;

export function yearScore(guess: number, answer: number): number {
  return Math.round(100 * Math.exp(-Math.abs(guess - answer) / 25));
}

export function placeScore(km: number): number {
  return Math.round(100 * Math.exp(-km / 400));
}

export function scoreRound(card: Card, guessYear: number, guess: LatLng): RoundResult {
  const km = distanceKm(guess, { lat: card.lat, lng: card.lng });
  return {
    cardId: card.id,
    guessYear,
    guess,
    km,
    yearScore: yearScore(guessYear, card.year),
    placeScore: placeScore(km),
  };
}

export function totalScore(results: RoundResult[]): number {
  return results.reduce((s, r) => s + r.yearScore + r.placeScore, 0);
}
