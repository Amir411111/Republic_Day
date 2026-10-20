import { useRef, useState } from 'react';
import { EVENTS, yearLabel } from '../atlas/events';
import { ALL_CARDS, isVerified } from '../game/cards';
import type { L10n, Lang } from '../game/types';
import { useI18n } from '../i18n';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  offline?: boolean;
}

interface Entry {
  key: string;
  year: number;
  year_end?: number;
  title: L10n;
  place: L10n;
  text: L10n;
}

const ENTRIES: Entry[] = [
  ...EVENTS.map((e) => ({ key: `e:${e.id}`, year: e.year, year_end: e.year_end, title: e.title, place: e.place, text: e.text })),
  ...ALL_CARDS.filter(isVerified).map((c) => ({ key: `p:${c.id}`, year: c.year, title: c.title, place: c.place, text: c.explanation })),
];

// Crude stemming: Kazakh and Russian words share a stem in their first 5 letters often enough for keyword search
const stems = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4 || /^\d{4}$/.test(w))
    .map((w) => w.slice(0, 5));

// Used when the AI guide is not reachable (no API key, offline, local dev)
export function searchEntries(question: string, lang: Lang, focus?: string): Entry[] {
  const q = new Set(stems(question));
  const scored = ENTRIES.map((e) => {
    const title = new Set(stems(`${e.title[lang]} ${e.place[lang]}`));
    const body = new Set(stems(e.text[lang]));
    let score = e.key === focus ? 3 : 0;
    for (const w of q) score += (title.has(w) ? 3 : 0) + (body.has(w) ? 1 : 0);
    return { e, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((s) => s.e);
}

interface Props {
  // Key of the map entry the player is looking at (e.g. "e:abylai-khan-1771")
  focus?: string;
  compact?: boolean;
}

export default function Guide({ focus, compact }: Props) {
  const { t, lang } = useI18n();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const offlineAnswer = (q: string): string => {
    const found = searchEntries(q, lang, focus);
    if (!found.length) return t('guideNothingFound');
    return found.map((e) => `${yearLabel(e)} · ${e.title[lang]} (${e.place[lang]}). ${e.text[lang]}`).join('\n\n');
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const history = turns.filter((x) => !x.offline).map(({ role, text }) => ({ role, text }));
    setTurns((prev) => [...prev, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    let reply: Turn;
    try {
      const r = await fetch('/api/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, lang, focus, history }),
      });
      const data = (await r.json().catch(() => ({}))) as { answer?: string; refused?: boolean };
      if (r.ok && data.answer) reply = { role: 'assistant', text: data.answer };
      else if (r.ok && data.refused) reply = { role: 'assistant', text: t('guideRefused') };
      else reply = { role: 'assistant', text: offlineAnswer(q), offline: true };
    } catch {
      reply = { role: 'assistant', text: offlineAnswer(q), offline: true };
    }
    setTurns((prev) => [...prev, reply]);
    setBusy(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  };

  const examples = focus ? [t('guideAskMore')] : [t('guideEx1'), t('guideEx2'), t('guideEx3')];

  return (
    <section className={compact ? 'guide compact' : 'guide'}>
      {!compact && <p className="lead">{t('guideLead')}</p>}
      <div className="chat" aria-live="polite">
        {turns.map((x, i) => (
          <div key={i} className={`bubble ${x.role}`}>
            {x.offline && <div className="offline-note">{t('guideOffline')}</div>}
            {x.text.split('\n').map((line, j) => (
              <p key={j}>{line}</p>
            ))}
          </div>
        ))}
        {busy && <div className="bubble assistant">…</div>}
        <div ref={endRef} />
      </div>
      {turns.length === 0 && (
        <div className="examples">
          {examples.map((ex) => (
            <button key={ex} type="button" className="secondary" onClick={() => ask(ex)}>
              {ex}
            </button>
          ))}
        </div>
      )}
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('guidePlaceholder')}
          maxLength={500}
          aria-label={t('guidePlaceholder')}
        />
        <button type="submit" className="primary" disabled={busy || !input.trim()}>
          {t('guideSend')}
        </button>
      </form>
    </section>
  );
}
