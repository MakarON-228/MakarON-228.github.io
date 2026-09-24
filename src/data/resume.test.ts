import { describe, expect, it } from 'vitest';
import * as resume from './resume';
import { plainText } from '../lib/rich';

/** Все строки из resume.ts — для проверок правил контента CLAUDE.md. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const all = strings(resume);

describe('resume content rules', () => {
  it('never says Sochi', () => {
    expect(all.filter((s) => /sochi/i.test(s))).toEqual([]);
  });

  it('never claims all seven lifecycle stages', () => {
    expect(all.filter((s) => /seven stages|7 stages/i.test(s))).toEqual([]);
  });

  it('links Score Editor to Note_redactor', () => {
    const score = resume.projects.find((p) => p.title === 'Score Editor');
    expect(score?.repo?.href).toBe('https://github.com/MakarON-228/Note_redactor');
  });

  it('keeps the TMH hackathon role as ML engineer without the analyst work', () => {
    const tmh = resume.hackathons.items.find((h) => h.title.startsWith('TMH'));
    expect(tmh?.role).toBe('ML engineer, team Ascent');
    expect(tmh?.body).not.toMatch(/Kruskal|Dunn/);
  });

  it('says the Academic Profile recommender belongs to the team', () => {
    const ys = resume.hackathons.items.find((h) => h.title.startsWith('Young Scientists'));
    expect(ys?.body).toMatch(/serving the team's TF-IDF \+ KNN recommender/);
  });

  it('has balanced markup in every string', () => {
    expect(all.filter((s) => plainText(s).includes('*'))).toEqual([]);
  });

  it('has unique section and entry anchors', () => {
    const ids = [...resume.sections.map((s) => s.id), ...resume.entries.map((e) => e.id), 'content'];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
