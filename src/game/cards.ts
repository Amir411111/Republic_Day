import raw from '../../content/cards.json';
import { EVENTS, eventToCard } from '../atlas/events';
import type { Card, Pack } from './types';

export const ALL_CARDS = raw as Card[];

// Unverified cards are only playable in dev or with ?dev=1 in the URL
export const DEV_MODE =
  import.meta.env.DEV || new URLSearchParams(window.location.search).has('dev');

export function isVerified(c: Card): boolean {
  return c.verified_by.trim() !== '' && c.sources.length > 0 && c.image_credit.license.trim() !== '';
}

export function cardsForPack(pack: Pack): Card[] {
  return ALL_CARDS.filter((c) => c.pack.includes(pack) && (DEV_MODE || isVerified(c)));
}

// Text rounds from content/events.json (no photo), used by the "Khans and battles" mode
export const EVENT_CARDS = EVENTS.map(eventToCard);

export function cardById(id: string): Card | undefined {
  return ALL_CARDS.find((c) => c.id === id) ?? EVENT_CARDS.find((c) => c.id === id);
}

export function imageUrl(c: Card): string {
  if (/^https?:\/\//.test(c.image)) return c.image;
  return import.meta.env.BASE_URL + c.image;
}
