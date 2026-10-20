import { motion } from 'framer-motion';
import { useState } from 'react';
import { useI18n } from '../i18n';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { Button } from '../ui/Button';
import { LangSwitch } from '../ui/LangSwitch';
import { cardById, imageUrl } from './cards';
import { MAX_ROUND_SCORE, totalScore } from './scoring';
import type { RoundResult } from './types';

interface Props {
  results: RoundResult[];
  shareTitle: string;
  onPlayAgain: () => void;
  onHome: () => void;
}

function square(score: number): string {
  if (score >= 160) return '🟩';
  if (score >= 100) return '🟨';
  return '🟥';
}

export default function SummaryScreen({ results, shareTitle, onPlayAgain, onHome }: Props) {
  const { t, l } = useI18n();
  const [copied, setCopied] = useState(false);
  const total = totalScore(results);
  const max = MAX_ROUND_SCORE * results.length;

  const share = async () => {
    const text = `${shareTitle} ${total}/${max}\n${results
      .map((r) => square(r.yearScore + r.placeScore))
      .join('')}\n${window.location.origin}`;
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

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <div className="mb-8 flex justify-end">
          <LangSwitch />
        </div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">{t('gameOver')}</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-display text-6xl font-bold text-primary tabular-nums">
              <AnimatedNumber value={total} duration={1.6} delay={0.25} />
            </span>
            <span className="text-lg text-muted-foreground tabular-nums">/ {max}</span>
          </div>
          <p className="mt-2 text-2xl tracking-widest">{results.map((r) => square(r.yearScore + r.placeScore)).join('')}</p>
        </motion.div>

        <ol className="mt-8 flex flex-col gap-3">
          {results.map((r, i) => {
            const card = cardById(r.cardId);
            const sum = r.yearScore + r.placeScore;
            return (
              <motion.li
                key={r.cardId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i, duration: 0.4 }}
                className="flex gap-4 rounded-2xl border border-border/80 bg-card/60 p-4"
              >
                {card?.image && (
                  <img
                    src={imageUrl(card)}
                    alt=""
                    className="size-16 shrink-0 rounded-xl object-cover"
                    loading="lazy"
                    onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="leading-tight font-semibold text-pretty">{card ? l(card.title) : r.cardId}</h3>
                    <span className="shrink-0 text-lg font-bold text-primary tabular-nums">
                      <AnimatedNumber value={sum} duration={0.8} delay={0.3 + 0.1 * i} />
                    </span>
                  </div>
                  {card && (
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {card.year} · {t('yourGuess')}: {r.guessYear} · {Math.round(r.km)} {t('kmUnit')}
                    </p>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ol>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Button onClick={share}>{copied ? t('copied') : t('share')}</Button>
          <Button variant="outline" onClick={onPlayAgain}>
            {t('playAgain')}
          </Button>
          <Button variant="outline" onClick={onHome}>
            {t('home')}
          </Button>
        </div>
      </div>
    </div>
  );
}
