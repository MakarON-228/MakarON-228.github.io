// Цвета карты — только из токенов tokens.css (CLAUDE.md): при смене темы перечитываются.

export const roadToken = (groupId: string) => `--road-${groupId}`;

export interface MapColors {
  water: string;
  land: string;
  ink: string;
  muted: string;
  /** По индексу группы в `railways.json`. */
  groups: string[];
}

export function readColors(el: Element, groupIds: readonly string[]): MapColors {
  const css = getComputedStyle(el);
  const get = (name: string) => css.getPropertyValue(name).trim();
  return {
    water: get('--map-water'),
    land: get('--map-land'),
    ink: get('--ink'),
    muted: get('--muted'),
    groups: groupIds.map((id) => get(roadToken(id))),
  };
}

/** Вызывает `cb` при смене темы: переключатель (`data-theme` на html) или системная настройка. */
export function onThemeChange(cb: () => void): () => void {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  media.addEventListener('change', cb);
  return () => {
    observer.disconnect();
    media.removeEventListener('change', cb);
  };
}
