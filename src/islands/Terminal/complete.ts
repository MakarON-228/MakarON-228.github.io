// Автодополнение по Tab (SPEC.md §7.11): дополняется последнее слово строки.

import { COMMANDS, NAMES, SUDO_HIRE } from './commands';

export interface Completion {
  /** Новая строка ввода: единственный вариант с пробелом или общий префикс нескольких. */
  value: string;
  /** Все подходящие варианты. */
  options: readonly string[];
}

const THEMES = ['light', 'dark'] as const;

/** Варианты для следующего слова после уже набранных. */
function candidates(words: readonly string[]): readonly string[] {
  const [cmd, ...args] = words;
  switch (cmd) {
    case undefined:
      return COMMANDS;
    case 'cat':
      return NAMES;
    case 'open':
      return args.length === 0 ? NAMES : [];
    case 'theme':
      return args.length === 0 ? THEMES : [];
    case 'sudo': {
      const hire = SUDO_HIRE.split(' ');
      const next = hire[args.length];
      return next !== undefined && args.every((a, i) => a === hire[i]) ? [next] : [];
    }
    default:
      return [];
  }
}

function commonPrefix(words: readonly string[]): string {
  let prefix = words[0] ?? '';
  for (const w of words) while (!w.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix;
}

export function complete(input: string): Completion {
  const start = input.search(/\S*$/);
  const before = input.slice(0, start);
  const word = input.slice(start).toLowerCase();
  const done = before.trim() === '' ? [] : before.trim().toLowerCase().split(/\s+/);
  const options = candidates(done).filter((c) => c.startsWith(word));
  if (options.length === 0) return { value: input, options };
  if (options.length === 1) return { value: `${before}${options[0]} `, options };
  const prefix = commonPrefix(options);
  return { value: prefix.length > word.length ? before + prefix : input, options };
}
