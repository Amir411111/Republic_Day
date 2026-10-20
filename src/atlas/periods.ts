import raw from '../../content/periods.json';
import type { L10n, Lang } from '../game/types';

export type PeriodId = 'saka' | 'turk' | 'karakhanid' | 'mongol' | 'khanate' | 'russian' | 'soviet' | 'modern';

export interface Period {
  id: PeriodId;
  name: L10n;
  // one or two words, for chips and narrow timelines
  short: L10n;
  // what the shape on the map shows
  territory: L10n;
  // true when the shape is our own approximation, not open data
  territory_approx: boolean;
  // negative years are BCE; eras may overlap (the Khanate lasted until 1847, annexation began in 1731)
  start: number;
  end: number;
  color: string;
  camera: { center: [number, number]; zoom: number; pitch: number; bearing: number };
}

export const PERIODS = raw as Period[];

export function periodById(id: PeriodId): Period {
  return PERIODS.find((p) => p.id === id)!;
}

// The latest era that has started by this year (photos carry a year, not an era)
export function periodOfYear(year: number): Period {
  return [...PERIODS].reverse().find((p) => p.start <= year) ?? PERIODS[0];
}

const BCE: L10n = { kk: 'б.з.д.', ru: 'до н.э.', en: 'BCE' };

export function formatYear(year: number, lang: Lang): string {
  return year >= 0 ? String(year) : `${-year} ${BCE[lang]}`;
}

export function formatRange(p: { start: number; end: number }, lang: Lang): string {
  return `${formatYear(p.start, lang)} — ${formatYear(p.end, lang)}`;
}
