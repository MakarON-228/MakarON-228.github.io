// Представление ApiExplorer: раскладка графа знаний, JSON ответа и curl.
import { describe, expect, it } from 'vitest';
import { endpoints } from '../../data/demo/academic-endpoints';
import { SAMPLE_CSV } from '../../data/demo/academic-scientists';
import golden from './golden.json';
import { LABEL_GAP, labelOnRight, labelWidth, layoutGraph, type GraphData } from './graph';
import { initialForm, prepare } from './http';
import { jsonTokens } from './json';

// Ответ GET /knowledge-graph для демо-пользователя из эталонов оригинала
const graph = golden.responses[23]!.body as GraphData;

describe('knowledge graph layout', () => {
  for (const [w, h] of [
    [280, 380],
    [440, 360],
  ] as const) {
    const l = layoutGraph(graph, w, h);

    it(`${w}×${h}: is deterministic and stays in the frame`, () => {
      expect(layoutGraph(graph, w, h)).toEqual(l);
      expect(l.nodes).toHaveLength(graph.interests.length + graph.scientists.length);
      for (const n of l.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.x).toBeLessThanOrEqual(w);
        expect(n.y).toBeGreaterThanOrEqual(0);
        expect(n.y).toBeLessThanOrEqual(h);
      }
    });

    it(`${w}×${h}: links every scientist to each of its interests`, () => {
      expect(l.edges).toHaveLength(graph.scientists.reduce((s, x) => s + x.interests.length, 0));
      for (const [a, b] of l.edges) {
        expect(l.nodes[a]!.kind).not.toBe('interest');
        expect(l.nodes[b]!.kind).toBe('interest');
      }
    });

    it(`${w}×${h}: keeps interest labels apart`, () => {
      const boxes = l.nodes
        .filter((n) => n.kind === 'interest')
        .map((n) => {
          const lw = labelWidth(n.label) + LABEL_GAP;
          const [left, right] = labelOnRight(n.x, w) ? [n.x - 5, n.x + lw] : [n.x - lw, n.x + 5];
          return { left, right, top: n.y - 7, bottom: n.y + 7 };
        });
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
          expect(overlap, `${l.nodes[i]!.label} / ${l.nodes[j]!.label}`).toBe(false);
        }
    });
  }

  it('handles an empty graph', () => {
    expect(layoutGraph({ interests: [], scientists: [] }, 100, 100).nodes).toEqual([]);
  });
});

describe('response JSON', () => {
  const text = (v: unknown) => jsonTokens(v).map((t) => t.s).join('');

  it('prints like JSON.stringify with two spaces', () => {
    const v = { a: [1, 'x', null, true, { b: [] }], c: {}, d: 'ü "q"' };
    expect(text(v)).toBe(JSON.stringify(v, null, 2));
  });

  it('prints float fields the way Python does', () => {
    expect(text({ productivity_score: 1, processing_time: 0.00004, articles_count: 3 })).toBe(
      '{\n  "productivity_score": 1.0,\n  "processing_time": 4e-05,\n  "articles_count": 3\n}',
    );
  });

  it('marks keys, strings, numbers and literals', () => {
    expect(jsonTokens({ k: 'v', n: 2, l: null }).filter((t) => t.t !== 'p')).toEqual([
      { t: 'k', s: '"k"' },
      { t: 's', s: '"v"' },
      { t: 'k', s: '"n"' },
      { t: 'n', s: '2' },
      { t: 'k', s: '"l"' },
      { t: 'l', s: 'null' },
    ]);
  });
});

describe('request preview', () => {
  const ep = (id: string) => endpoints.find((e) => e.id === id)!;

  it('lists the 15 endpoints of main.py, locks only the two behind get_current_user', () => {
    expect(endpoints.map((e) => `${e.method} ${e.path}`)).toEqual([
      'POST /auth/register',
      'POST /auth/login',
      'GET /users/me',
      'PUT /users/interests',
      'POST /users/{user_id}/publications/upload',
      'GET /users/{user_id}/publications',
      'DELETE /users/{user_id}/publications/{publication_id}',
      'GET /search',
      'GET /search/users',
      'GET /search/authors',
      'GET /authors/{author_id}/interests',
      'GET /authors/{author_id}/profile',
      'GET /health',
      'POST /recommend',
      'GET /knowledge-graph',
    ]);
    expect(endpoints.filter((e) => e.auth).map((e) => e.id)).toEqual(['me', 'knowledge-graph']);
  });

  it('builds the URL and drops empty optional parameters', () => {
    const form = initialForm(ep('search'));
    form.params['limit'] = '';
    const p = prepare(ep('search'), form, null, 'tok');
    expect(p.url).toBe('http://localhost:8000/search?query=mor');
    expect(p.req).toMatchObject({ method: 'GET', path: '/search', query: { query: 'mor' }, authorization: undefined });
  });

  it('encodes path parameters in the URL only', () => {
    const form = initialForm(ep('profile'));
    form.params['author_id'] = 'a b';
    const p = prepare(ep('profile'), form, null, null);
    expect(p.req.path).toBe('/authors/a b/profile');
    expect(p.url).toBe('http://localhost:8000/authors/a%20b/profile');
  });

  it('writes curl the way Swagger UI does', () => {
    const me = prepare(ep('me'), initialForm(ep('me')), null, 'abc');
    expect(me.curl).toBe("curl -X 'GET' \\\n  'http://localhost:8000/users/me' \\\n  -H 'accept: application/json' \\\n  -H 'Authorization: Bearer abc'");
    const form = initialForm(ep('login'));
    form.body = `{"login_or_email": "o'neil"}`;
    expect(prepare(ep('login'), form, null, null).curl).toContain(`-d '{"login_or_email": "o'\\''neil"}'`);
    const file = { name: SAMPLE_CSV.name, bytes: new Uint8Array() };
    expect(prepare(ep('upload'), initialForm(ep('upload')), file, null).curl).toContain("-F 'file=@publications.csv;type=text/csv'");
  });
});
