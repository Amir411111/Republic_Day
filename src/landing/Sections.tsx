import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { PERIODS, formatRange } from '../atlas/periods';
import { useI18n } from '../i18n';
import type { StringKey } from '../i18n/strings';
import { cn } from '../ui/cn';

export interface TextItem {
  id: string;
  icon: LucideIcon;
  title: StringKey;
  text: StringKey;
}

export interface SourceItem {
  id: string;
  name: string;
  license: string;
  what: StringKey;
  url: string;
}

// Sections slide in from a visible resting state, never from opacity 0,
// so the page is complete on load and with reduced motion
export function useReveal() {
  const reduced = useReducedMotion();
  return (delay = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration: 0.5, delay },
        };
}

export function SectionShell({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('w-full border-t border-border/70', className)}>
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">{children}</div>
    </section>
  );
}

export function SectionHead({ title, lead }: { title: StringKey; lead?: StringKey }) {
  const { t } = useI18n();
  const reveal = useReveal();
  return (
    <motion.header {...reveal()} className="mb-10">
      <h2 className="font-display text-2xl font-bold tracking-tight text-balance sm:text-4xl">{t(title)}</h2>
      {lead && <p className="mt-3 max-w-2xl text-sm text-pretty text-muted-foreground sm:text-base">{t(lead)}</p>}
    </motion.header>
  );
}

// `tour` marks the step cards for the site tour (src/ui/IntroDialog.tsx)
export function HowItWorks({ steps, tour }: { steps: TextItem[]; tour?: string }) {
  const { t } = useI18n();
  const reveal = useReveal();
  return (
    <SectionShell className="bg-card/30">
      <SectionHead title="howTitle" lead="howLead" />
      <ol data-tour={tour} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.li
              key={step.id}
              {...reveal(i * 0.06)}
              className="flex min-w-0 flex-col rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-sm"
            >
              <div className="mb-3 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-sm font-bold text-primary tabular-nums ring-1 ring-primary/25"
                >
                  {i + 1}
                </span>
                <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
              </div>
              <h3 className="text-base leading-snug font-semibold text-pretty">{t(step.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">{t(step.text)}</p>
            </motion.li>
          );
        })}
      </ol>
    </SectionShell>
  );
}

export function Eras() {
  const { t, lang } = useI18n();
  const reveal = useReveal();
  return (
    <SectionShell className="bg-card/30">
      <SectionHead title="erasTitle" lead="erasLead" />
      <ol className="grid gap-4 sm:grid-cols-2">
        {PERIODS.map((p, i) => (
          <motion.li
            key={p.id}
            {...reveal(i * 0.04)}
            className="flex min-w-0 gap-4 overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-4"
          >
            <span aria-hidden="true" className="w-1 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <h3 className="leading-tight font-semibold text-pretty">{p.name[lang]}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">{formatRange(p, lang)}</span>
              </div>
              <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
                {p.territory[lang]}
                {p.territory_approx && <span className="opacity-70"> · {t('approxOutline')}</span>}
              </p>
            </div>
          </motion.li>
        ))}
      </ol>
    </SectionShell>
  );
}

export function Honesty({ points }: { points: TextItem[] }) {
  const { t } = useI18n();
  const reveal = useReveal();
  return (
    <SectionShell>
      <motion.div {...reveal()} className="rounded-2xl border border-good/40 bg-good/8 p-5 sm:p-7">
        <h2 className="font-display text-xl font-bold tracking-tight text-balance text-good sm:text-3xl">
          {t('honestyTitle')}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-pretty text-foreground/90 sm:text-base">
          {t('honestyStatement')}
        </p>
      </motion.div>
      <ul className="mt-6 grid gap-5 sm:grid-cols-3">
        {points.map((point, i) => {
          const Icon = point.icon;
          return (
            <motion.li
              key={point.id}
              {...reveal(i * 0.08)}
              className="flex min-w-0 flex-col rounded-2xl border border-border/80 bg-card/60 p-5"
            >
              <Icon aria-hidden="true" className="mb-3 size-5 shrink-0 text-good" />
              <h3 className="text-base leading-snug font-semibold text-pretty">{t(point.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">{t(point.text)}</p>
            </motion.li>
          );
        })}
      </ul>
    </SectionShell>
  );
}

export function Sources({ sources, children }: { sources: SourceItem[]; children?: ReactNode }) {
  const { t } = useI18n();
  const reveal = useReveal();
  return (
    <SectionShell>
      <SectionHead title="sourcesTitle" />
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {sources.map((s, i) => (
          <motion.div key={s.id} {...reveal(i * 0.04)} className="min-w-0">
            <dt className="flex flex-wrap items-baseline gap-x-2">
              <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-foreground underline-offset-4 hover:underline">
                {s.name}
              </a>
              <span className="text-[11px] tracking-[0.1em] text-primary/80 uppercase">{s.license}</span>
            </dt>
            <dd className="mt-1 text-sm text-pretty text-muted-foreground">{t(s.what)}</dd>
          </motion.div>
        ))}
      </dl>
      {children}
    </SectionShell>
  );
}
