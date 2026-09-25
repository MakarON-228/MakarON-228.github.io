// Порт против оригинала: golden.json — ответы настоящего бэкенда Academic Profile (FastAPI TestClient, SQLite,
// рекомендер команды на тех же выдуманных учёных) на сценарий из scenario.ts. Пересобрать: npm run academic.
import { describe, expect, it } from 'vitest';
import model from '../../data/demo/academic-tfidf.json';
import golden from './golden.json';
import { sign } from './jwt';
import { scenario } from './scenario';
import { Backend, pyRound1 } from './server';

const SECRET = golden.jwt.secret;
const enc = new TextEncoder();

/** Сравнение JSON с допуском для float (разный порядок суммирования в numpy и здесь). */
function close(actual: unknown, expected: unknown, path = '$'): void {
  if (typeof expected === 'number' && typeof actual === 'number') {
    expect(Math.abs(actual - expected), path).toBeLessThan(1e-9);
    return;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true);
    expect((actual as unknown[]).length, `${path}.length`).toBe(expected.length);
    expected.forEach((e, i) => close((actual as unknown[])[i], e, `${path}[${i}]`));
    return;
  }
  if (expected && typeof expected === 'object') {
    expect(actual && typeof actual === 'object', path).toBe(true);
    const a = actual as Record<string, unknown>;
    expect(Object.keys(a), `${path} keys`).toEqual(Object.keys(expected));
    for (const [k, v] of Object.entries(expected)) close(a[k], v, `${path}.${k}`);
    return;
  }
  expect(actual, path).toEqual(expected);
}

const payload = (token: string) => JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;

describe('the ported handlers answer like the original backend', async () => {
  const backend = new Backend({ secret: SECRET, model: async () => model });
  let token: string | undefined;
  const ghost = await sign({ sub: '999', exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);

  for (const [i, req] of scenario.entries()) {
    const want = golden.responses[i]!;
    const label = `${i} ${req.method} ${req.path}${req.query ? '?' + new URLSearchParams(req.query) : ''} → ${want.status}`;
    it(label, async () => {
      const authorization = req.auth === 'token' ? `Bearer ${token}` : req.auth === 'bad' ? 'Bearer not-a-token' : req.auth === 'ghost' ? `Bearer ${ghost}` : undefined;
      const res = await backend.handle({
        method: req.method,
        path: req.path,
        query: req.query ?? {},
        body: req.body,
        file: req.file && { name: req.file.name, bytes: enc.encode(req.file.text) },
        authorization,
      });
      expect(res.status).toBe(want.status);
      expect(res.headers['www-authenticate'] ?? null).toBe(want.www_authenticate);
      const body = res.body as Record<string, unknown>;
      const expected = want.body as Record<string, unknown>;

      if (req.path === '/auth/login' && res.status === 200) {
        token = body['access_token'] as string;
        // Токены различаются сроком и ключом; совпадать должны тип и субъект
        expect(body['token_type']).toBe(expected['token_type']);
        expect(payload(token)['sub']).toBe(payload(expected['access_token'] as string)['sub']);
        return;
      }
      if (req.path === '/recommend' && res.status === 200) {
        expect(typeof body['processing_time']).toBe('number');
        close(body['recommendations'], expected['recommendations']);
        return;
      }
      if (req.loose) {
        const [got] = body['detail'] as { type: string; msg: string; loc: unknown[] }[];
        const [exp] = expected['detail'] as { type: string; msg: string; loc: unknown[] }[];
        expect([got!.type, got!.msg, got!.loc[0]]).toEqual([exp!.type, exp!.msg, exp!.loc[0]]);
        return;
      }
      close(body, expected);
    });
  }
});

describe('pyRound1', () => {
  it('rounds like round(x, 1) in Python', () => {
    const cases: [number, number][] = [
      [0.05, 0.1],
      [0.15, 0.1],
      [0.25, 0.2],
      [0.35, 0.3],
      [1.125, 1.1],
      [2.675, 2.7],
      [1.45, 1.4],
      [0.45, 0.5],
      [-0.25, -0.2],
      [3 * 0.45, 1.4],
      [5.5 * 0.45, 2.5],
      [7.5 * 0.45, 3.4],
      [2.5 * 0.4, 1.0],
    ];
    for (const [x, want] of cases) expect(pyRound1(x), String(x)).toBe(want);
  });
});

describe('tokens', () => {
  it('reject an expired token and accept a fresh one', async () => {
    let now = 1_790_000_000_000;
    const backend = new Backend({ secret: SECRET, model: async () => model, now: () => now });
    const login = await backend.handle({ method: 'POST', path: '/auth/login', body: '{"login_or_email":"demo","password":"demo-password"}' });
    const auth = `Bearer ${(login.body as { access_token: string }).access_token}`;
    expect((await backend.handle({ method: 'GET', path: '/users/me', authorization: auth })).status).toBe(200);
    now += 60 * 60 * 1000;
    expect((await backend.handle({ method: 'GET', path: '/users/me', authorization: auth })).status).toBe(200);
    now += 1000;
    const expired = await backend.handle({ method: 'GET', path: '/users/me', authorization: auth });
    expect(expired.status).toBe(401);
    expect(expired.body).toEqual({ detail: 'Invalid or expired token. Please login again.' });
  });

  it('reject a token signed with another key and a non-bearer scheme', async () => {
    const backend = new Backend({ secret: SECRET, model: async () => model });
    const forged = await sign({ sub: '1', exp: Math.floor(Date.now() / 1000) + 60 }, 'change-me');
    expect((await backend.handle({ method: 'GET', path: '/users/me', authorization: `Bearer ${forged}` })).status).toBe(401);
    const basic = await backend.handle({ method: 'GET', path: '/users/me', authorization: 'Basic abc' });
    expect(basic.body).toEqual({ detail: 'Not authenticated' });
  });
});

describe('upload', () => {
  it('refuses Excel files the port cannot read, before parsing', async () => {
    const backend = new Backend({ secret: SECRET, model: async () => model });
    const res = await backend.handle({ method: 'POST', path: '/users/1/publications/upload', file: { name: 'pubs.xlsx', bytes: new Uint8Array([80, 75]) } });
    expect(res.status).toBe(501);
  });

  it('reports bytes that are not UTF-8 like the Python codec', async () => {
    const backend = new Backend({ secret: SECRET, model: async () => model });
    const res = await backend.handle({ method: 'POST', path: '/users/1/publications/upload', file: { name: 'a.csv', bytes: new Uint8Array([0x74, 0xff]) } });
    expect(res).toMatchObject({ status: 500, body: { detail: "Error processing file: 'utf-8' codec can't decode byte 0xff in position 1: invalid start byte" } });
  });
});
