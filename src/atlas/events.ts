import raw from '../../content/events.json';
import type { Card, L10n } from '../game/types';

export type Era = 'khanate' | 'empire' | 'soviet' | 'independence';

export interface HistEvent {
  id: string;
  era: Era;
  year: number;
  year_end?: number;
  lat: number;
  lng: number;
  // true when the exact site is unknown or debated: the marker shows the area
  approx: boolean;
  place: L10n;
  title: L10n;
  text: L10n;
  sources: string[];
  // Optional picture: portrait, engraving, monument or site photo (never with the year printed on it)
  image?: string;
  image_credit?: { author: string; license: string; source_url: string };
}

export const EVENTS = (raw as HistEvent[]).slice().sort((a, b) => a.year - b.year);

export const ERAS: { id: Era; from: number; to: number; color: string }[] = [
  { id: 'khanate', from: 1400, to: 1800, color: '#b5651d' },
  { id: 'empire', from: 1801, to: 1916, color: '#6a4c93' },
  { id: 'soviet', from: 1917, to: 1989, color: '#c0392b' },
  { id: 'independence', from: 1990, to: 2025, color: '#1f7a8c' },
];

export function eraOfYear(year: number): Era {
  return (ERAS.find((e) => year >= e.from && year <= e.to) ?? ERAS[ERAS.length - 1]).id;
}

export function eraColor(era: Era): string {
  return ERAS.find((e) => e.id === era)!.color;
}

export function yearLabel(e: { year: number; year_end?: number }): string {
  return e.year_end ? `${e.year}–${e.year_end}` : String(e.year);
}

// Events before 1900 become text rounds for the "Khans and battles" quiz.
// No image: the round shows the event title and asks for year + place.
export const QUIZ_EVENTS = EVENTS.filter((e) => e.year < 1900);

const EMPTY: L10n = { kk: '', ru: '', en: '' };

export function eventToCard(e: HistEvent): Card {
  return {
    id: `event:${e.id}`,
    pack: ['kz'],
    year: e.year,
    lat: e.lat,
    lng: e.lng,
    place: e.place,
    image: e.image ?? '',
    image_credit: e.image_credit ?? { author: '', license: '', source_url: '' },
    title: e.title,
    explanation: e.text,
    clue: EMPTY,
    sources: e.sources,
    difficulty: 2,
    verified_by: 'events.json',
  };
}
