// AI history guide: POST /api/guide { question, lang, focus?, history? } -> { answer }
// Answers are grounded in content/events.json and content/cards.json.
// Needs ANTHROPIC_API_KEY in the Vercel project environment (never in the client).
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Lang = 'kk' | 'ru' | 'en';
type L10n = Record<Lang, string>;

interface Entry {
  key: string;
  year: number;
  year_end?: number;
  place: L10n;
  title: L10n;
  text: L10n;
}

interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

const MODEL = 'claude-opus-5-5';
const MAX_QUESTION = 500;
const MAX_HISTORY = 6;
const LANG_NAME: Record<Lang, string> = { kk: 'Kazakh', ru: 'Russian', en: 'English' };

function loadEntries(): Entry[] {
  const dir = join(process.cwd(), 'content');
  const events = JSON.parse(readFileSync(join(dir, 'events.json'), 'utf8')) as (Entry & { id: string })[];
  const cards = JSON.parse(readFileSync(join(dir, 'cards.json'), 'utf8')) as {
    id: string;
    year: number;
    place: L10n;
    title: L10n;
    explanation: L10n;
    verified_by: string;
  }[];
  return [
    ...events.map((e) => ({ ...e, key: `e:${e.id}` })),
    ...cards
      .filter((c) => c.verified_by.trim())
      .map((c) => ({ key: `p:${c.id}`, year: c.year, place: c.place, title: c.title, text: c.explanation })),
  ].sort((a, b) => a.year - b.year);
}

let ENTRIES: Entry[] | null = null;
const CONTEXT = new Map<Lang, string>();

// Built once per language and kept byte-identical so the system prompt stays cached
function knowledge(lang: Lang): string {
  if (!CONTEXT.has(lang)) {
    ENTRIES ??= loadEntries();
    const lines = ENTRIES.map((e) => {
      const years = e.year_end ? `${e.year}-${e.year_end}` : String(e.year);
      return `[${e.key}] ${years} | ${e.place[lang] || e.place.ru} | ${e.title[lang] || e.title.ru} | ${e.text[lang] || e.text.ru}`;
    });
    CONTEXT.set(lang, lines.join('\n'));
  }
  return CONTEXT.get(lang)!;
}

function systemPrompt(lang: Lang): string {
  return `You are the guide of "Tarih Guessr", a game about the history of Kazakhstan from the Kazakh Khanate to independence. Players range from schoolchildren to elderly people.

Answer in ${LANG_NAME[lang]}, in plain words, in 2-5 short sentences. If the player asks for more detail, you may write more.

Base your answers on the knowledge base below. Each line is [id] years | place | title | description. If the knowledge base does not cover the question, you may answer from well-established historical knowledge, but say clearly that this is not from the game's sources. If historians disagree on a date or place, say so instead of picking one. Never invent dates, names, numbers or quotes; if you are not sure, say you are not sure.

Stay on the history and culture of Kazakhstan and Central Asia. For anything unrelated, briefly say what you can help with.

<knowledge_base>
${knowledge(lang)}
</knowledge_base>`;
}

function isLang(v: unknown): v is Lang {
  return v === 'kk' || v === 'ru' || v === 'en';
}

interface Req {
  method?: string;
  body?: unknown;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

const client = new Anthropic();

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'not_configured' });

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown> | undefined;
  const question = typeof body?.question === 'string' ? body.question.trim().slice(0, MAX_QUESTION) : '';
  const lang: Lang = isLang(body?.lang) ? body.lang : 'kk';
  if (!question) return res.status(400).json({ error: 'empty_question' });

  const history = (Array.isArray(body?.history) ? (body.history as Turn[]) : [])
    .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string')
    .slice(-MAX_HISTORY);
  const focus = typeof body?.focus === 'string' ? body.focus.slice(0, 120) : '';
  const prompt = focus ? `(The player is looking at the entry [${focus}].)\n\n${question}` : question;

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.text.slice(0, 2000) })),
    { role: 'user', content: prompt },
  ];
  // History must start with the player
  while (messages.length && messages[0].role !== 'user') messages.shift();

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: systemPrompt(lang), cache_control: { type: 'ephemeral' } }],
      messages,
    });

    if (response.stop_reason === 'refusal') return res.status(200).json({ answer: '', refused: true });
    const answer = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return res.status(200).json({ answer });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'rate_limited' });
    if (error instanceof Anthropic.APIError) {
      console.error('guide: API error', error.status, error.message);
      return res.status(502).json({ error: 'upstream' });
    }
    console.error('guide: unexpected error', error);
    return res.status(500).json({ error: 'internal' });
  }
}
