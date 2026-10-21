import { Check, MapPin, Share2, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Map, { AttributionControl, Layer, Marker, NavigationControl, Source } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import raw from '../../content/quest-semey.json';
import { cardById, imageUrl } from '../game/cards';
import type { L10n, LatLng } from '../game/types';
import YearPicker from '../game/YearPicker';
import { useI18n } from '../i18n';
import { distanceKm } from '../map/distance';
import { STREET_STYLE } from '../map/styles';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';
import { TopBar } from '../ui/TopBar';

// Either the same labels in every language, or per-language labels
type Options = string[] | Record<string, string[]>;

interface Choice {
  question: L10n;
  options: Options;
  answer: number;
}

interface Stop extends Choice {
  id: string;
  lat: number;
  lng: number;
  title: L10n;
  story: L10n;
  sources: string[];
  image?: { file: string; author: string; license: string; source_url: string };
  // an archival photo of the place from the game's cards
  then?: string;
  // "guess the year" on a slider
  year?: { answer: number; min: number; max: number };
  yearQuestion?: L10n;
  // a question answered by looking at the place itself
  detail?: Choice;
}

// What the player has done at a stop. A star is earned by a right answer on the first try,
// a year within YEAR_STAR years, and by being on site.
interface StopProgress {
  quiz?: 'star' | 'done';
  year?: number; // the guess
  detail?: 'star' | 'done';
  here?: boolean;
}

const STOPS = raw as Stop[];
const KEY = 'tg_quest_semey_v2';
const OLD_KEY = 'tg_quest_semey_v1';
const NEAR_METERS = 150;
const YEAR_STAR = 5;

function loadProgress(): Record<string, StopProgress> {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return JSON.parse(saved) as Record<string, StopProgress>;
    // the first version kept only the ids of visited stops
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || '[]') as string[];
    return Object.fromEntries(old.map((id) => [id, { quiz: 'done' }]));
  } catch {
    return {};
  }
}

function saveProgress(p: Record<string, StopProgress>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

const visited = (p?: StopProgress) => !!p && (!!p.quiz || !!p.here);

function starsOf(s: Stop, p: StopProgress = {}) {
  let n = (p.quiz === 'star' ? 1 : 0) + (p.here ? 1 : 0) + (p.detail === 'star' ? 1 : 0);
  if (s.year && p.year !== undefined && Math.abs(p.year - s.year.answer) <= YEAR_STAR) n++;
  return n;
}

const maxStarsOf = (s: Stop) => 2 + (s.year ? 1 : 0) + (s.detail ? 1 : 0);

export default function Quest({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [progress, setProgress] = useState<Record<string, StopProgress>>(loadProgress);
  const [me, setMe] = useState<LatLng | null>(null);
  const [geoMsg, setGeoMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => saveProgress(progress), [progress]);

  const update = (id: string, patch: StopProgress) =>
    setProgress((all) => ({ ...all, [id]: { ...all[id], ...patch } }));

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
          update(stop.id, { here: true });
          setGeoMsg('');
        } else setGeoMsg(t('questTooFar', { n: m }));
      },
      () => setGeoMsg(t('questNoGeo')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const doneCount = STOPS.filter((s) => visited(progress[s.id])).length;
  const stars = STOPS.reduce((n, s) => n + starsOf(s, progress[s.id]), 0);
  const maxStars = STOPS.reduce((n, s) => n + maxStarsOf(s), 0);
  const finished = doneCount === STOPS.length;
  const next = STOPS.find((s) => !visited(progress[s.id]));

  const goTo = (id: string) =>
    document.getElementById(`stop-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const share = async () => {
    const text = `${t('questShareText', { n: stars, total: maxStars })}\n${'★'.repeat(stars)}${'☆'.repeat(maxStars - stars)}\n${window.location.origin}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* share cancelled or clipboard blocked */
    }
  };

  const route = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: STOPS.map((s) => [s.lng, s.lat]),
      },
    }),
    [],
  );

  return (
    <div className="h-full overflow-y-auto bg-background">
      <TopBar onBack={onBack} className="sticky top-0 z-20 bg-background" />
      <div className="mx-auto max-w-2xl px-4 pb-10">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('questTitle')}</h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground sm:text-base">{t('questLead')}</p>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <p className="text-lg font-semibold text-primary">
            {t('questProgress', { n: doneCount, total: STOPS.length })}
          </p>
          <p className="flex items-center gap-1.5 text-lg font-semibold">
            <Star aria-hidden="true" className="size-5 fill-primary text-primary" />
            {t('questStars', { n: stars, total: maxStars })}
          </p>
        </div>

        {finished && (
          <div className="mt-4 rounded-2xl border border-good/50 bg-good/10 p-5">
            <p className="font-semibold">🏅 {t('questFinished')}</p>
            <p className="mt-2 text-2xl tracking-widest text-primary" aria-hidden="true">
              {'★'.repeat(stars)}
              <span className="text-muted-foreground">{'☆'.repeat(maxStars - stars)}</span>
            </p>
            <Button className="mt-3" onClick={share}>
              <Share2 aria-hidden="true" className="size-4" /> {copied ? t('copied') : t('share')}
            </Button>
          </div>
        )}

        <div className="relative mt-4 h-[46svh] min-h-72 overflow-hidden rounded-2xl border border-border">
          <Map
            mapStyle={STREET_STYLE}
            initialViewState={{
              longitude: 80.248,
              latitude: 50.405,
              zoom: 13.4,
            }}
            attributionControl={false}
            style={{ position: 'absolute', inset: 0 }}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <AttributionControl position="bottom-right" compact />
            <Source id="quest-route" type="geojson" data={route}>
              <Layer
                id="quest-route-line"
                type="line"
                paint={{
                  'line-color': '#b5651d',
                  'line-width': 3,
                  'line-dasharray': [2, 2],
                }}
              />
            </Source>
            {STOPS.map((s, i) => (
              <Marker key={s.id} longitude={s.lng} latitude={s.lat} anchor="center">
                <button
                  type="button"
                  aria-label={`${i + 1}`}
                  onClick={() => goTo(s.id)}
                  className={cn(
                    'grid size-9 place-items-center rounded-full border-[3px] border-white text-sm font-bold text-white shadow-lg',
                    visited(progress[s.id]) ? 'bg-[#1a8f3c]' : 'bg-[#b5651d]',
                    s === next && 'ring-4 ring-primary/60',
                  )}
                >
                  {i + 1}
                </button>
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
        {next && (
          <Button variant="outline" className="mt-3 w-full" onClick={() => goTo(next.id)}>
            <MapPin aria-hidden="true" className="size-4" /> {t('questGoTo')}: {STOPS.indexOf(next) + 1}
          </Button>
        )}

        <ol className="mt-6 flex flex-col gap-4">
          {STOPS.map((s, i) => (
            <StopCard
              key={s.id}
              stop={s}
              n={i + 1}
              progress={progress[s.id] ?? {}}
              onUpdate={(patch) => update(s.id, patch)}
              onLocate={() => locate(s)}
            />
          ))}
        </ol>
        {doneCount > 0 && (
          <Button variant="outline" className="mt-6 w-full" onClick={() => setProgress({})}>
            {t('questReset')}
          </Button>
        )}
      </div>
    </div>
  );
}

function StopCard({
  stop: s,
  n,
  progress: p,
  onUpdate,
  onLocate,
}: {
  stop: Stop;
  n: number;
  progress: StopProgress;
  onUpdate: (patch: StopProgress) => void;
  onLocate: () => void;
}) {
  const { t, l } = useI18n();
  const then = s.then ? cardById(s.then) : undefined;

  return (
    <li
      id={`stop-${s.id}`}
      className={cn(
        'scroll-mt-20 overflow-hidden rounded-2xl border bg-card/60',
        visited(p) ? 'border-good/50' : 'border-border/80',
      )}
    >
      {/* the photo would give away the on-site answer, so it opens once that task is done */}
      {s.image && (!s.detail || p.detail) && (
        <figure>
          <img
            src={import.meta.env.BASE_URL + s.image.file}
            alt={l(s.title)}
            loading="lazy"
            className="aspect-[16/9] w-full bg-black/40 object-cover"
          />
          <figcaption className="px-5 pt-2 text-[11px] text-muted-foreground">
            {t('imageBy')}: {s.image.author} ·{' '}
            <a href={s.image.source_url} target="_blank" rel="noreferrer">
              {s.image.license}
            </a>
          </figcaption>
        </figure>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl leading-tight font-bold">
            {n}. {l(s.title)}
          </h2>
          <span
            className="shrink-0 text-sm tracking-wider text-primary"
            aria-label={t('questStars', {
              n: starsOf(s, p),
              total: maxStarsOf(s),
            })}
          >
            {'★'.repeat(starsOf(s, p))}
            <span className="text-muted-foreground">{'☆'.repeat(maxStarsOf(s) - starsOf(s, p))}</span>
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-pretty text-foreground/90">{l(s.story)}</p>

        {then && (
          <figure className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-background/40">
            <img src={imageUrl(then)} alt={l(then.title)} loading="lazy" className="max-h-72 w-full object-contain" />
            <figcaption className="p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {t('questThen')}, {then.year}:
              </span>{' '}
              {l(then.title)} · {t('imageBy')}: {then.image_credit.author} ·{' '}
              <a href={then.image_credit.source_url} target="_blank" rel="noreferrer">
                {then.image_credit.license}
              </a>
            </figcaption>
          </figure>
        )}

        <ChoiceTask label={t('questTaskQuiz')} choice={s} result={p.quiz} onResult={(r) => onUpdate({ quiz: r })} />

        {s.year && s.yearQuestion && (
          <YearTask
            stopId={s.id}
            year={s.year}
            question={l(s.yearQuestion)}
            guess={p.year}
            onGuess={(y) => onUpdate({ year: y })}
          />
        )}

        {s.detail && (
          <ChoiceTask
            label={t('questTaskDetail')}
            hint={t('questTaskDetailHint')}
            choice={s.detail}
            result={p.detail}
            onResult={(r) => onUpdate({ detail: r })}
          />
        )}

        {p.here ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-good">
            <Check aria-hidden="true" className="size-4" /> {t('questOnSite')}
          </p>
        ) : (
          <Button variant="chip" className="mt-4" onClick={onLocate}>
            <MapPin aria-hidden="true" className="size-4" /> {t('questImHere')}
          </Button>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {t('sources')}:{' '}
          {s.sources.map((u, k) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="mr-2">
              [{k + 1}]
            </a>
          ))}
        </p>
      </div>
    </li>
  );
}

function ChoiceTask({
  label,
  hint,
  choice,
  result,
  onResult,
}: {
  label: string;
  hint?: string;
  choice: Choice;
  result?: 'star' | 'done';
  onResult: (r: 'star' | 'done') => void;
}) {
  const { t, l, lang } = useI18n();
  const [missed, setMissed] = useState(false);
  const options = Array.isArray(choice.options) ? choice.options : (choice.options[lang] ?? choice.options.ru);

  return (
    <section className="mt-5 border-t border-border/60 pt-4">
      <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <h3 className="mt-1 font-semibold">{l(choice.question)}</h3>
      {result ? (
        <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-good">
          <Check aria-hidden="true" className="size-4" /> {t('questRight')} {options[choice.answer]}
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-col gap-2">
            {options.map((o, k) => (
              <Button
                key={o}
                variant="outline"
                className="justify-start text-left"
                onClick={() => (k === choice.answer ? onResult(missed ? 'done' : 'star') : setMissed(true))}
              >
                {o}
              </Button>
            ))}
          </div>
          {missed && <p className="mt-2 text-sm text-destructive">{t('questWrong')}</p>}
        </>
      )}
    </section>
  );
}

function YearTask({
  stopId,
  year,
  question,
  guess,
  onGuess,
}: {
  stopId: string;
  year: { answer: number; min: number; max: number };
  question: string;
  guess?: number;
  onGuess: (y: number) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(() => Math.round((year.min + year.max) / 2));
  const off = guess === undefined ? 0 : Math.abs(guess - year.answer);

  return (
    <section className="mt-5 border-t border-border/60 pt-4">
      <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{t('questTaskYear')}</p>
      <h3 className="mt-1 mb-3 font-semibold">{question}</h3>
      {guess === undefined ? (
        <>
          <YearPicker
            id={`year-${stopId}`}
            value={value}
            onChange={setValue}
            min={year.min}
            max={year.max}
            label={t('questTaskYear')}
          />
          <Button className="mt-3 w-full" onClick={() => onGuess(value)}>
            {t('questAnswer')}
          </Button>
        </>
      ) : (
        <p className={cn('text-sm font-semibold', off <= YEAR_STAR ? 'text-good' : 'text-primary')}>
          {off === 0 ? t('questYearExact', { year: year.answer }) : t('questYearOff', { year: year.answer, n: off })}
        </p>
      )}
    </section>
  );
}
