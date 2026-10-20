import { motion, useReducedMotion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { cn } from './cn';
import { KZ_OUTLINE, KZ_VIEWBOX } from './kz-outline';

const { width: VW, height: VH } = KZ_VIEWBOX;

const LINE_COUNT = 34;

type Flow = {
  d: string;
  wave: number;
  width: number;
  opacity: number;
  duration: number;
};

/**
 * One horizontal wave, drawn well past both edges so that shifting it by
 * exactly one wavelength lands on an identical frame — the loop never seams.
 */
function makeFlow(baseY: number, amp: number, wave: number, phase: number) {
  const from = -2 * wave;
  const to = VW + 2 * wave;
  const step = wave / 18;
  const points: string[] = [];
  for (let x = from; x <= to; x += step) {
    const y = baseY + amp * Math.sin((x / wave) * Math.PI * 2 + phase);
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return 'M' + points.join(' L');
}

function buildFlows(): Flow[] {
  return Array.from({ length: LINE_COUNT }, (_, i) => {
    const t = (i + 0.5) / LINE_COUNT;
    const baseY = VH * t;
    // waves bunch up towards the middle of the country, thin out at the edges
    const edge = Math.abs(t - 0.5) * 2;
    const amp = 5 + (1 - edge) * 16 + (i % 3) * 2;
    const wave = 240 + (i % 5) * 55;
    return {
      d: makeFlow(baseY, amp, wave, i * 0.72),
      wave,
      width: 0.55 + (i % 3) * 0.3,
      opacity: 0.22 + (1 - edge) * 0.5,
      duration: 16 + (i % 6) * 3.5,
    };
  });
}

function FlowLines({ flows }: { flows: Flow[] }) {
  const reduced = useReducedMotion();

  return (
    <g fill="none" strokeLinecap="round">
      {flows.map((flow, i) =>
        reduced ? (
          <path
            key={i}
            d={flow.d}
            stroke="currentColor"
            strokeWidth={flow.width}
            strokeOpacity={flow.opacity}
          />
        ) : (
          <motion.g
            key={i}
            initial={{ x: 0 }}
            animate={{ x: flow.wave }}
            transition={{
              duration: flow.duration,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'linear',
            }}
          >
            <path
              d={flow.d}
              stroke="currentColor"
              strokeWidth={flow.width}
              strokeOpacity={flow.opacity}
            />
          </motion.g>
        ),
      )}
    </g>
  );
}

/**
 * Kazakhstan's border is the boundary: the flowing lines live inside it, and
 * only their tails slip past the eastern edge and trail off to the right.
 */
export function FloatingBorders({ className }: { className?: string }) {
  const flows = useMemo(buildFlows, []);

  return (
    <div
      className={cn('pointer-events-none absolute inset-0', className)}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full text-primary"
        fill="none"
      >
        <defs>
          {/* the country itself, used as a container for the lines */}
          <clipPath id="kz-boundary">
            <path d={KZ_OUTLINE} />
          </clipPath>

          {/* lets the lines bleed out past the right-hand border only */}
          <linearGradient id="kz-escape" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="52%" stopColor="#fff" stopOpacity="0" />
            <stop offset="74%" stopColor="#fff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask
            id="kz-escape-mask"
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={VW}
            height={VH}
          >
            <rect x="0" y="0" width={VW} height={VH} fill="url(#kz-escape)" />
            {/* knock the country back out, so tails show only outside it */}
            <path d={KZ_OUTLINE} fill="#000" />
          </mask>
        </defs>

        {/* faint wash so the silhouette reads even before the eye finds the border */}
        <path d={KZ_OUTLINE} fill="currentColor" fillOpacity="0.035" />

        {/* the lines, held inside the border */}
        <g clipPath="url(#kz-boundary)" opacity="0.85">
          <FlowLines flows={flows} />
        </g>

        {/* tails escaping east */}
        <g mask="url(#kz-escape-mask)" opacity="0.3">
          <FlowLines flows={flows} />
        </g>

        {/* the boundary on top */}
        <path
          d={KZ_OUTLINE}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeOpacity="0.5"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

export function BackgroundPaths({
  title = 'Тарих Guessr',
  subtitle,
  stats,
  topRight,
  footer,
  children,
}: {
  title?: string;
  subtitle?: string;
  /** One line of proof that there is real content behind the buttons. */
  stats?: ReactNode;
  topRight?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const words = title.split(' ');

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background">
      <FloatingBorders />

      {/* keeps the centre readable over the lines */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--background)_14%,transparent_70%)]" />

      {topRight ? (
        <div className="absolute right-3 top-3 z-20 sm:right-5 sm:top-5">
          {topRight}
        </div>
      ) : null}

      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 text-center md:px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 1.4 }}
        >
          <h1 className="mb-6 text-balance font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl">
            {words.map((word, wordIndex) => (
              <span key={wordIndex} className="mr-4 inline-block last:mr-0">
                {word.split('').map((letter, letterIndex) => (
                  <motion.span
                    key={`${wordIndex}-${letterIndex}`}
                    initial={
                      reduced ? { y: 0, opacity: 1 } : { y: 90, opacity: 0 }
                    }
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: reduced
                        ? 0
                        : wordIndex * 0.1 + letterIndex * 0.035,
                      type: 'spring',
                      stiffness: 150,
                      damping: 25,
                    }}
                    className="inline-block bg-gradient-to-b from-foreground to-primary bg-clip-text text-transparent"
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
            ))}
          </h1>

          {subtitle ? (
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : 0.6, duration: 0.7 }}
              className="mx-auto mb-10 max-w-xl text-balance text-base text-muted-foreground sm:text-lg"
            >
              {subtitle}
            </motion.p>
          ) : null}

          {stats ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduced ? 0 : 0.72, duration: 0.7 }}
              className="mb-9 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
            >
              {stats}
            </motion.div>
          ) : null}

          {children ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : 0.85, duration: 0.7 }}
              className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              {children}
            </motion.div>
          ) : null}
        </motion.div>
      </div>

      {footer ? (
        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-5 sm:pb-7">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
