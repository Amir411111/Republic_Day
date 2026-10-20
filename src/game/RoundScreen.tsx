import { useState } from 'react';
import { useI18n } from '../i18n';
import GuessMap from '../map/GuessMap';
import { imageUrl } from './cards';
import type { Card, LatLng } from './types';
import YearPicker from './YearPicker';

interface Props {
  card: Card;
  roundNo: number;
  total: number;
  onSubmit: (year: number, guess: LatLng) => void;
}

const DEFAULT_YEAR = 1900;

export default function RoundScreen({ card, roundNo, total, onSubmit }: Props) {
  const { t, l } = useI18n();
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [guess, setGuess] = useState<LatLng | null>(null);

  return (
    <div className="screen">
      <p className="round-no">{t('round', { n: roundNo, total })}</p>
      {card.image ? (
        <img className="photo" src={imageUrl(card)} alt="" />
      ) : (
        <div className="text-card">
          <h2>{l(card.title)}</h2>
          <p>{t('textRoundHint')}</p>
          <p className="hint">{t('textRoundYearHint')}</p>
        </div>
      )}

      <YearPicker value={year} onChange={setYear} label={t('whatYear')} />

      <h3>{t('where')}</h3>
      <p className="hint">{t('tapMap')}</p>
      <GuessMap value={guess} onGuess={setGuess} />

      <div className="actions">
        <button type="button" className="secondary" onClick={() => setGuess(null)} disabled={!guess}>
          {t('reset')}
        </button>
        <button type="button" className="primary" disabled={!guess} onClick={() => guess && onSubmit(year, guess)}>
          {guess ? t('submit') : t('needPlace')}
        </button>
      </div>
    </div>
  );
}
