import { useState } from 'react';
import { useI18n } from '../i18n';
import { cardById } from './cards';
import { MAX_ROUND_SCORE, ROUNDS, totalScore } from './scoring';
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
  const max = MAX_ROUND_SCORE * ROUNDS;

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
    <div className="screen">
      <h2>{t('results')}</h2>
      <p className="big">
        {t('total')}: {total} / {max}
      </p>
      <ol className="summary">
        {results.map((r) => {
          const card = cardById(r.cardId);
          return (
            <li key={r.cardId}>
              {square(r.yearScore + r.placeScore)} {card ? `${l(card.title)} (${card.year})` : r.cardId}:{' '}
              {r.yearScore + r.placeScore}
            </li>
          );
        })}
      </ol>
      <div className="actions">
        <button type="button" className="primary" onClick={share}>
          {copied ? t('copied') : t('share')}
        </button>
        <button type="button" className="secondary" onClick={onPlayAgain}>
          {t('playAgain')}
        </button>
        <button type="button" className="secondary" onClick={onHome}>
          {t('home')}
        </button>
      </div>
    </div>
  );
}
