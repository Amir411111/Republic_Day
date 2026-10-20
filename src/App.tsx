import { useState } from 'react';
import Atlas from './atlas/Atlas';
import Guide from './guide/Guide';
import Quest from './quest/Quest';
import { QUIZ_EVENTS, eventToCard } from './atlas/events';
import { cardsForPack, DEV_MODE } from './game/cards';
import Game from './game/Game';
import { pickDaily, pickRandom, todayKey } from './game/pick';
import { ROUNDS } from './game/scoring';
import type { Card, Pack } from './game/types';
import { LANGS, useI18n } from './i18n';
import { mistakeIds } from './progress/storage';

type Mode = 'daily' | 'random' | 'training' | 'khans';

// The daily game is mostly history: 4 older pictures and 1 from after this year
const MODERN_FROM = 2001;

interface Session {
  cards: Card[];
  mode: Mode;
  // bumps on "play again" so Game remounts with fresh state
  run: number;
}

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [pack, setPack] = useState<Pack>('kz');
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState('');
  const [screen, setScreen] = useState<'home' | 'atlas' | 'guide' | 'quest'>('home');

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

  const header = (
    <header className="top">
      <button
        type="button"
        className="link"
        onClick={() => {
          setSession(null);
          setScreen('home');
        }}
      >
        {t('appTitle')}
      </button>
      <div className="langs">
        {LANGS.map((code) => (
          <button
            key={code}
            type="button"
            className={code === lang ? 'on' : ''}
            onClick={() => setLang(code)}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>
    </header>
  );

  if (screen !== 'home') {
    return (
      <>
        {header}
        <main>
          {screen === 'atlas' && <Atlas />}
          {screen === 'quest' && <Quest />}
          {screen === 'guide' && (
            <div className="screen">
              <h1>{t('guideTitle')}</h1>
              <Guide />
            </div>
          )}
        </main>
      </>
    );
  }

  if (session) {
    const shareTitle =
      session.mode === 'daily' ? `${t('appTitle')} ${todayKey()} · ${t(pack === 'kz' ? 'packKz' : 'packSemey')}` : t('appTitle');
    return (
      <>
        {header}
        <main>
          <Game
            key={session.run}
            cards={session.cards}
            shareTitle={shareTitle}
            onPlayAgain={() => start(session.mode === 'daily' ? 'random' : session.mode)}
            onHome={() => setSession(null)}
          />
        </main>
      </>
    );
  }

  return (
    <>
      {header}
      <main className="screen">
        <h1>{t('appTitle')}</h1>
        <p className="lead">{t('tagline')}</p>
        {DEV_MODE && <p className="warn">{t('draftWarning')}</p>}

        <h3>{t('chooseSet')}</h3>
        <div className="toggle">
          {(['kz', 'semey'] as Pack[]).map((p) => (
            <button key={p} type="button" className={p === pack ? 'on' : ''} onClick={() => setPack(p)}>
              {t(p === 'kz' ? 'packKz' : 'packSemey')}
            </button>
          ))}
        </div>

        {pool.length === 0 ? (
          <p className="warn">{t('noCards')}</p>
        ) : (
          <div className="menu">
            <button type="button" className="primary" onClick={() => start('daily')}>
              {t('modeDaily')}
            </button>
            <p className="hint">{t('dailyNote')}</p>
            <button type="button" className="secondary" onClick={() => start('random')}>
              {t('modeRandom')}
            </button>
            <button type="button" className="secondary" onClick={() => start('training')}>
              {t('modeTraining')}
            </button>
          </div>
        )}

        <div className="menu">
          <button type="button" className="primary" onClick={() => setScreen('atlas')}>
            🗺 {t('modeAtlas')}
          </button>
          <button type="button" className="secondary" onClick={() => setScreen('guide')}>
            💬 {t('modeGuide')}
          </button>
          <button type="button" className="secondary" onClick={() => setScreen('quest')}>
            🚶 {t('modeQuest')}
          </button>
          <button type="button" className="secondary" onClick={() => start('khans')}>
            {t('modeKhans')}
          </button>
          <p className="hint">{t('modeKhansHint')}</p>
        </div>
        {notice && <p className="warn">{notice}</p>}
      </main>
    </>
  );
}
