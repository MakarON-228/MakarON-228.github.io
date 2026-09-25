// Отдельные порты против эталонов оригинала (golden.json): EmailStr, TF-IDF команды, JWT python-jose, разбор CSV pandas.
import { describe, expect, it } from 'vitest';
import { authorInterests } from '../../data/demo/academic-scientists';
import model from '../../data/demo/academic-tfidf.json';
import { pyFloat, readCsv } from './csv';
import golden from './golden.json';
import { sign, verify } from './jwt';
import { Recommender, authorProfile, targetProfile } from './recommender';
import { EMAILS, TFIDF_SAMPLES } from './scenario';
import { Tfidf } from './tfidf';
import { checkEmail } from './validate';

describe('EmailStr', () => {
  it('normalises and rejects like pydantic + email-validator', () => {
    expect(golden.emails.map((e) => e.input)).toEqual(EMAILS);
    for (const e of golden.emails) {
      const got = checkEmail(e.input);
      if ('ok' in e) expect(got, e.input).toEqual({ ok: e.ok });
      else expect(got, e.input).toEqual({ reason: (e.error as { ctx: { reason: string } }).ctx.reason });
    }
  });
});

describe('TF-IDF of the team model', () => {
  const tfidf = new Tfidf(model);

  it('has the trained vocabulary', () => {
    expect(model.terms).toHaveLength(1000);
    expect(model.n_docs).toBe(194849);
  });

  it('transforms like TfidfVectorizer.transform', () => {
    expect(golden.tfidf.map((t) => t.input)).toEqual(TFIDF_SAMPLES);
    for (const { input, vector } of golden.tfidf) {
      const got = tfidf.transform(input);
      expect([...got.keys()].map(String), input).toEqual(Object.keys(vector));
      for (const [k, v] of Object.entries(vector)) expect(Math.abs(got.get(Number(k))! - v), `${input} ${k}`).toBeLessThan(1e-12);
    }
  });

  it('builds author profiles as train_model.py does', () => {
    expect(authorProfile(authorInterests[12]!)).toBe(
      'Genomics,Epidemiology polygenic,risk,type,diabetes,east,asian,cohorts Other',
    );
  });

  it('adds the ten most frequent publication words to the query', () => {
    expect(targetProfile(['Genomics'], ['Risk prediction for diabetes cohorts', 'Diabetes risk: a study of cohorts, naïve data'])).toBe(
      'Genomics risk diabetes cohorts prediction data',
    );
    expect(targetProfile(['A'], [])).toBe('A');
  });

  it('never returns a researcher below the 0.1 similarity cut', () => {
    const r = new Recommender(tfidf, authorInterests);
    for (const rec of r.recommend(['Radiology'], null, 100)) expect(rec.similarity_score).toBeGreaterThanOrEqual(0.1);
  });
});

describe('JWT', () => {
  it('signs byte for byte like python-jose', async () => {
    expect(await sign(golden.jwt.claims, golden.jwt.secret)).toBe(golden.jwt.token);
  });

  it('verifies signature, algorithm and expiry', async () => {
    const t = golden.jwt.token;
    expect(await verify(t, golden.jwt.secret, golden.jwt.claims.exp)).toEqual(golden.jwt.claims);
    expect(await verify(t, golden.jwt.secret, golden.jwt.claims.exp + 1)).toBeNull();
    expect(await verify(t, 'other', 0)).toBeNull();
    expect(await verify(t.slice(0, -2) + 'xx', golden.jwt.secret, 0)).toBeNull();
    expect(await verify('a.b', golden.jwt.secret, 0)).toBeNull();
  });
});

describe('CSV as pandas reads it', () => {
  it('prints floats like Python repr', () => {
    const cases: [number, string][] = [
      [2020, '2020.0'],
      [2, '2.0'],
      [0.5, '0.5'],
      [1e-5, '1e-05'],
      [123.456, '123.456'],
      [1e16, '1e+16'],
      [1.5e16, '1.5e+16'],
      [-0.0001, '-0.0001'],
      [Infinity, 'inf'],
    ];
    for (const [x, s] of cases) expect(pyFloat(x)).toBe(s);
  });

  it('infers column types, NaN and quoting', () => {
    const f = readCsv('﻿a,b,c,d\r\n"x, y",007,1,True\n\nNA,,2.5,false\n');
    expect(f.columns).toEqual(['a', 'b', 'c', 'd']);
    expect(f.rows).toEqual([
      ['x, y', '7.0', '1.0', 'True'],
      [null, null, '2.5', 'False'],
    ]);
  });

  it('upcasts whole numeric rows as iterrows does', () => {
    expect(readCsv('a,b\n1,2\n3,4\n').rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
    expect(readCsv('a,b\n1,2.5\n').rows).toEqual([['1.0', '2.5']]);
  });

  it('fails on empty files and extra fields', () => {
    expect(() => readCsv('')).toThrow('No columns to parse from file');
    expect(() => readCsv('a\n1,2\n')).toThrow('Expected 1 fields in line 2, saw 2');
  });
});
