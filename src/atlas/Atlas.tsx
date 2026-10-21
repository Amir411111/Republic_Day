import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Landmark, List, MessageCircle, Mountain, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FeatureCollection } from 'geojson';
import regionsRaw from '../../content/regions.json';
import { ALL_CARDS, imageUrl, isVerified } from '../game/cards';
import type { Card, L10n } from '../game/types';
import type { StringKey } from '../i18n/strings';
import Guide from '../guide/Guide';
import { useI18n } from '../i18n';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';
import { TopBar } from '../ui/TopBar';
import { EVENTS, yearLabel, type HistEvent } from './events';
import {
  CountryOutline,
  EVENT_LAYER_ID,
  EraOverlay,
  ItemsLayer,
  MONUMENT_COLORS,
  MONUMENT_KINDS,
  MONUMENT_LAYER_ID,
  ModernWithin,
  MonumentsLayer,
  PHOTO_LAYER_ID,
  REGION_LAYER_ID,
  RegionsLayer,
  type MonumentKind,
} from './layers';
import MapCanvas, { type Camera as Cam } from './MapCanvas';
import { monumentPhoto, type MonumentPhoto } from './monumentPhoto';
import { PERIODS, formatRange, periodById, periodOfYear, type PeriodId } from './periods';
import Timeline from './Timeline';
import monumentsMeta from '../../content/monuments-meta.json';

interface KkRu {
  kk: string;
  ru: string;
}

interface Monument {
  id: number;
  lat: number;
  lng: number;
  name: KkRu;
  type: KkRu;
  region: KkRu;
  // location as worded in the list
  place: KkRu;
  // how the point was found: the list itself gives addresses, not coordinates
  how: 'osm' | 'wikidata' | 'address' | 'settlement';
  // true when the point is the settlement or street rather than the object itself
  approx: boolean;
  kind: MonumentKind;
  // the act or dataset this point comes from
  source: string;
}

const KIND_LABEL: Record<MonumentKind, StringKey> = {
  archaeology: 'monArchaeology',
  architecture: 'monArchitecture',
  monumental: 'monMonumental',
  ensemble: 'monEnsemble',
  sacral: 'monSacral',
  history: 'monHistory',
  other: 'monOther',
};

interface RegionInfo {
  note: L10n;
  eras: PeriodId[];
  reform?: L10n;
  sources: string[];
}

const REGIONS = regionsRaw as Record<string, RegionInfo>;
const DEMO_STEP_MS = 5200;
const TERRAIN_KEY = 'tg_terrain';

// 3D relief is the heaviest part of the map: on by default only on a large screen,
// and the viewer's own choice is remembered
function loadTerrain(): boolean {
  try {
    const saved = localStorage.getItem(TERRAIN_KEY);
    if (saved === '1' || saved === '0') return saved === '1';
  } catch {
    /* storage unavailable */
  }
  // off by default: the 3D relief is the heaviest part of the map
  return false;
}

// Text events and photo cards share the map and the era list
interface Item {
  key: string;
  kind: 'event' | 'photo';
  era: PeriodId;
  year: number;
  year_end?: number;
  lat: number;
  lng: number;
  approx: boolean;
  title: L10n;
  place: L10n;
  text: L10n;
  sources: string[];
  image?: string;
  credit?: { author: string; license: string; source_url: string };
}

const fromEvent = (e: HistEvent): Item => ({
  key: `e:${e.id}`,
  kind: 'event',
  era: e.era,
  year: e.year,
  year_end: e.year_end,
  lat: e.lat,
  lng: e.lng,
  approx: e.approx,
  title: e.title,
  place: e.place,
  text: e.text,
  sources: e.sources,
  image: e.image,
  credit: e.image_credit,
});

const fromCard = (c: Card): Item => ({
  key: `p:${c.id}`,
  kind: 'photo',
  era: periodOfYear(c.year).id,
  year: c.year,
  lat: c.lat,
  lng: c.lng,
  approx: false,
  title: c.title,
  place: c.place,
  text: c.explanation,
  sources: c.sources,
  image: c.image,
  credit: c.image_credit,
});

const ALL_ITEMS: Item[] = [...EVENTS.map(fromEvent), ...ALL_CARDS.filter(isVerified).map(fromCard)].sort(
  (a, b) => a.year - b.year || (a.kind === 'event' ? -1 : 1),
);

type Selection =
  | { type: 'item'; item: Item }
  | { type: 'monument'; mons: Monument[] }
  | { type: 'region'; id: string; name: L10n }
  | { type: 'list' };

function readCenter(value: unknown): [number, number] | null {
  // MapLibre serialises non-primitive feature properties, so the centre arrives as a string
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed) && parsed.length === 2) return [Number(parsed[0]), Number(parsed[1])];
  } catch {
    /* the camera simply stays where it is */
  }
  return null;
}

function Panel({ children, onClose, color }: { children: ReactNode; onClose: () => void; color?: string }) {
  const { t } = useI18n();
  return (
    <motion.aside
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.22 }}
      className="pointer-events-auto relative max-h-[46svh] w-full overflow-y-auto rounded-2xl border border-border/80 bg-card/95 p-4 shadow-2xl sm:ml-auto sm:max-w-md sm:p-5"
      style={color ? { borderTopColor: color, borderTopWidth: 3 } : undefined}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('close')}
        className="absolute top-2 right-2 grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
      {children}
    </motion.aside>
  );
}

// Commons photo for a monument card; nothing at all when no trustworthy photo is found
function MonumentImage({ name, lat, lng, approx }: { name: string; lat: number; lng: number; approx: boolean }) {
  const { t } = useI18n();
  const [photo, setPhoto] = useState<MonumentPhoto | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setPhoto(undefined);
    monumentPhoto({ name, at: { lat, lng }, approx }).then((p) => live && setPhoto(p));
    return () => {
      live = false;
    };
  }, [name, lat, lng, approx]);
  if (photo === undefined) return <div aria-hidden="true" className="mt-3 h-36 animate-pulse rounded-xl bg-accent/60" />;
  if (!photo) return null;
  return (
    <figure className="mt-3">
      <img src={photo.src} alt={name} loading="lazy" className="max-h-56 w-full rounded-xl bg-black object-contain" />
      <figcaption className="mt-1 text-xs text-muted-foreground">
        {t('imageBy')}: {photo.author} ·{' '}
        <a href={photo.page} target="_blank" rel="noreferrer">
          {photo.license || 'Wikimedia Commons'}
        </a>
      </figcaption>
    </figure>
  );
}

function SourceLinks({ urls }: { urls: string[] }) {
  const { t } = useI18n();
  if (!urls.length) return null;
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      {t('sources')}:{' '}
      {urls.map((u, k) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="mr-2">
          [{k + 1}]
        </a>
      ))}
    </p>
  );
}

export default function Atlas({ onBack }: { onBack: () => void }) {
  const { t, l, lang } = useI18n();
  const [index, setIndex] = useState(PERIODS.findIndex((p) => p.id === 'khanate'));
  const [demo, setDemo] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const [showPhotos, setShowPhotos] = useState(true);
  const [showMon, setShowMon] = useState(false);
  const [monuments, setMonuments] = useState<Monument[] | null>(null);
  const [monKinds, setMonKinds] = useState<MonumentKind[]>([...MONUMENT_KINDS]);
  const [showApprox, setShowApprox] = useState(true);
  const [terrain, setTerrain] = useState(loadTerrain);
  const toggleTerrain = () => {
    setTerrain(!terrain);
    try {
      localStorage.setItem(TERRAIN_KEY, terrain ? '0' : '1');
    } catch {
      /* storage unavailable */
    }
  };
  const [sel, setSel] = useState<Selection | null>(null);
  const [camera, setCamera] = useState<Cam | null>(null);
  const [ask, setAsk] = useState(false);

  const period = PERIODS[index];
  const regionsOn = period.id === 'modern';
  // eras where Kazakhstan is inside a larger state and needs to be picked out
  const withinEmpire = period.id === 'russian' || period.id === 'soviet';

  const items = useMemo(
    () => ALL_ITEMS.filter((i) => i.era === period.id && (i.kind === 'event' ? showEvents : showPhotos)),
    [period, showEvents, showPhotos],
  );

  // the state list of monuments of republican significance: loaded only when the layer is switched on
  useEffect(() => {
    if (showMon && !monuments)
      import('../../content/monuments.json').then((m) => setMonuments(m.default as Monument[]));
  }, [showMon, monuments]);
  const visibleMons = useMemo(() => (showMon ? (monuments ?? []) : []), [showMon, monuments]);

  // classes present in the data, with counts, in the fixed legend order
  const kindCounts = useMemo(() => {
    const n = new Map<MonumentKind, number>();
    visibleMons.forEach((m) => n.set(m.kind, (n.get(m.kind) ?? 0) + 1));
    return MONUMENT_KINDS.filter((k) => n.has(k)).map((k) => [k, n.get(k)!] as const);
  }, [visibleMons]);
  const approxCount = useMemo(() => visibleMons.filter((m) => m.approx).length, [visibleMons]);
  const toggleKind = (k: MonumentKind) =>
    setMonKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));

  const monumentGeo = useMemo<FeatureCollection | null>(
    () =>
      visibleMons.length === 0
        ? null
        : {
        type: 'FeatureCollection',
        features: visibleMons.map((m) => ({
          type: 'Feature',
          properties: { id: String(m.id), kind: m.kind, approx: m.approx },
          geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
        })),
      },
    [visibleMons],
  );

  useEffect(() => {
    if (!demo) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % PERIODS.length), DEMO_STEP_MS);
    return () => window.clearInterval(timer);
  }, [demo]);

  // a new era drops the selection that belonged to the old one
  useEffect(() => {
    setSel((s) => (s?.type === 'list' || s?.type === 'monument' ? s : null));
    setCamera(null);
  }, [index]);

  const selectEra = (next: number) => {
    setDemo(false);
    setIndex(next);
  };

  const selectItem = (item: Item) => {
    setAsk(false);
    setSel({ type: 'item', item });
    setCamera({ center: [item.lng, item.lat], zoom: 7 });
  };

  const ml = (x: KkRu) => (lang === 'kk' ? x.kk : x.ru) || x.ru || x.kk;
  const selectedKey = sel?.type === 'item' ? sel.item.key : null;
  const interactive = [
    EVENT_LAYER_ID,
    PHOTO_LAYER_ID,
    ...(regionsOn ? [REGION_LAYER_ID] : []),
    ...(monumentGeo ? [MONUMENT_LAYER_ID] : []),
  ];
  const itemGeo = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: items.map((i) => ({
        type: 'Feature',
        properties: { key: i.key, kind: i.kind, approx: i.approx, active: i.key === selectedKey },
        geometry: { type: 'Point', coordinates: [i.lng, i.lat] },
      })),
    }),
    [items, selectedKey],
  );

  const panel = () => {
    if (!sel) return null;
    const close = () => setSel(null);

    if (sel.type === 'list')
      return (
        <Panel key="list" onClose={close} color={period.color}>
          <h3 className="pr-10 text-xs font-semibold tracking-[0.16em] uppercase" style={{ color: period.color }}>
            {t('eraList')} · {l(period.short)} ({items.length})
          </h3>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t('eraEmpty')}</p>
          ) : (
            <ol className="mt-3 flex flex-col gap-1">
              {items.map((i) => (
                <li key={i.key}>
                  <button
                    type="button"
                    onClick={() => selectItem(i)}
                    className="flex min-h-11 w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className="w-20 shrink-0 font-semibold tabular-nums" style={{ color: period.color }}>
                      {yearLabel(i, lang)}
                    </span>
                    <span className="min-w-0">
                      {i.kind === 'photo' && <Camera aria-hidden="true" className="mr-1 inline size-3.5 align-[-2px] opacity-70" />}
                      {l(i.title)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      );

    if (sel.type === 'monument') {
      const [m, ...more] = sel.mons;
      const place = ml(m.region);
      return (
        <Panel key={`m${m.id}`} onClose={close} color={MONUMENT_COLORS[m.kind]}>
          {more.length > 0 && (
            <p className="mb-2 pr-10 text-xs text-muted-foreground">{t('monHere', { n: sel.mons.length })}</p>
          )}
          <ol className="flex flex-col gap-4">
            {sel.mons.map((x) => (
              <li key={x.id}>
                <p className="pr-10 text-xs font-semibold tracking-[0.16em] uppercase" style={{ color: MONUMENT_COLORS[x.kind] }}>
                  {t(KIND_LABEL[x.kind])}
                </p>
                <h3 className="mt-1 text-lg leading-tight font-bold text-pretty">{ml(x.name)}</h3>
                {ml(x.place) && (
                  <p className="mt-1 text-sm text-pretty text-foreground/85">
                    <span className="text-muted-foreground">{t('monPlace')}:</span> {ml(x.place)}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <MonumentImage name={m.name.ru} lat={m.lat} lng={m.lng} approx={m.approx} />
          <p className="mt-2 text-sm text-muted-foreground">{place}</p>
          {m.approx && (
            <p className="mt-2 text-xs leading-relaxed text-primary/90">
              ≈ {t(m.how === 'address' ? 'monApproxAddress' : 'monApproxNote')}
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {t('monumentsSource')}:{' '}
            <a href={m.source} target="_blank" rel="noreferrer">
              {t('monumentsList')}
            </a>
            {` · ${t('monCoords')}: ${m.how === 'wikidata' ? 'Wikidata' : 'OpenStreetMap'}`}
          </p>
        </Panel>
      );
    }

    if (sel.type === 'region') {
      const info = REGIONS[sel.id];
      return (
        <Panel key={`r${sel.id}`} onClose={close} color="#d8af4f">
          <h3 className="pr-10 text-lg leading-tight font-bold">{l(sel.name)}</h3>
          {info && (
            <>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">{l(info.note)}</p>
              {info.eras.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {info.eras.map((id) => {
                    const era = periodById(id);
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => selectEra(PERIODS.indexOf(era))}
                          className="min-h-9 rounded-md px-2.5 text-xs font-medium"
                          style={{ color: era.color, backgroundColor: `color-mix(in srgb, ${era.color} 14%, transparent)` }}
                        >
                          {l(era.short)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {info.reform && (
                <p className="mt-3 border-t border-border/70 pt-3 text-xs leading-relaxed text-muted-foreground/90">
                  <span className="font-semibold tracking-wide text-primary/80 uppercase">{t('reformNote')}.</span>{' '}
                  {l(info.reform)}
                </p>
              )}
              <SourceLinks urls={info.sources} />
            </>
          )}
        </Panel>
      );
    }

    const it = sel.item;
    const color = periodById(it.era).color;
    return (
      <Panel key={it.key} onClose={close} color={color}>
        <p className="pr-10 text-xs font-semibold tracking-[0.16em] uppercase tabular-nums" style={{ color }}>
          {yearLabel(it, lang)}
          {it.kind === 'photo' && <Camera aria-hidden="true" className="ml-2 inline size-3.5 align-[-2px]" />}
        </p>
        <h3 className="mt-1 font-display text-xl leading-tight font-bold text-pretty">{l(it.title)}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {l(it.place)}
          {it.approx && <em> · {t('approxPlace')}</em>}
        </p>
        {it.image && (
          <img
            src={imageUrl({ image: it.image } as Card)}
            alt={l(it.title)}
            className="mt-3 max-h-56 w-full rounded-xl bg-black object-contain"
            loading="lazy"
          />
        )}
        <p className="mt-3 text-sm leading-relaxed text-pretty text-foreground/90">{l(it.text)}</p>
        <SourceLinks urls={it.sources} />
        {it.image && it.credit && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('imageBy')}: {it.credit.author} ·{' '}
            <a href={it.credit.source_url} target="_blank" rel="noreferrer">
              {it.credit.license}
            </a>
          </p>
        )}
        <div className="mt-3 border-t border-border/70 pt-3">
          {ask ? (
            <Guide key={it.key} focus={it.key} compact />
          ) : (
            <Button variant="chip" onClick={() => setAsk(true)}>
              <MessageCircle aria-hidden="true" className="size-4" />
              {t('guideAskAbout')}
            </Button>
          )}
        </div>
      </Panel>
    );
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <MapCanvas
        period={period}
        terrain={terrain}
        flyTo={camera}
        interactiveLayerIds={interactive}
        onFeatureClick={(layer, props) => {
          if ((layer === EVENT_LAYER_ID || layer === PHOTO_LAYER_ID) && props) {
            const it = items.find((i) => i.key === props.key);
            if (it) selectItem(it);
          } else if (layer === MONUMENT_LAYER_ID && props) {
            const hit = visibleMons.find((m) => String(m.id) === String(props.id));
            // monuments placed at the same settlement share one dot: list them all
            const mons = hit ? visibleMons.filter((m) => m.lat === hit.lat && m.lng === hit.lng) : [];
            if (hit) setSel({ type: 'monument', mons: [hit, ...mons.filter((m) => m !== hit)] });
          } else if (layer === REGION_LAYER_ID && props) {
            const id = String(props.id);
            setSel({
              type: 'region',
              id,
              name: { kk: String(props.name_kk ?? ''), ru: String(props.name_ru ?? ''), en: String(props.name_en ?? '') },
            });
            const center = readCenter(props.center);
            if (center) setCamera({ center, zoom: 5.4 });
          }
        }}
      >
        <EraOverlay period={period} />
        {withinEmpire && <ModernWithin />}
        {regionsOn && <RegionsLayer selectedId={sel?.type === 'region' ? sel.id : null} />}
        <CountryOutline />
        {monumentGeo && <MonumentsLayer data={monumentGeo} kinds={monKinds} showApprox={showApprox} />}
        <ItemsLayer data={itemGeo} color={period.color} />
      </MapCanvas>

      <TopBar onBack={onBack} className="absolute inset-x-0 top-0 z-20" />

      {/* era title */}
      <div className="pointer-events-none absolute inset-x-0 top-[4.5rem] z-10 px-4 sm:top-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={period.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="mx-auto max-w-2xl text-center"
          >
            <p className="text-xs font-semibold tracking-[0.18em] uppercase" style={{ color: period.color }}>
              {formatRange(period, lang)}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-balance drop-shadow-[0_2px_12px_rgba(7,13,24,0.9)] sm:text-4xl">
              {l(period.name)}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground drop-shadow-[0_2px_8px_rgba(7,13,24,0.95)]">
              <span className="font-medium" style={{ color: period.color }}>
                {l(period.territory)}
              </span>
              {period.territory_approx && <span>· {t('approxOutline')}</span>}
              <span>
                · {regionsOn ? t('regionsHint') : withinEmpire ? t('withinHint') : t('outlineLegend')}
              </span>
            </p>
            {showMon && (
              <p className="mt-1 text-xs text-muted-foreground drop-shadow-[0_2px_8px_rgba(7,13,24,0.95)]">
                {t('monumentsNote')} · {monumentsMeta.listed}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* bottom stack: panel, layer controls, timeline */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-2">
          <AnimatePresence mode="wait">{panel()}</AnimatePresence>
          {kindCounts.length > 0 && (
            <div className="pointer-events-auto flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {kindCounts.map(([k, n]) => (
                <Button
                  key={k}
                  variant="chip"
                  on={monKinds.includes(k)}
                  onClick={() => toggleKind(k)}
                  className={cn('min-h-10 shrink-0 px-3 text-xs', !monKinds.includes(k) && 'opacity-60')}
                >
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: MONUMENT_COLORS[k] }} />
                  {t(KIND_LABEL[k])} <span className="tabular-nums opacity-70">{n}</span>
                </Button>
              ))}
              {approxCount > 0 && (
                <Button
                  variant="chip"
                  on={showApprox}
                  onClick={() => setShowApprox(!showApprox)}
                  className={cn('min-h-10 shrink-0 px-3 text-xs', !showApprox && 'opacity-60')}
                >
                  <span aria-hidden="true" className="size-2.5 rounded-full border border-foreground/80" />
                  {t('monApprox')} <span className="tabular-nums opacity-70">{approxCount}</span>
                </Button>
              )}
            </div>
          )}
          <div className="pointer-events-auto flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            <Button variant="chip" on={showEvents} onClick={() => setShowEvents(!showEvents)} className="shrink-0 px-3">
              ◆ {t('layerEvents')}
            </Button>
            <Button variant="chip" on={showPhotos} onClick={() => setShowPhotos(!showPhotos)} className="shrink-0 px-3">
              <Camera aria-hidden="true" className="size-4" /> {t('layerPhotos')}
            </Button>
            <Button
              variant="chip"
              on={showMon}
              onClick={() => setShowMon(!showMon)}
              className="shrink-0 px-3"
            >
              <Landmark aria-hidden="true" className="size-4" /> {t('layerMonuments')}
            </Button>
            <Button variant="chip" on={terrain} onClick={toggleTerrain} className="shrink-0 px-3">
              <Mountain aria-hidden="true" className="size-4" /> {t('relief3d')}
            </Button>
            <Button
              variant="chip"
              on={sel?.type === 'list'}
              onClick={() => setSel(sel?.type === 'list' ? null : { type: 'list' })}
              className="ml-auto shrink-0 px-3"
            >
              <List aria-hidden="true" className="size-4" /> {items.length}
            </Button>
          </div>
          <div className="pointer-events-auto">
            <Timeline index={index} onChange={selectEra} demo={demo} onToggleDemo={() => setDemo((d) => !d)} />
          </div>
        </div>
      </div>
    </div>
  );
}
