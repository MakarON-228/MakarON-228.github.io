export type Theme = 'light' | 'dark';

export const THEME_KEY = 'theme';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Сохранённый выбор важнее системной настройки. */
export function resolveTheme(stored: unknown, systemDark: boolean): Theme {
  if (isTheme(stored)) return stored;
  return systemDark ? 'dark' : 'light';
}

export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

export function readStored(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): Theme | null {
  try {
    const value = storage?.getItem(THEME_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStored(theme: Theme, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(THEME_KEY, theme);
  } catch {
    // без localStorage тема просто не запоминается
  }
}

/** Событие на document после смены темы: кнопка темы и терминал меняют её независимо. */
export const THEME_EVENT = 'themechange';

/** Тема, которая сейчас на странице. */
export function currentTheme(): Theme {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return resolveTheme(readStored() ?? document.documentElement.dataset['theme'], systemDark);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme;
  writeStored(theme);
  document.dispatchEvent(new CustomEvent(THEME_EVENT));
}
