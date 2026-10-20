import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n';
import GuessMap from '../map/GuessMap';
import SceneView from '../map/SceneView';
import { saveResult } from '../progress/storage';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';
import { TopBar } from '../ui/TopBar';
import { imageUrl } from './cards';
import { scoreRound, totalScore } from './scoring';
import SummaryScreen from './SummaryScreen';
import type { Card, LatLng, RoundResult } from './types';
import YearPicker from './YearPicker';

// photo: guess from the picture; text: event title (khans quiz); scene: 3D satellite view of the site
export type RoundKind = 'photo' | 'text' | 'scene';

interface Props {
  cards: Card[];
  kind: RoundKind;
  shareTitle: string;
  onPlayAgain: () => void;
  onHome: () => void;
}

const DEFAULT_YEAR = 1900;

// On a phone the explanation would cover the whole picture, so it opens collapsed there
const wide = () => window.matchMedia('(min-width: 1024px)').matches;

export default function Game({ cards, kind, shareTitle, onPlayAgain, onHome }: Props) {
  const { t, l } = useI18n();
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [phase, setPhase] = useState<'round' | 'reveal' | 'summary'>('round');
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [details, setDetails] = useState(wide);

  const card = cards[idx];
  const revealed = phase === 'reveal';
  const result = revealed ? results[idx] : null;
  const isLast = idx + 1 >= cards.length;

  const submit = () => {
    if (!guess) return;
    const r = scoreRound(card, year, guess);
    saveResult(r);
    setResults((prev) => [...prev, r]);
    setDetails(wide());
    setPhase('reveal');
  };

  const next = () => {
    if (isLast) {
      setPhase('summary');
      return;
    }
    setIdx(idx + 1);
    setYear(DEFAULT_YEAR);
    setGuess(null);
    setPhase('round');
  };

  if (phase === 'summary') {
    return <SummaryScreen results={results} shareTitle={shareTitle} onPlayAgain={onPlayAgain} onHome={onHome} />;
  }

  const answer = { lat: card.lat, lng: card.lng };
  const yearGap = result ? Math.abs(result.guessYear - card.year) : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* the question: picture, event title or the site in 3D */}
        <div className="relative min-h-[30svh] flex-1 overflow-hidden border-b border-border bg-black lg:min-h-0 lg:border-r lg:border-b-0">
          {kind === 'scene' ? (
            <SceneView id={card.id} at={answer} />
          ) : card.image ? (
            <img
              key={card.id}
              src={imageUrl(card)}
              alt={revealed ? l(card.title) : ''}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(216,175,79,0.14)_0%,transparent_72%)]" />
          )}

          <TopBar onBack={onHome} className="absolute inset-x-0 top-0 z-20" />

          {/* text and scene rounds name the event; photo rounds stay silent until the answer */}
          {!revealed && kind !== 'photo' && (
            <div
              className={cn(
                'absolute inset-x-3 z-10 rounded-2xl border border-border/80 bg-card/85 p-3 backdrop-blur-xl sm:inset-x-5 sm:max-w-lg sm:p-4',
                card.image || kind === 'scene' ? 'bottom-3 sm:bottom-5' : 'top-1/2 -translate-y-1/2 sm:mx-auto',
              )}
            >
              <h2 className="font-display text-lg leading-tight font-bold text-pretty sm:text-2xl">{l(card.title)}</h2>
              <p className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm">
                {t(kind === 'scene' ? 'satelliteQuestion' : 'textRoundHint')}
              </p>
              {kind === 'text' && <p className="mt-1 hidden text-xs text-muted-foreground/80 sm:block">{t('textRoundYearHint')}</p>}
            </div>
          )}

          <AnimatePresence>
            {revealed && (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                className="absolute inset-x-3 bottom-3 z-10 flex max-h-[calc(100%-5.5rem)] flex-col rounded-2xl border border-border/80 bg-card/90 shadow-2xl backdrop-blur-xl sm:inset-x-5 sm:bottom-5 sm:max-w-lg"
              >
                <button
                  type="button"
                  onClick={() => setDetails(!details)}
                  className="flex min-h-12 w-full shrink-0 items-start justify-between gap-3 p-4 pb-2 text-left"
                  aria-expanded={details}
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold tracking-[0.16em] text-primary uppercase tabular-nums">
                      {card.year} · {l(card.place)}
                    </span>
                    <span className="mt-1 block font-display text-lg leading-tight font-bold text-pretty">{l(card.title)}</span>
                  </span>
                  {details ? (
                    <ChevronDown aria-label={t('close')} className="mt-1 size-5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronUp aria-label={t('details')} className="mt-1 size-5 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {details && (
                  <div className="min-h-0 overflow-y-auto px-4 pb-4 text-sm leading-relaxed">
                    <p className="text-pretty text-foreground/90">{l(card.explanation)}</p>
                    {l(card.clue) && (
                      <>
                        <h3 className="mt-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                          {t('clue')}
                        </h3>
                        <p className="mt-1 text-pretty text-muted-foreground">{l(card.clue)}</p>
                      </>
                    )}
                    <h3 className="mt-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      {t('sources')}
                    </h3>
                    <ul className="mt-1 space-y-1">
                      {card.sources.map((s) => (
                        <li key={s} className="truncate">
                          <a href={s} target="_blank" rel="noreferrer">
                            {decodeURI(s)}
                          </a>
                        </li>
                      ))}
                    </ul>
                    {card.image && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {t('imageBy')}: {card.image_credit.author} ·{' '}
                        <a href={card.image_credit.source_url} target="_blank" rel="noreferrer">
                          {card.image_credit.license}
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* the answer map */}
        <div className="relative min-h-[30svh] flex-1 lg:min-h-0">
          <GuessMap
            guess={revealed ? (result?.guess ?? null) : guess}
            answer={revealed ? answer : null}
            onGuess={setGuess}
            guessLabel={t('yourGuess')}
            answerLabel={l(card.place)}
          />
          {!revealed && (
            <p className="pointer-events-none absolute inset-x-0 top-3 z-10 px-14 text-center text-sm text-foreground/90 drop-shadow-[0_2px_8px_rgba(7,13,24,0.95)]">
              {t('where')} — {t('tapMap')}
            </p>
          )}
        </div>
      </div>

      {/* the year, and the one button that ends the round */}
      <div className="shrink-0 border-t border-border bg-card/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="tracking-[0.16em] uppercase">{t('round', { n: idx + 1, total: cards.length })}</span>
            <span className="tabular-nums">
              <AnimatedNumber value={totalScore(results)} duration={0.7} /> {t('pointsWord')}
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {revealed && result ? (
              <dl className="flex flex-1 flex-wrap items-baseline gap-x-8 gap-y-2">
                <div>
                  <dt className="text-xs text-muted-foreground">{t('distance')}</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {Math.round(result.km)} {t('kmUnit')}{' '}
                    <span className="text-sm font-normal text-primary">
                      <AnimatedNumber value={result.placeScore} prefix="+" delay={0.15} />
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t('yearGap')}</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {yearGap === 0 ? t('exact') : `${yearGap} ${t('yearsUnit')}`}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({t('yourGuess').toLowerCase()}: {result.guessYear})
                    </span>{' '}
                    <span className="text-sm font-normal text-primary">
                      <AnimatedNumber value={result.yearScore} prefix="+" delay={0.35} />
                    </span>
                  </dd>
                </div>
              </dl>
            ) : (
              <YearPicker value={year} onChange={setYear} />
            )}

            <Button
              onClick={revealed ? next : submit}
              disabled={!revealed && !guess}
              className="w-full shrink-0 sm:w-60"
            >
              {revealed ? (isLast ? t('toResults') : t('next')) : guess ? t('submit') : t('needPlace')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
