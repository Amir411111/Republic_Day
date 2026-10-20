import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { L10n, Lang } from '../game/types';
import { STRINGS, type StringKey } from './strings';

export const LANGS: Lang[] = ['kk', 'ru', 'en'];
const STORAGE_KEY = 'tg_lang';

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  // Picks the current language from a card field, falling back to ru, then kk
  l: (text: L10n) => string;
}

const I18nContext = createContext<I18n | null>(null);

function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'kk' || saved === 'ru' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  return 'kk';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable */
    }
  };

  const t: I18n['t'] = (key, vars) => {
    let s = STRINGS[key][lang];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };

  const l: I18n['l'] = (text) => text[lang] || text.ru || text.kk;

  return <I18nContext.Provider value={{ lang, setLang, t, l }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}
