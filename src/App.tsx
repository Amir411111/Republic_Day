import { lazy, Suspense, useState, type ReactNode } from 'react';
import { QUIZ_EVENTS, SCENE_EVENTS, eventToCard } from './atlas/events';
import { cardsForPack } from './game/cards';
import type { RoundKind } from './game/Game';
import { pickDaily, pickRandom, todayKey } from './game/pick';
import { ROUNDS } from './game/scoring';
import type { Card, Pack } from './game/types';
import GuideScreen from './guide/GuideScreen';
import { useI18n } from './i18n';
import Landing, { type Mode, type Place } from './landing/Landing';
import { mistakeIds } from './progress/storage';

// Map screens carry MapLibre (~300 KB gzipped): loaded on first use, so the landing page opens fast
const Atlas = lazy(() => import('./atlas/Atlas'));
const Game = lazy(() => import('./game/Game'));
const Quest = lazy(() => import('./quest/Quest'));
const SourcesPage = lazy(() => import('./landing/SourcesPage'));

const Loading = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<div className="grid h-full place-items-center text-muted-foreground">…</div>}>{children}</Suspense>
);

// The daily game is mostly history: 4 older pictures and 1 from after this year
const MODERN_FROM = 2001;

interface Session {
  cards: Card[];
  mode: Mode;
  // bumps on "play again" so Game remounts with fresh state
  run: number;
}

const KIND: Record<Mode, RoundKind> = {
  daily: 'photo',
  random: 'photo',
  training: 'photo',
  khans: 'text',
  satellite: 'scene',
};

export default function App() {
  const { t } = useI18n();
  const [pack, setPack] = useState<Pack>('kz');
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState('');
  const [place, setPlace] = useState<Place | null>(null);

  const pool = cardsForPack(pack);

  const start = (mode: Mode) => {
    let cards: Card[];
    if (mode === 'daily')
      cards = pickDaily(
        [
          ...pickDaily(pool.filter((c) => c.year < MODERN_FROM), `${todayKey()}-${pack}-old`).slice(0, ROUNDS - 1),
          ...pickDaily(pool.filter((c) => c.year >= MODERN_FROM), `${todayKey()}-${pack}-new`).slice(0, 1),
        ],
        `${todayKey()}-${pack}`,
      );
    else if (mode === 'khans') cards = pickRandom(QUIZ_EVENTS.map(eventToCard));
    else if (mode === 'satellite') cards = pickRandom(SCENE_EVENTS.map(eventToCard));
    else if (mode === 'random') cards = pickRandom(pool);
    else {
      const ids = new Set(mistakeIds());
      cards = pickRandom(pool.filter((c) => ids.has(c.id)));
      if (cards.length === 0) {
        setNotice(t('trainingEmpty'));
        return;
      }
    }
    setNotice('');
    setSession((s) => ({ cards, mode, run: (s?.run ?? 0) + 1 }));
  };

  const home = () => {
    setSession(null);
    setPlace(null);
  };

  if (session) {
    const shareTitle =
      session.mode === 'daily'
        ? `${t('appTitle')} ${todayKey()} · ${t(pack === 'kz' ? 'packKz' : 'packSemey')}`
        : t('appTitle');
    return (
      <Loading>
        <Game
          key={session.run}
          cards={session.cards}
          kind={KIND[session.mode]}
          shareTitle={shareTitle}
          onPlayAgain={() => start(session.mode === 'daily' ? 'random' : session.mode)}
          onHome={home}
        />
      </Loading>
    );
  }

  if (place === 'atlas')
    return (
      <Loading>
        <Atlas onBack={home} />
      </Loading>
    );
  if (place === 'quest')
    return (
      <Loading>
        <Quest onBack={home} />
      </Loading>
    );
  if (place === 'guide') return <GuideScreen onBack={home} />;
  if (place === 'sources')
    return (
      <Loading>
        <SourcesPage onBack={home} />
      </Loading>
    );

  return (
    <Landing
      pack={pack}
      onPack={setPack}
      poolSize={pool.length}
      notice={notice}
      onStart={start}
      onOpen={(p) => {
        setNotice('');
        setPlace(p);
      }}
    />
  );
}
