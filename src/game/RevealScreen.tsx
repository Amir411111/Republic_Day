import { useI18n } from '../i18n';
import RevealMap from '../map/RevealMap';
import { imageUrl } from './cards';
import type { Card, RoundResult } from './types';

interface Props {
  card: Card;
  result: RoundResult;
  isLast: boolean;
  onNext: () => void;
}

export default function RevealScreen({ card, result, isLast, onNext }: Props) {
  const { t, l } = useI18n();
  const credit = card.image_credit;

  return (
    <div className="screen">
      <img className="photo" src={imageUrl(card)} alt={l(card.title)} />
      <h2>{l(card.title)}</h2>

      <div className="score-grid">
        <div>
          <div className="big">{card.year}</div>
          <div>{t('yourGuess')}: {result.guessYear}</div>
          <div>{t('yearsOff', { n: Math.abs(result.guessYear - card.year) })}</div>
          <div className="pts">{t('yearPoints', { n: result.yearScore })}</div>
        </div>
        <div>
          <div className="big">{l(card.place)}</div>
          <div>{t('kmOff', { n: Math.round(result.km) })}</div>
          <div className="pts">{t('placePoints', { n: result.placeScore })}</div>
        </div>
      </div>

      <RevealMap
        guess={result.guess}
        answer={{ lat: card.lat, lng: card.lng }}
        km={result.km}
        guessLabel={t('yourGuess')}
        answerLabel={l(card.place)}
      />

      <p className="explanation">{l(card.explanation)}</p>
      <h3>{t('clue')}</h3>
      <p>{l(card.clue)}</p>

      <h3>{t('sources')}</h3>
      <ul className="sources">
        {card.sources.map((s) => (
          <li key={s}>
            <a href={s} target="_blank" rel="noreferrer">
              {s}
            </a>
          </li>
        ))}
      </ul>
      <p className="credit">
        {t('imageBy')}: {credit.author} ·{' '}
        <a href={credit.source_url} target="_blank" rel="noreferrer">
          {credit.license}
        </a>
      </p>

      <div className="actions">
        <button type="button" className="primary" onClick={onNext}>
          {isLast ? t('toResults') : t('next')}
        </button>
      </div>
    </div>
  );
}
