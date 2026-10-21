import type { LatLng } from '../game/types';
import { distanceKm } from '../map/distance';

// A free photo of a monument from Wikimedia Commons, found through its Wikidata item.
// Runs in the player's browser (Wikimedia answers there with CORS) and only when a card is opened.
// A photo is shown only when the item is the same kind of object, shares a distinctive word of
// the name and stands next to our point: a wrong picture is worse than none.

export interface MonumentPhoto {
  src: string;
  // the file page on Commons, with the full licence
  page: string;
  author: string;
  license: string;
}

interface Query {
  name: string;
  at: LatLng;
  // the point is only the nearest settlement or street
  approx: boolean;
}

const WD = 'https://www.wikidata.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

// generic words that say what an object is, not which one
const STOP = new Set([
  'мавзолей', 'городище', 'здание', 'памятник', 'комплекс', 'ансамбль', 'музей', 'мечеть', 'церковь', 'собор', 'курган',
  'могильник', 'поселение', 'стоянка', 'некрополь', 'дворец', 'школа', 'дом', 'бюст', 'место', 'захоронения', 'и',
]);
// lowercase words that belong to a proper name: "Қорқыт ата", "Жұбан ана"
const NAME_TAILS = new Set(['ата', 'ана', 'апа', 'би', 'хан', 'хана', 'баба', 'әулие', 'аулие', 'батыр', 'ишан', 'ишана']);

// the first word of the name in the state list -> words the Wikidata label or description must contain
const SAME_KIND: [string, string[]][] = [
  ['мавзо', ['мавзол', 'кесене']],
  ['городи', ['городищ', 'древн']],
  ['археол', ['городищ', 'археолог', 'древн']],
  ['курга', ['курган', 'могильн']],
  ['могил', ['могильн', 'курган', 'некропол']],
  ['некро', ['некропол', 'кладбищ', 'могильн']],
  ['мечет', ['мечет']],
  ['подзе', ['мечет']],
  ['собор', ['собор']],
  ['церко', ['церк', 'храм']],
  ['петро', ['петроглиф', 'наскальн']],
  ['башня', ['башн']],
  ['дворе', ['дворец']],
  ['памят', ['памятник', 'монумент', 'скульптур']],
  ['бюст', ['бюст', 'памятник']],
  ['здани', ['здани', 'особняк', 'дом']],
  ['дом', ['дом', 'здани', 'особняк']],
];

function ownName(name: string): string {
  return name.split(/,|\(|\bныне\b|–|—/)[0].replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim();
}

// "Мавзолей Айша биби, архитектор неизвестен, XI век" -> "Айша биби"
export function distinctName(name: string): string {
  const words = ownName(name).split(' ').slice(1);
  return words
    .filter((w) => (/^[A-ZА-ЯЁӘҒҚҢӨҰҮҺІ]/.test(w) || w.includes('-') || NAME_TAILS.has(w.toLowerCase())) && !STOP.has(w.toLowerCase()))
    .join(' ');
}

const stems = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .replace(/ё/g, 'е')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4 && !STOP.has(w))
      .map((w) => w.slice(0, 5)),
  );

function sameKind(name: string, text: string): boolean {
  const first = ownName(name).split(' ')[0].toLowerCase();
  const rule = SAME_KIND.find(([key]) => first.startsWith(key));
  return !!rule && rule[1].some((w) => text.toLowerCase().includes(w));
}

async function getJson(url: string): Promise<any> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function lookup(q: Query): Promise<MonumentPhoto | null> {
  const search = distinctName(q.name);
  if (!search) return null;
  const want = stems(ownName(q.name));

  const found = await getJson(
    `${WD}?action=wbsearchentities&format=json&origin=*&type=item&limit=7&language=ru&uselang=ru&search=${encodeURIComponent(search)}`,
  );
  const ids: string[] = (found.search ?? []).map((s: { id: string }) => s.id);
  if (ids.length === 0) return null;

  const data = await getJson(
    `${WD}?action=wbgetentities&format=json&origin=*&props=claims|labels|descriptions&languages=ru&ids=${ids.join('|')}`,
  );
  const maxKm = q.approx ? 40 : 10;
  for (const id of ids) {
    const e = data.entities?.[id];
    const coord = e?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    const file: string | undefined = e?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    const label: string = e?.labels?.ru?.value ?? '';
    const desc: string = e?.descriptions?.ru?.value ?? '';
    if (!coord || !file) continue;
    if (distanceKm(q.at, { lat: coord.latitude, lng: coord.longitude }) > maxKm) continue;
    if (![...stems(label)].some((s) => want.has(s)) || !sameKind(q.name, `${label} ${desc}`)) continue;

    const info = await getJson(
      `${COMMONS}?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&titles=${encodeURIComponent(`File:${file}`)}`,
    );
    const page = Object.values(info.query?.pages ?? {})[0] as { imageinfo?: any[] } | undefined;
    const ii = page?.imageinfo?.[0];
    if (!ii?.thumburl) continue;
    return {
      src: ii.thumburl,
      page: ii.descriptionurl,
      author: stripHtml(ii.extmetadata?.Artist?.value ?? '') || 'Wikimedia Commons',
      license: stripHtml(ii.extmetadata?.LicenseShortName?.value ?? ''),
    };
  }
  return null;
}

const cache = new Map<string, Promise<MonumentPhoto | null>>();

export function monumentPhoto(q: Query): Promise<MonumentPhoto | null> {
  const key = `${q.name}|${q.at.lat},${q.at.lng}`;
  if (!cache.has(key)) cache.set(key, lookup(q).catch(() => null)); // offline or blocked: no photo, no error
  return cache.get(key)!;
}
