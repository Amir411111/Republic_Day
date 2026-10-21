import {
  BookOpenText,
  CalendarDays,
  ChevronDown,
  Crown,
  Footprints,
  Image,
  Library,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  RotateCcw,
  Satellite,
  Scale,
  ShieldCheck,
  Shuffle,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRef } from 'react';
import monumentsMeta from '../../content/monuments-meta.json';
import tunnel from '../../content/tunnel.json';
import { EVENTS } from '../atlas/events';
import { PERIODS } from '../atlas/periods';
import { ALL_CARDS, DEV_MODE, isVerified } from '../game/cards';
import type { L10n, Pack } from '../game/types';
import { useI18n } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { BackgroundPaths } from '../ui/BackgroundPaths';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';
import { LangSwitch } from '../ui/LangSwitch';
import { PerspectiveTunnelHero } from '../ui/TunnelHero';
import { Eras, Honesty, HowItWorks, SectionHead, SectionShell, Sources, useReveal, type SourceItem, type TextItem } from './Sections';

export type Mode = 'daily' | 'random' | 'training' | 'khans' | 'satellite';
export type Place = 'atlas' | 'guide' | 'quest' | 'sources';

interface Props {
  pack: Pack;
  onPack: (p: Pack) => void;
  poolSize: number;
  notice: string;
  onStart: (mode: Mode) => void;
  onOpen: (place: Place) => void;
}

interface TunnelEntry {
  image: string;
  title: L10n;
  image_credit: { author: string; license: string; source_url: string };
}

const TUNNEL = tunnel as TunnelEntry[];
const TUNNEL_IMAGES = TUNNEL.map((e) => ({ src: import.meta.env.BASE_URL + e.image, title: e.title }));

// written by scripts/import_monuments.py, so the counter needs no points loaded
// the size of the state list; the map shows the ones with a reliable point (monumentsMeta.count)
const MONUMENTS = monumentsMeta.listed;

const STEPS: TextItem[] = [
  { id: 'look', icon: Image, title: 'step1Title', text: 'step1Text' },
  { id: 'guess', icon: MapPin, title: 'step2Title', text: 'step2Text' },
  { id: 'read', icon: BookOpenText, title: 'step3Title', text: 'step3Text' },
  { id: 'map', icon: MapIcon, title: 'step4Title', text: 'step4Text' },
  { id: 'guide', icon: MessageCircle, title: 'step5Title', text: 'step5Text' },
];

const HONESTY: TextItem[] = [
  { id: 'sources', icon: Library, title: 'honesty1Title', text: 'honesty1Text' },
  { id: 'real', icon: ShieldCheck, title: 'honesty2Title', text: 'honesty2Text' },
  { id: 'disputed', icon: Scale, title: 'honesty3Title', text: 'honesty3Text' },
];

export const SOURCES: SourceItem[] = [
  { id: 'commons', name: 'Wikimedia Commons', license: 'PD / CC BY / CC BY-SA', what: 'srcCommons', url: 'https://commons.wikimedia.org' },
  {
    id: 'adilet',
    name: 'Әділет (adilet.zan.kz)',
    license: 'Official acts',
    what: 'srcAdilet',
    url: 'https://adilet.zan.kz/rus/docs/G25KS000318',
  },
  { id: 'ne', name: 'Natural Earth', license: 'Public domain', what: 'srcNaturalEarth', url: 'https://www.naturalearthdata.com' },
  {
    id: 'hb',
    name: 'historical-basemaps',
    license: 'GPL-3.0',
    what: 'srcBasemaps',
    url: 'https://github.com/aourednik/historical-basemaps',
  },
  { id: 'terrain', name: 'AWS Terrain Tiles', license: 'Open data', what: 'srcTerrain', url: 'https://registry.opendata.aws/terrain-tiles/' },
  { id: 'esri', name: 'Esri World Imagery', license: 'Esri, Maxar', what: 'srcEsri', url: 'https://www.esri.com' },
  { id: 'osm', name: 'OpenStreetMap', license: 'ODbL', what: 'srcOsm', url: 'https://www.openstreetmap.org/copyright' },
  { id: 'wiki', name: 'Wikipedia, e-history.kz', license: 'CC BY-SA', what: 'srcWiki', url: 'https://e-history.kz' },
];

interface ModeCard {
  key: Mode | Place;
  icon: LucideIcon;
  title: StringKey;
  hint: StringKey;
  // the daily game is the headline mode
  wide?: boolean;
}

const GAME_MODES: ModeCard[] = [
  { key: 'daily', icon: CalendarDays, title: 'modeDaily', hint: 'dailyNote', wide: true },
  { key: 'random', icon: Shuffle, title: 'modeRandom', hint: 'modeRandomHint' },
  { key: 'training', icon: RotateCcw, title: 'modeTraining', hint: 'modeTrainingHint' },
  { key: 'khans', icon: Crown, title: 'modeKhans', hint: 'modeKhansHint' },
  { key: 'satellite', icon: Satellite, title: 'modeSatellite', hint: 'modeSatelliteHint' },
];

const PLACES: ModeCard[] = [
  { key: 'atlas', icon: MapIcon, title: 'modeAtlas', hint: 'modeAtlasHint' },
  { key: 'guide', icon: MessageCircle, title: 'guideTitle', hint: 'modeGuideHint' },
  { key: 'quest', icon: Footprints, title: 'modeQuest', hint: 'modeQuestHint' },
];

const PHOTO_MODES = new Set<string>(['daily', 'random', 'training']);

export default function Landing({ pack, onPack, poolSize, notice, onStart, onOpen }: Props) {
  const { t, l, lang } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const modesRef = useRef<HTMLDivElement>(null);
  const reveal = useReveal();

  const photoCount = ALL_CARDS.filter(isVerified).length;
  const stats: [number, StringKey][] = [
    [photoCount, 'statPhotos'],
    [EVENTS.length, 'statEvents'],
    [PERIODS.length, 'statEras'],
    [MONUMENTS, 'statMonuments'],
  ];

  const open = (key: Mode | Place) => {
    if (key === 'atlas' || key === 'guide' || key === 'quest' || key === 'sources') onOpen(key);
    else onStart(key);
  };

  const card = (m: ModeCard, i: number) => {
    const Icon = m.icon;
    const disabled = PHOTO_MODES.has(m.key) && poolSize === 0;
    return (
      <motion.li key={m.key} {...reveal(i * 0.05)} data-tour={m.key} className={cn(m.wide && 'sm:col-span-2')}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => open(m.key)}
          className={cn(
            'group flex h-full min-h-24 w-full items-start gap-4 rounded-2xl border p-5 text-left transition-colors',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50',
            m.wide
              ? 'border-primary/50 bg-primary/10 hover:bg-primary/15'
              : 'border-border/80 bg-card/60 hover:border-primary/40 hover:bg-accent',
          )}
        >
          <span
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-xl ring-1',
              m.wide ? 'bg-primary text-primary-foreground ring-primary' : 'bg-primary/12 text-primary ring-primary/25',
            )}
          >
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0">
            <span className={cn('block leading-tight font-semibold', m.wide ? 'font-display text-xl' : 'text-base')}>
              {t(m.title)}
            </span>
            <span className="mt-1.5 block text-sm leading-relaxed text-pretty text-muted-foreground">{t(m.hint)}</span>
          </span>
        </button>
      </motion.li>
    );
  };

  return (
    <div ref={scrollRef} className="h-full overflow-x-hidden overflow-y-auto">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-between bg-gradient-to-b from-background/95 via-background/60 to-transparent p-3 pb-6 sm:p-5 sm:pb-8 [&>*]:pointer-events-auto">
        <button
          type="button"
          onClick={() => modesRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="min-h-12 rounded-xl border border-border/80 bg-card/70 px-3 font-display text-base font-bold whitespace-nowrap backdrop-blur-xl max-[380px]:hidden sm:px-4 sm:text-lg"
        >
          {t('appTitle')}
        </button>
        <div data-tour="comfort">
          <LangSwitch />
        </div>
      </div>

      <PerspectiveTunnelHero
        images={TUNNEL_IMAGES}
        lang={lang}
        eyebrow={t('tunnelEyebrow')}
        title={t('tunnelTitle')}
        subtitle={t('tunnelSubtitle')}
        prompt={t('tunnelPrompt')}
        scrollRef={scrollRef}
      />

      <BackgroundPaths
        title={t('appTitle')}
        subtitle={t('tagline')}
        stats={stats.map(([n, key], i) => (
          <span key={key} className="flex items-center gap-3 tabular-nums">
            {i > 0 && (
              <span aria-hidden="true" className="text-primary/70">
                ·
              </span>
            )}
            <span>
              <b className="font-semibold text-foreground">{n}</b> {t(key)}
            </span>
          </span>
        ))}
        footer={
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] tracking-[0.12em] text-muted-foreground/70 uppercase">
              {PERIODS.map((p, i) => (
                <span key={p.id} className="flex items-center gap-2">
                  {i > 0 && (
                    <span aria-hidden="true" className="opacity-50">
                      →
                    </span>
                  )}
                  <span style={{ color: p.color, opacity: 0.85 }}>{l(p.short)}</span>
                </span>
              ))}
            </div>
            <ChevronDown aria-hidden="true" className="size-5 text-muted-foreground/50" />
          </div>
        }
      >
        <Button onClick={() => onStart('daily')} disabled={poolSize === 0} className="min-w-56 px-8">
          {t('modeDaily')}
          <span aria-hidden="true">→</span>
        </Button>
        <Button variant="outline" onClick={() => onOpen('atlas')} className="min-w-56 px-8">
          {t('modeAtlas')}
        </Button>
      </BackgroundPaths>

      <div ref={modesRef}>
        <SectionShell>
          <SectionHead title="modesTitle" lead="modesLead" />
          {DEV_MODE && <p className="mb-4 text-sm text-primary">{t('draftWarning')}</p>}

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm text-muted-foreground">{t('chooseSet')}:</span>
            {(['kz', 'semey'] as Pack[]).map((p) => (
              <Button key={p} variant="chip" on={p === pack} onClick={() => onPack(p)}>
                {t(p === 'kz' ? 'packKz' : 'packSemey')}
              </Button>
            ))}
          </div>
          {poolSize === 0 && <p className="mb-4 text-sm text-destructive">{t('noCards')}</p>}
          {notice && (
            <p role="status" className="mb-4 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
              {notice}
            </p>
          )}

          <ul data-tour="modes" className="grid gap-4 sm:grid-cols-2">
            {GAME_MODES.map(card)}
          </ul>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">{PLACES.map((m, i) => card(m, i + GAME_MODES.length))}</ul>
        </SectionShell>
      </div>

      <HowItWorks steps={STEPS} tour="how" />
      <Eras />
      <Honesty points={HONESTY} />
      <Sources sources={SOURCES}>
        <Button variant="outline" className="mt-8" onClick={() => onOpen('sources')}>
          {t('srcAll')} →
        </Button>
        <p className="mt-10 text-xs leading-relaxed text-muted-foreground/80">
          {TUNNEL.map((e, i) => (
            <span key={e.image}>
              {i > 0 && ' · '}
              {l(e.title)}:{' '}
              <a href={e.image_credit.source_url} target="_blank" rel="noreferrer" className="text-muted-foreground">
                {e.image_credit.author}, {e.image_credit.license}
              </a>
            </span>
          ))}
        </p>
      </Sources>
    </div>
  );
}
