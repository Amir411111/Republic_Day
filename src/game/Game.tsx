import { useState } from 'react';
import { saveResult } from '../progress/storage';
import RevealScreen from './RevealScreen';
import RoundScreen from './RoundScreen';
import { scoreRound } from './scoring';
import SummaryScreen from './SummaryScreen';
import type { Card, LatLng, RoundResult } from './types';

interface Props {
  cards: Card[];
  shareTitle: string;
  onPlayAgain: () => void;
  onHome: () => void;
}

export default function Game({ cards, shareTitle, onPlayAgain, onHome }: Props) {
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [phase, setPhase] = useState<'round' | 'reveal' | 'summary'>('round');

  const card = cards[idx];

  const submit = (year: number, guess: LatLng) => {
    const r = scoreRound(card, year, guess);
    saveResult(r);
    setResults((prev) => [...prev, r]);
    setPhase('reveal');
    window.scrollTo(0, 0);
  };

  const next = () => {
    if (idx + 1 >= cards.length) {
      setPhase('summary');
    } else {
      setIdx(idx + 1);
      setPhase('round');
    }
    window.scrollTo(0, 0);
  };

  if (phase === 'summary') {
    return <SummaryScreen results={results} shareTitle={shareTitle} onPlayAgain={onPlayAgain} onHome={onHome} />;
  }
  if (phase === 'reveal') {
    return <RevealScreen card={card} result={results[idx]} isLast={idx + 1 >= cards.length} onNext={next} />;
  }
  // key resets the round's local state for every new card
  return <RoundScreen key={card.id} card={card} roundNo={idx + 1} total={cards.length} onSubmit={submit} />;
}
