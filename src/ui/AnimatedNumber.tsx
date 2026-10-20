import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

// Counts up to its value instead of snapping to it
export function AnimatedNumber({ value, duration = 0.9, delay = 0, prefix = '' }: {
  value: number;
  duration?: number;
  delay?: number;
  prefix?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    setShown(0);
    const controls = animate(0, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, duration, delay, reduce]);

  return (
    <span className="tabular-nums">
      {prefix}
      {shown}
    </span>
  );
}
