import raw from '../../content/events.json';
import { YEAR_MAX, YEAR_MIN } from '../game/scoring';
import type { Card, L10n, Lang } from '../game/types';
import { formatYear, type PeriodId } from './periods';

export interface HistEvent {
  id: string;
  // era on the history map; explicit because eras overlap (1731–1847)
  era: PeriodId;
  // negative years are BCE: such events are on the map only, never in the game
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

export function yearLabel(e: { year: number; year_end?: number }, lang: Lang = 'ru'): string {
  return e.year_end ? `${formatYear(e.year, lang)}–${formatYear(e.year_end, lang)}` : formatYear(e.year, lang);
}

const inGameRange = (e: HistEvent) => e.year >= YEAR_MIN && e.year <= YEAR_MAX;

// Events before 1900 become rounds of the "Khans and battles" quiz:
// the round shows the title (and picture, if any) and asks for year + place.
export const QUIZ_EVENTS = EVENTS.filter((e) => inGameRange(e) && e.year < 1900);

// Events with an exact site, for the satellite-view mode: the 3D scene is the place itself
export const SCENE_EVENTS = EVENTS.filter((e) => inGameRange(e) && !e.approx);

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
