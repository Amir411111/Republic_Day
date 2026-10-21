import { useSyncExternalStore } from 'react';

// The site tour: opens on the first visit (main.tsx) and again from the comfort panel
const KEY = 'tg_intro_seen';

let open = false;
let after: (() => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function introSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // no storage: do not show it before every game
  }
}

// Shows the intro; `then` runs once it is closed (e.g. the game the player chose)
export function openIntro(then?: () => void) {
  open = true;
  after = then ?? null;
  emit();
}

export function closeIntro() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* storage unavailable */
  }
  open = false;
  const run = after;
  after = null;
  emit();
  run?.();
}

export function useIntroOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
  );
}
