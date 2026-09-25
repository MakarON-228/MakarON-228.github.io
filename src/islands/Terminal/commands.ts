// Команды терминала (SPEC.md §7.11): чистая логика без DOM. Весь вывод собирается из resume.ts —
// факты не переписываются руками, в ui.terminal лежат только подписи и сообщения.

import { education, entries, experience, hackathons, header, projects, sections, skills, ui, type Entry } from '../../data/resume';
import { parseRich } from '../../lib/rich';
import { isTheme, type Theme } from '../../lib/theme';

const t = ui.terminal;

/** Как рисовать кусочек: title — жирный, heading — заголовок секции, strong — выделенная цифра, как на странице. */
export type Kind = 'title' | 'heading' | 'strong' | 'em' | 'muted' | 'accent' | 'bullet' | 'error';

export interface Span {
  text: string;
  kind?: Kind;
  href?: string;
  /** Первый кусочек строки — колонка: перенесённый текст встаёт под её правый край, а не в начало строки. */
  hang?: boolean;
}

export type Line = readonly Span[];

export type Effect =
  | { kind: 'clear' }
  | { kind: 'close' }
  | { kind: 'navigate'; id: string }
  | { kind: 'download'; href: string }
  | { kind: 'theme'; theme: Theme };

export interface Result {
  lines: Line[];
  effect?: Effect;
}

export interface Context {
  theme: Theme;
}

export type Command = keyof typeof t.commands;

/** Команды из help, в его порядке. `sudo` — пасхалка, в списке его нет. */
export const COMMANDS = Object.keys(t.commands) as Command[];

export const SUDO_HIRE = 'hire makar';

type SectionId = (typeof sections)[number]['id'];

/** Секции с записями: в `ls` это папки. */
const groups: Partial<Record<SectionId, readonly Entry[]>> = {
  experience,
  hackathons: hackathons.items,
  projects,
};

/** Всё, что понимают `cat` и `open`, в порядке `ls`: секция, затем её записи. */
export const NAMES: readonly string[] = sections.flatMap((s) => [s.id, ...(groups[s.id] ?? []).map((e) => e.id)]);

function span(text: string, kind?: Kind, href?: string): Span {
  return { text, ...(kind ? { kind } : {}), ...(href ? { href } : {}) };
}

/** Строка из resume.ts с разметкой: **…** — выделенная цифра, *…* — название. */
function rich(source: string, base?: Kind): Span[] {
  return parseRich(source).map((s) => span(s.text, s.kind === 'text' ? base : s.kind));
}

const pad = (labels: readonly string[]) => Math.max(...labels.map((l) => l.length)) + 2;

const column = (text: string, width: number, kind?: Kind): Span => ({ ...span(text.padEnd(width), kind), hang: true });

const bullet = (spans: Span[]): Line => [column('–', 2, 'bullet'), ...spans];

const error = (message: string): Result => ({ lines: [[span(message, 'error')]] });

function entryLines(e: Entry): Line[] {
  const lines: Line[] = [[span(e.title, 'title'), ...(e.result ? [span(` — ${e.result}`, 'muted')] : [])]];
  const meta = [e.date, e.role, e.place, ...(e.stack ?? [])].filter((m): m is string => Boolean(m));
  lines.push([span(meta.join(' · '), 'muted')]);
  if (e.intro) lines.push(rich(e.intro, 'muted'));
  if (e.body) lines.push(rich(e.body));
  for (const b of e.bullets ?? []) lines.push(bullet(rich(b)));
  if (e.repo) lines.push([span(e.repo.label, undefined, e.repo.href)]);
  return lines;
}

function contactLines(): Line[] {
  const channels = [
    { label: ui.email, text: header.email, href: `mailto:${header.email}` },
    { label: ui.telegram, text: header.telegram.label, href: header.telegram.href },
    { label: ui.github, text: header.github.label, href: header.github.href },
  ];
  const w = pad(channels.map((c) => c.label));
  return channels.map((c) => [column(c.label, w, 'muted'), span(c.text, undefined, c.href)]);
}

function educationLines(): Line[] {
  return [
    [span(education.institution, 'title')],
    [span(education.date, 'muted')],
    [span(education.programme, 'title'), span(` — ${education.programmeNote}`)],
    ...education.bullets.map((b) => bullet(rich(b))),
  ];
}

function skillsLines(): Line[] {
  const w = pad(skills.map((s) => s.group));
  return skills.map((s) => [column(s.group, w, 'muted'), span(s.items.join(', '))]);
}

function sectionLines(id: SectionId, label: string): Line[] {
  const head: Line = [span(label, 'heading'), ...(id === 'hackathons' ? [span(`  ${hackathons.tally}`, 'accent')] : [])];
  const group = groups[id];
  if (group) return [head, ...group.flatMap((e) => [[], ...entryLines(e)])];
  const body = id === 'education' ? educationLines() : id === 'skills' ? skillsLines() : contactLines();
  return [head, [], ...body];
}

type Target = { id: string; title: string; lines: () => Line[] };

function resolve(name: string): Target | null {
  const id = name.toLowerCase().replace(/\/+$/, '');
  const section = sections.find((s) => s.id === id);
  if (section) return { id, title: section.label, lines: () => sectionLines(section.id, section.label) };
  const entry = entries.find((e) => e.id === id);
  return entry ? { id, title: entry.title, lines: () => entryLines(entry) } : null;
}

function help(): Line[] {
  const w = pad(COMMANDS.map((c) => t.commands[c].usage));
  return COMMANDS.map((c) => [column(t.commands[c].usage, w), span(t.commands[c].about, 'muted')]);
}

function whoami(): Line[] {
  return [
    [span(header.name, 'title')],
    [span(header.role, 'accent')],
    [span(header.summary)],
    [span([header.location, ...header.languages].join(' · '), 'muted')],
  ];
}

/** Как настоящий ls — только имена: с названиями записей дерево на телефоне расползается. */
function ls(): Line[] {
  return sections.flatMap((s): Line[] => {
    const group = groups[s.id];
    if (!group) return [[span(s.id)]];
    return [[span(`${s.id}/`, 'accent')], ...group.map((e) => [span(`  ${e.id}`)])];
  });
}

function cat(names: readonly string[]): Result {
  if (names.length === 0) return error(t.missing('cat', t.commands.cat.usage));
  const lines = names.flatMap((name, i): Line[] => {
    const target = resolve(name);
    const out = target ? target.lines() : [[span(t.noSuch('cat', name), 'error')]];
    return i === 0 ? out : [[], ...out];
  });
  return { lines };
}

function open(name: string | undefined): Result {
  if (!name) return error(t.missing('open', t.commands.open.usage));
  const target = resolve(name);
  if (!target) return error(t.noSuch('open', name));
  return { lines: [[span(t.opening(target.title))]], effect: { kind: 'navigate', id: target.id } };
}

function cv(): Result {
  const file = header.cv.split('/').at(-1) ?? header.cv;
  return {
    lines: [[span(`${t.downloading} `), span(file, undefined, header.cv)]],
    effect: { kind: 'download', href: header.cv },
  };
}

function theme(value: string | undefined, ctx: Context): Result {
  if (!value) return { lines: [[span(t.themeNow(ctx.theme, t.commands.theme.usage))]] };
  const next = value.toLowerCase();
  if (!isTheme(next)) return error(t.themeBad(value));
  return { lines: [[span(t.themeSet(next))]], effect: { kind: 'theme', theme: next } };
}

function sudo(args: readonly string[]): Result {
  if (args.join(' ').toLowerCase() !== SUDO_HIRE) return error(t.sudo.denied(t.user));
  return {
    lines: [
      [span(t.sudo.password(t.user), 'muted')],
      [span(t.sudo.granted, 'title')],
      ...contactLines(),
      [span(ui.downloadCv, undefined, header.cv)],
    ],
  };
}

export function tokenize(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean);
}

export function run(input: string, ctx: Context): Result {
  const [word, ...args] = tokenize(input);
  if (word === undefined) return { lines: [] };
  switch (word.toLowerCase()) {
    case 'help':
      return { lines: help() };
    case 'whoami':
      return { lines: whoami() };
    case 'ls':
      return { lines: ls() };
    case 'cat':
      return cat(args);
    case 'open':
      return open(args[0]);
    case 'cv':
      return cv();
    case 'contact':
      return { lines: contactLines() };
    case 'theme':
      return theme(args[0], ctx);
    case 'clear':
      return { lines: [], effect: { kind: 'clear' } };
    case 'exit':
      return { lines: [], effect: { kind: 'close' } };
    case 'sudo':
      return sudo(args);
    default:
      return error(t.notFound(word));
  }
}
