import { Database, Images, ScrollText } from 'lucide-react';
import { useMemo, useState } from 'react';
import quest from '../../content/quest-semey.json';
import tunnel from '../../content/tunnel.json';
import { EVENTS } from '../atlas/events';
import { ALL_CARDS, DEV_MODE, isVerified } from '../game/cards';
import type { L10n } from '../game/types';
import { useI18n } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { Button } from '../ui/Button';
import { TopBar } from '../ui/TopBar';
import { SOURCES } from './Landing';

// Every source the game relies on, in one place: the links behind each fact, the author and
// licence of each picture, and the data behind the maps. Built from the content files.

interface Credit {
  author: string;
  license: string;
  source_url: string;
}
interface Used {
  title: L10n;
  sources?: string[];
  image_credit?: Credit;
}
interface QuestStop {
  title: L10n;
  sources: string[];
  image?: { author: string; license: string; source_url: string };
}

const CARDS = ALL_CARDS.filter((c) => DEV_MODE || isVerified(c));
const STOPS = quest as QuestStop[];
const ENTRIES: Used[] = [
  ...CARDS,
  ...EVENTS,
  ...STOPS.map((s) => ({ title: s.title, sources: s.sources, image_credit: s.image })),
  ...(tunnel as Used[]),
];

// fact links grouped by site, the busiest site first
function factGroups() {
  const byUrl = new Map<string, L10n[]>();
  for (const e of ENTRIES) for (const u of e.sources ?? []) byUrl.set(u, [...(byUrl.get(u) ?? []), e.title]);
  const bySite = new Map<string, { url: string; used: L10n[] }[]>();
  for (const [url, used] of byUrl) {
    let site = url;
    try {
      site = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      /* keep the raw string */
    }
    bySite.set(site, [...(bySite.get(site) ?? []), { url, used }]);
  }
  return [...bySite.entries()].sort((a, b) => b[1].length - a[1].length);
}

function photos() {
  const seen = new Set<string>();
  return ENTRIES.filter((e) => {
    const url = e.image_credit?.source_url;
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

// "https://ru.wikipedia.org/wiki/Абылай-хан" -> "Абылай-хан"
function linkText(url: string): string {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '').replace(/_/g, ' ');
    return last.replace(/^File:/, '') || u.hostname;
  } catch {
    return url;
  }
}

type Tab = 'facts' | 'photos' | 'data';
const TABS: { key: Tab; icon: typeof Database; label: StringKey }[] = [
  { key: 'facts', icon: ScrollText, label: 'srcTabFacts' },
  { key: 'photos', icon: Images, label: 'srcTabPhotos' },
  { key: 'data', icon: Database, label: 'srcTabData' },
];

export default function SourcesPage({ onBack }: { onBack: () => void }) {
  const { t, l } = useI18n();
  const [tab, setTab] = useState<Tab>('facts');
  const groups = useMemo(factGroups, []);
  const pics = useMemo(photos, []);
  const factCount = groups.reduce((n, [, links]) => n + links.length, 0);
  const counts: Record<Tab, number> = { facts: factCount, photos: pics.length, data: SOURCES.length };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <TopBar onBack={onBack} className="sticky top-0 z-20 bg-background" />
      <div className="mx-auto max-w-3xl px-4 pb-12">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('sourcesTitle')}</h1>
        <p className="mt-2 text-pretty text-muted-foreground">{t('srcPageLead')}</p>

        <div className="mt-5 flex flex-wrap gap-2" role="tablist">
          {TABS.map(({ key, icon: Icon, label }) => (
            <Button
              key={key}
              role="tab"
              aria-selected={tab === key}
              variant="chip"
              on={tab === key}
              onClick={() => setTab(key)}
            >
              <Icon aria-hidden="true" className="size-4" /> {t(label)} · {counts[key]}
            </Button>
          ))}
        </div>

        {tab === 'facts' && (
          <div className="mt-6 flex flex-col gap-3">
            {groups.map(([site, links]) => (
              <details key={site} className="rounded-2xl border border-border/80 bg-card/60 open:bg-card">
                <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-5 font-semibold">
                  {site}
                  <span className="text-sm font-normal text-muted-foreground tabular-nums">{links.length}</span>
                </summary>
                <ul className="flex flex-col gap-3 px-5 pb-5">
                  {links.map(({ url, used }) => (
                    <li key={url} className="text-sm">
                      <a href={url} target="_blank" rel="noreferrer" className="break-words">
                        {linkText(url)}
                      </a>
                      <span className="block text-xs text-muted-foreground">
                        {t('srcUsedIn')}: {used.map((u) => l(u)).join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}

        {tab === 'photos' && (
          <ul className="mt-6 flex flex-col divide-y divide-border rounded-2xl border border-border/80 bg-card/60 px-5">
            {pics.map((p) => (
              <li key={p.image_credit!.source_url} className="py-3 text-sm">
                <span className="font-semibold">{l(p.title)}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.image_credit!.author} ·{' '}
                  <a href={p.image_credit!.source_url} target="_blank" rel="noreferrer">
                    {p.image_credit!.license}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}

        {tab === 'data' && (
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border/80 bg-card/60 p-5">
                <dt className="flex flex-wrap items-baseline gap-x-2">
                  <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold">
                    {s.name}
                  </a>
                  <span className="text-[11px] tracking-[0.1em] text-primary/80 uppercase">{s.license}</span>
                </dt>
                <dd className="mt-1 text-sm text-pretty text-muted-foreground">{t(s.what)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
