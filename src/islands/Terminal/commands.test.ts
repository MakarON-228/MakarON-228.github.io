import { describe, expect, it } from 'vitest';
import { education, entries, hackathons, header, sections, skills, ui } from '../../data/resume';
import { plainText } from '../../lib/rich';
import { COMMANDS, NAMES, SUDO_HIRE, run, tokenize, type Line, type Result } from './commands';
import doc from './COMMANDS.md?raw';

const ctx = { theme: 'light' as const };
const text = (lines: readonly Line[]) => lines.map((l) => l.map((s) => s.text).join('')).join('\n');
const out = (input: string) => text(run(input, ctx).lines);
const links = (r: Result) => r.lines.flatMap((l) => l.flatMap((s) => (s.href ? [s.href] : [])));
const isError = (r: Result) => r.lines.length === 1 && r.lines[0]?.[0]?.kind === 'error';

describe('tokenize', () => {
  it('splits on any whitespace and drops the edges', () => {
    expect(tokenize('  cat   projects\tskills ')).toEqual(['cat', 'projects', 'skills']);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('run', () => {
  it('does nothing on an empty line', () => {
    expect(run('   ', ctx)).toEqual({ lines: [] });
  });

  it('lists every command in help, without the sudo easter egg and without play', () => {
    const help = out('help');
    for (const c of COMMANDS) expect(help).toContain(ui.terminal.commands[c].usage);
    expect(help).not.toMatch(/sudo|play/);
  });

  it('ignores the case of commands and names', () => {
    expect(out('HELP')).toBe(out('help'));
    expect(out('Cat Skills')).toBe(out('cat skills'));
  });

  it('answers whoami from the header', () => {
    const who = out('whoami');
    for (const part of [header.name, header.role, header.summary, header.location, ...header.languages]) {
      expect(who).toContain(part);
    }
  });

  it('shows every section and entry in ls', () => {
    const tree = out('ls');
    for (const s of sections) expect(tree).toContain(s.id);
    for (const e of entries) expect(tree).toContain(e.id);
    expect(NAMES).toHaveLength(sections.length + entries.length);
  });

  it('prints each entry from resume.ts, markup resolved', () => {
    for (const e of entries) {
      const r = run(`cat ${e.id}`, ctx);
      const printed = text(r.lines);
      expect(printed).toContain(e.title);
      expect(printed).toContain(e.date);
      for (const source of [e.intro, e.body, ...(e.bullets ?? [])]) if (source) expect(printed).toContain(plainText(source));
      expect(printed).not.toContain('*');
      if (e.repo) expect(links(r)).toContain(e.repo.href);
    }
  });

  it('marks highlighted figures as strong', () => {
    const r = run('cat tmh-hackathon', ctx);
    const strong = r.lines.flatMap((l) => l.filter((s) => s.kind === 'strong').map((s) => s.text));
    expect(strong).toEqual(['14 teams', '407,669 wheel-wear records', 'MSE 0.12']);
  });

  it('prints whole sections: entries, the tally, education, skills, contact', () => {
    const hack = out('cat hackathons');
    expect(hack).toContain(hackathons.tally);
    for (const h of hackathons.items) expect(hack).toContain(h.title);

    const edu = out('cat education');
    for (const part of [education.institution, education.programme, ...education.bullets]) expect(edu).toContain(part);

    const sk = out('cat skills');
    for (const s of skills) {
      expect(sk).toContain(s.group);
      expect(sk).toContain(s.items.join(', '));
    }

    expect(links(run('cat contact', ctx))).toEqual([`mailto:${header.email}`, header.telegram.href, header.github.href]);
  });

  it('hangs wrapped text under the label column and after bullets', () => {
    const firsts = (input: string) => run(input, ctx).lines.filter((l) => l[0]?.hang).map((l) => l[0]!.text);
    expect(firsts('cat skills')).toEqual(skills.map((s) => s.group.padEnd(11)));
    expect(firsts('help')).toHaveLength(COMMANDS.length);
    expect(firsts('cat tmh-internship')).toEqual(Array(4).fill('– '));
  });

  it('accepts the trailing slash from ls and several names at once', () => {
    expect(out('cat projects/')).toBe(out('cat projects'));
    const both = out('cat sibur score-editor');
    expect(both).toContain('Chemical Feedstock Selection System');
    expect(both).toContain('Score Editor');
  });

  it('reports missing and unknown names', () => {
    expect(isError(run('cat', ctx))).toBe(true);
    expect(out('cat')).toBe(ui.terminal.missing('cat', 'cat <name>'));
    expect(out('cat depot')).toBe(ui.terminal.noSuch('cat', 'depot'));
    expect(out('open nowhere')).toBe(ui.terminal.noSuch('open', 'nowhere'));
    expect(isError(run('open', ctx))).toBe(true);
  });

  it('opens sections and entries by scrolling to their anchors', () => {
    expect(run('open sibur', ctx).effect).toEqual({ kind: 'navigate', id: 'sibur' });
    expect(run('open Skills', ctx).effect).toEqual({ kind: 'navigate', id: 'skills' });
  });

  it('downloads the CV', () => {
    const r = run('cv', ctx);
    expect(r.effect).toEqual({ kind: 'download', href: header.cv });
    expect(links(r)).toEqual([header.cv]);
  });

  it('switches the theme and rejects anything but light and dark', () => {
    expect(run('theme dark', ctx).effect).toEqual({ kind: 'theme', theme: 'dark' });
    expect(run('theme LIGHT', ctx).effect).toEqual({ kind: 'theme', theme: 'light' });
    expect(out('theme')).toContain('light');
    expect(run('theme', ctx).effect).toBeUndefined();
    expect(isError(run('theme blue', ctx))).toBe(true);
  });

  it('clears and closes', () => {
    expect(run('clear', ctx).effect).toEqual({ kind: 'clear' });
    expect(run('exit', ctx).effect).toEqual({ kind: 'close' });
  });

  it('gives the contacts on sudo hire makar and refuses any other sudo', () => {
    const hire = run('sudo  hire   Makar', ctx);
    expect(links(hire)).toEqual([`mailto:${header.email}`, header.telegram.href, header.github.href, header.cv]);
    expect(isError(run('sudo', ctx))).toBe(true);
    expect(isError(run('sudo rm -rf /', ctx))).toBe(true);
  });

  it('does not know play: the game is not on the site', () => {
    expect(out('play')).toBe(ui.terminal.notFound('play'));
  });
});

describe('COMMANDS.md', () => {
  // В таблицах Markdown вертикальная черта экранирована
  const listed = doc.replaceAll('\\|', '|');

  it('lists every command, the easter egg and every name', () => {
    for (const c of COMMANDS) expect(listed).toContain(`\`${ui.terminal.commands[c].usage}\``);
    expect(listed).toContain(`\`sudo ${SUDO_HIRE}\``);
    for (const name of NAMES) expect(listed).toContain(`| \`${name}\` |`);
  });
});
