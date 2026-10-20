import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Landmark, List, MessageCircle, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Marker } from 'react-map-gl/maplibre';
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
  EraOverlay,
  MONUMENT_COLORS,
  MONUMENT_KINDS,
  MONUMENT_LAYER_ID,
  ModernWithin,
  MonumentsLayer,
  REGION_LAYER_ID,
  RegionsLayer,
  type MonumentKind,
} from './layers';
import MapCanvas, { type Camera as Cam } from './MapCanvas';
import { PERIODS, formatRange, periodById, periodOfYear, type PeriodId } from './periods';
import Timeline from './Timeline';

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
  district: KkRu;
  region: KkRu;
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
  | { type: 'monument'; mon: Monument }
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
      className="pointer-events-auto relative max-h-[46svh] w-full overflow-y-auto rounded-2xl border border-border/80 bg-card/90 p-4 shadow-2xl backdrop-blur-xl sm:ml-auto sm:max-w-md sm:p-5"
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

  // ~1000+ points from open data and the state lists: loaded only when the layer is switched on
  useEffect(() => {
    if (showMon && !monuments)
      import('../../content/monuments.json').then((m) => setMonuments(m.default as Monument[]));
  }, [showMon, monuments]);

  // classes present in the data, with counts, in the fixed legend order
  const kindCounts = useMemo(() => {
    const n = new Map<MonumentKind, number>();
    monuments?.forEach((m) => n.set(m.kind, (n.get(m.kind) ?? 0) + 1));
    return MONUMENT_KINDS.filter((k) => n.has(k)).map((k) => [k, n.get(k)!] as const);
  }, [monuments]);
  const toggleKind = (k: MonumentKind) =>
    setMonKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));

  const monumentGeo = useMemo<FeatureCollection | null>(
    () =>
      monuments && {
        type: 'FeatureCollection',
        features: monuments.map((m) => ({
          type: 'Feature',
          properties: { id: m.id, kind: m.kind },
          geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
        })),
      },
    [monuments],
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
  const interactive = [...(regionsOn ? [REGION_LAYER_ID] : []), ...(showMon && monumentGeo ? [MONUMENT_LAYER_ID] : [])];
  const selectedKey = sel?.type === 'item' ? sel.item.key : null;

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
      const m = sel.mon;
      const place = [ml(m.district), ml(m.region)].filter(Boolean).join(', ');
      return (
        <Panel key={`m${m.id}`} onClose={close} color={MONUMENT_COLORS[m.kind]}>
          <p className="pr-10 text-xs font-semibold tracking-[0.16em] uppercase" style={{ color: MONUMENT_COLORS[m.kind] }}>
            {t(KIND_LABEL[m.kind])}
          </p>
          <h3 className="mt-1 text-lg leading-tight font-bold text-pretty">{ml(m.name)}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{place}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            {t('monumentsSource')}:{' '}
            <a href={m.source} target="_blank" rel="noreferrer">
              {new URL(m.source).hostname}
            </a>
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
        flyTo={camera}
        interactiveLayerIds={interactive.length ? interactive : undefined}
        onFeatureClick={(layer, props) => {
          if (layer === MONUMENT_LAYER_ID && props) {
            const mon = monuments?.find((m) => m.id === Number(props.id));
            if (mon) setSel({ type: 'monument', mon });
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
        {showMon && monumentGeo && <MonumentsLayer data={monumentGeo} kinds={monKinds} />}
        {items.map((i) => {
          const active = i.key === selectedKey;
          return (
            <Marker
              key={i.key}
              longitude={i.lng}
              latitude={i.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                selectItem(i);
              }}
              style={{ zIndex: active ? 2 : i.kind === 'event' ? 1 : 0 }}
            >
              <button type="button" aria-label={`${yearLabel(i, lang)} ${l(i.title)}`} title={`${yearLabel(i, lang)} · ${l(i.title)}`} className="group grid size-11 place-items-center">
                {i.kind === 'event' ? (
                  // a lozenge, as in Kazakh ornament; a dashed ring around it marks an approximate site
                  <span className="relative grid place-items-center">
                    {i.approx && (
                      <span
                        className="absolute size-8 rounded-full border border-dashed opacity-80"
                        style={{ borderColor: period.color }}
                      />
                    )}
                    <span
                      className={cn(
                        'block rotate-45 rounded-[3px] border-2 transition-all duration-200',
                        active ? 'size-5 shadow-[0_0_0_6px_rgba(216,175,79,0.2)]' : 'size-3.5 group-hover:size-4.5',
                      )}
                      style={{ borderColor: period.color, backgroundColor: active ? period.color : 'rgba(7,13,24,0.75)' }}
                    />
                  </span>
                ) : (
                  <span
                    className={cn('block rounded-full border-2 transition-all duration-200', active ? 'size-4' : 'size-2.5 group-hover:size-3.5')}
                    style={{ borderColor: period.color, backgroundColor: '#e9eef7' }}
                  />
                )}
              </button>
            </Marker>
          );
        })}
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
                {t('monumentsNote')} {monuments ? `· ${monuments.length}` : '…'}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* bottom stack: panel, layer controls, timeline */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-2">
          <AnimatePresence mode="wait">{panel()}</AnimatePresence>
          {showMon && kindCounts.length > 0 && (
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
