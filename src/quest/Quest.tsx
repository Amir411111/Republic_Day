import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import Map, { AttributionControl, Layer, Marker, NavigationControl, Source } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import raw from '../../content/quest-semey.json';
import type { L10n, LatLng } from '../game/types';
import { useI18n } from '../i18n';
import { distanceKm } from '../map/distance';
import { STREET_STYLE } from '../map/styles';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';
import { TopBar } from '../ui/TopBar';

interface Stop {
  id: string;
  lat: number;
  lng: number;
  title: L10n;
  story: L10n;
  question: L10n;
  // Either the same labels in every language, or per-language labels
  options: string[] | Record<string, string[]>;
  answer: number;
  sources: string[];
}

const STOPS = raw as Stop[];
const KEY = 'tg_quest_semey_v1';
const NEAR_METERS = 150;

function loadDone(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

function saveDone(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable */
  }
}

export default function Quest({ onBack }: { onBack: () => void }) {
  const { t, l, lang } = useI18n();
  const [done, setDone] = useState<string[]>(loadDone);
  const [wrong, setWrong] = useState<string | null>(null);
  const [me, setMe] = useState<LatLng | null>(null);
  const [geoMsg, setGeoMsg] = useState('');

  useEffect(() => saveDone(done), [done]);

  const stamp = (id: string) => setDone((d) => (d.includes(id) ? d : [...d, id]));

  const locate = (stop: Stop) => {
    if (!navigator.geolocation) {
      setGeoMsg(t('questNoGeo'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(here);
        const m = Math.round(distanceKm(here, stop) * 1000);
        if (m <= NEAR_METERS) {
          stamp(stop.id);
          setGeoMsg('');
        } else setGeoMsg(t('questTooFar', { n: m }));
      },
      () => setGeoMsg(t('questNoGeo')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const optionsOf = (s: Stop) => (Array.isArray(s.options) ? s.options : s.options[lang] ?? s.options.ru);
  const finished = done.length === STOPS.length;

  const route = {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: STOPS.map((s) => [s.lng, s.lat]) },
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <TopBar onBack={onBack} className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl" />
      <div className="mx-auto max-w-2xl px-4 pb-10">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('questTitle')}</h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground sm:text-base">{t('questLead')}</p>
        <p className="mt-4 text-lg font-semibold text-primary">{t('questProgress', { n: done.length, total: STOPS.length })}</p>
        {finished && (
          <p className="mt-3 rounded-2xl border border-good/50 bg-good/10 p-4 font-semibold">🏅 {t('questFinished')}</p>
        )}

        <div className="relative mt-4 h-[46svh] min-h-72 overflow-hidden rounded-2xl border border-border">
          <Map
            mapStyle={STREET_STYLE}
            initialViewState={{ longitude: 80.25, latitude: 50.403, zoom: 13.6 }}
            attributionControl={false}
            style={{ position: 'absolute', inset: 0 }}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <AttributionControl position="bottom-right" compact />
            <Source id="quest-route" type="geojson" data={route}>
              <Layer
                id="quest-route-line"
                type="line"
                paint={{ 'line-color': '#b5651d', 'line-width': 3, 'line-dasharray': [2, 2] }}
              />
            </Source>
            {STOPS.map((s, i) => (
              <Marker key={s.id} longitude={s.lng} latitude={s.lat} anchor="center">
                <span
                  className={cn(
                    'grid size-8 place-items-center rounded-full border-[3px] border-white text-sm font-bold text-white shadow-lg',
                    done.includes(s.id) ? 'bg-[#1a8f3c]' : 'bg-[#b5651d]',
                  )}
                >
                  {i + 1}
                </span>
              </Marker>
            ))}
            {me && (
              <Marker longitude={me.lng} latitude={me.lat} anchor="center">
                <span className="block size-4 rounded-full border-[3px] border-white bg-[#2a6fdb] shadow-lg" />
              </Marker>
            )}
          </Map>
        </div>
        {geoMsg && <p className="mt-3 text-sm text-primary">{geoMsg}</p>}

        <ol className="mt-6 flex flex-col gap-4">
          {STOPS.map((s, i) => {
            const isDone = done.includes(s.id);
            return (
              <li
                key={s.id}
                className={cn(
                  'rounded-2xl border bg-card/60 p-5',
                  isDone ? 'border-good/50' : 'border-border/80',
                )}
              >
                <h2 className="font-display text-xl leading-tight font-bold">
                  {i + 1}. {l(s.title)} {isDone && '✅'}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-pretty text-foreground/90">{l(s.story)}</p>
                {!isDone && (
                  <>
                    <h3 className="mt-4 font-semibold">{l(s.question)}</h3>
                    <div className="mt-2 flex flex-col gap-2">
                      {optionsOf(s).map((o, k) => (
                        <Button
                          key={o}
                          variant="outline"
                          className="justify-start text-left"
                          onClick={() => {
                            if (k === s.answer) {
                              stamp(s.id);
                              setWrong(null);
                            } else setWrong(s.id);
                          }}
                        >
                          {o}
                        </Button>
                      ))}
                    </div>
                    {wrong === s.id && <p className="mt-2 text-sm text-destructive">{t('questWrong')}</p>}
                    <Button variant="chip" className="mt-3" onClick={() => locate(s)}>
                      <MapPin aria-hidden="true" className="size-4" /> {t('questImHere')}
                    </Button>
                  </>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  {t('sources')}:{' '}
                  {s.sources.map((u, k) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="mr-2">
                      [{k + 1}]
                    </a>
                  ))}
                </p>
              </li>
            );
          })}
        </ol>
        {done.length > 0 && (
          <Button variant="outline" className="mt-6 w-full" onClick={() => setDone([])}>
            {t('questReset')}
          </Button>
        )}
      </div>
    </div>
  );
}
