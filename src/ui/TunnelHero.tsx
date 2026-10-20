import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import type { L10n, Lang } from '../game/types';

export type TunnelImage = {
  src: string;
  title: L10n;
};

type StageDimensions = { width: number; height: number; isMobile: boolean };

type TunnelCardData = {
  item: TunnelImage;
  angleCos: number;
  angleSin: number;
  radiusFactorX: number;
  radiusFactorY: number;
  rotationZ: number;
  index: number;
};

const SPRING = { stiffness: 60, damping: 25, mass: 0.5 };

function layout(images: TunnelImage[]): TunnelCardData[] {
  return images.map((item, i) => {
    // golden angle keeps the cards from ever lining up into rows
    const angle = i * 137.5 * (Math.PI / 180);
    return {
      item,
      angleCos: Math.cos(angle),
      angleSin: Math.sin(angle),
      radiusFactorX: 0.28 + (i % 3) * 0.08,
      radiusFactorY: 0.26 + (i % 2) * 0.09,
      rotationZ: (i % 2 === 0 ? 1 : -1) * (3 + (i % 5) * 2),
      index: i,
    };
  });
}

function useCameraParallax(enabled: boolean) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, SPRING);
  const y = useSpring(rawY, SPRING);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (event: PointerEvent) => {
      rawX.set((event.clientX / window.innerWidth - 0.5) * 2);
      rawY.set((event.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [enabled, rawX, rawY]);

  return { x, y };
}

function TunnelCard({
  card,
  progress,
  pointer,
  total,
  stage,
  lang,
}: {
  card: TunnelCardData;
  progress: MotionValue<number>;
  pointer: { x: MotionValue<number>; y: MotionValue<number> };
  total: number;
  stage: StageDimensions;
  lang: Lang;
}) {
  const staggerSpan = 0.55;
  /*
    The flight starts part-way in. Without this lead the whole sequence begins
    at opacity 0, and the first thing anyone sees when the site opens is an
    empty grid — the page has to be complete before a single scroll.
  */
  const lead = 0.18;
  const start = (card.index / total) * (1 - staggerSpan) - lead;
  const local = useTransform(progress, [start, start + staggerSpan], [0, 1]);

  const z = useTransform(
    local,
    [0, 1],
    [stage.isMobile ? -1200 : -1700, stage.isMobile ? 350 : 500],
  );
  const opacity = useTransform(local, [0, 0.18, 0.82, 0.98], [0, 1, 1, 0]);

  const cardWidth = stage.isMobile
    ? Math.max(130, Math.min(180, stage.width * 0.38))
    : Math.max(180, Math.min(270, stage.width * 0.18));

  const baseX = card.angleCos * (stage.width * card.radiusFactorX);
  const baseY = card.angleSin * (stage.height * card.radiusFactorY);
  const pan = stage.isMobile ? 20 : 45;

  const transform = useTransform(
    [z, pointer.x, pointer.y],
    ([currZ, px, py]: number[]) =>
      `translate3d(calc(-50% + ${baseX - px * pan}px), calc(-50% + ${
        baseY - py * pan
      }px), ${currZ}px) rotateZ(${card.rotationZ}deg)`,
  );

  return (
    <motion.div
      style={{ width: cardWidth, transform, opacity, zIndex: card.index + 1 }}
      className="absolute left-1/2 top-1/2 aspect-[4/5] select-none will-change-transform"
    >
      <div className="relative h-full w-full overflow-hidden rounded-2xl bg-card shadow-2xl shadow-black/80 ring-1 ring-white/12">
        <img
          src={card.item.src}
          alt=""
          draggable={false}
          loading={card.index < 3 ? 'eager' : 'lazy'}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/10 to-transparent p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/95 drop-shadow-md sm:text-xs">
            {card.item.title[lang]}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function PerspectiveTunnelHero({
  images,
  lang,
  eyebrow,
  title,
  subtitle,
  prompt,
  topRight,
  scrollRef,
}: {
  images: TunnelImage[];
  lang: Lang;
  eyebrow: string;
  title: string;
  subtitle: string;
  prompt: string;
  topRight?: ReactNode;
  /** The page's scroll container — the page scrolls inside a div, not the window. */
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const cards = useRef(layout(images)).current;

  const [stage, setStage] = useState<StageDimensions>({
    width: 1440,
    height: 900,
    isMobile: false,
  });

  useEffect(() => {
    const update = () =>
      setStage({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 768,
      });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  /*
    Progress comes from the page's own scroll position, not from a hijacked
    wheel event. The original component called preventDefault on every wheel
    tick, which traps the reader inside the section: on a touch device there is
    no wheel at all, and on a desktop the page cannot be left until the tunnel
    is finished. Tying it to a tall sticky section keeps the keyboard, the
    scrollbar and touch all working.
  */
  const { scrollYProgress } = useScroll({
    container: scrollRef as RefObject<HTMLElement>,
    target: wrapRef,
    offset: ['start start', 'end end'],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 30,
    restDelta: 0.0001,
  });

  const pointer = useCameraParallax(!reduce);

  const titleScale = useTransform(progress, [0, 0.5, 1], [0.92, 1, 1.26]);
  // readable from the very first frame, fading only as the tunnel ends
  const titleOpacity = useTransform(progress, [0, 0.8, 1], [1, 1, 0]);
  const promptOpacity = useTransform(progress, [0, 0.12], [1, 0]);

  return (
    <section ref={wrapRef} className="relative h-[260vh] w-full">
      <div
        className="sticky top-0 flex h-[100svh] w-full items-center justify-center overflow-hidden bg-background"
        style={{
          perspective: stage.isMobile ? '900px' : '1200px',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* depth cues */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_60%,transparent_100%)] opacity-60" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(216,175,79,0.14)_0%,transparent_72%)]" />
        <div className="pointer-events-none absolute h-[48vmin] w-[48vmin] rounded-full border border-primary/15" />
        <div className="pointer-events-none absolute h-[76vmin] w-[76vmin] rounded-full border border-dashed border-white/10" />

        {topRight ? (
          <div className="absolute right-3 top-3 z-30 sm:right-5 sm:top-5">
            {topRight}
          </div>
        ) : null}

        <motion.div
          style={{ scale: titleScale, opacity: titleOpacity }}
          className="pointer-events-none z-0 flex max-w-xl flex-col items-center px-6 text-center"
        >
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.34em] text-primary">
            {eyebrow}
          </p>
          <h1 className="font-display whitespace-pre-line bg-gradient-to-b from-foreground via-foreground to-foreground/40 bg-clip-text text-4xl font-bold leading-[0.95] tracking-tighter text-transparent sm:text-6xl md:text-7xl">
            {title}
          </h1>
          <p className="mt-4 max-w-[36ch] text-pretty text-sm font-light text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        </motion.div>

        <motion.div
          style={{ opacity: promptOpacity }}
          className="pointer-events-none absolute bottom-8 z-20 flex flex-col items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground"
        >
          <span>{prompt}</span>
          <div className="h-6 w-px bg-gradient-to-b from-primary to-transparent" />
        </motion.div>

        <div
          className="pointer-events-none absolute inset-0"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {cards.map((card) => (
            <TunnelCard
              key={card.item.src}
              card={card}
              progress={progress}
              pointer={pointer}
              total={cards.length}
              stage={stage}
              lang={lang}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

