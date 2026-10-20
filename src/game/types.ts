// Strictly mirrors the card format in CLAUDE.md / content/schema.json
export type Lang = 'kk' | 'ru' | 'en';
export type L10n = Record<Lang, string>;
export type Pack = 'kz' | 'semey';

export interface Card {
  id: string;
  pack: Pack[];
  year: number;
  lat: number;
  lng: number;
  place: L10n;
  image: string;
  image_credit: {
    author: string;
    license: string;
    source_url: string;
  };
  title: L10n;
  explanation: L10n;
  clue: L10n;
  sources: string[];
  difficulty: 1 | 2 | 3;
  verified_by: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoundResult {
  cardId: string;
  guessYear: number;
  guess: LatLng;
  km: number;
  yearScore: number;
  placeScore: number;
}
