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
