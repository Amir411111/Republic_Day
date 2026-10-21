import { useSyncExternalStore } from 'react';

// "Comfortable view" settings for older players and anyone who needs them. They live on <html>
// as data attributes, so plain CSS (app.css) does the work and every screen follows at once.
export interface Comfort {
  bigText: boolean;
  contrast: boolean;
  // fewer animations; starts from the system "reduce motion" setting
  calm: boolean;
}

const KEY = 'tg_comfort';
const ATTR: Record<keyof Comfort, string> = { bigText: 'data-big-text', contrast: 'data-contrast', calm: 'data-calm' };

function load(): Comfort {
  const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const base: Comfort = { bigText: false, contrast: false, calm: !!calm };
  try {
    return { ...base, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Comfort>) };
  } catch {
    return base;
  }
}

let state = load();
const listeners = new Set<() => void>();

function apply() {
  const root = document.documentElement;
  for (const k of Object.keys(ATTR) as (keyof Comfort)[]) root.toggleAttribute(ATTR[k], state[k]);
}
apply();

export function setComfort(patch: Partial<Comfort>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: the setting lasts until reload */
  }
  apply();
  listeners.forEach((l) => l());
}

export function useComfort(): Comfort {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
