// Бэкенд Academic Profile в браузере (SPEC.md §7.7) — построчный порт обработчиков app/main.py поверх таблиц в памяти
// вместо SQLite. Маршрутизация и ошибки — как у FastAPI/Starlette: 404/405 по пути и методу, сначала зависимости
// (токен), потом проверка пути, запроса и тела (422), потом сам обработчик. Сверяется с оригиналом в server.test.ts.
import {
  authorInterests as seedInterests,
  authors as seedAuthors,
  userPublications as seedPublications,
  users as seedUsers,
  type AuthorInterestRow,
  type AuthorRow,
  type UserPublicationRow,
  type UserRow,
} from '../../data/demo/academic-scientists';
import { CsvError, decodeUtf8, pyStrip, readCsv } from './csv';
import { hashPassword, sign, verify } from './jwt';
import { Recommender } from './recommender';
import { Tfidf, type TfidfData } from './tfidf';
import {
  RECOMMENDATION_REQUEST,
  UPDATE_INTERESTS,
  USER_CREATE,
  USER_LOGIN,
  validateBody,
  validateParam,
  type ErrorDetail,
  type Field,
} from './validate';

export interface ApiRequest {
  method: string;
  path: string;
  query?: Record<string, string>;
  /** Сырой текст тела (application/json); undefined — тела нет. */
  body?: string | undefined;
  file?: { name: string; bytes: Uint8Array } | undefined;
  /** Значение заголовка Authorization. */
  authorization?: string | undefined;
}

export interface ApiResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

type User = Omit<UserRow, 'password'> & { password_hash: string };

class HttpError {
  constructor(
    readonly status: number,
    readonly detail: unknown,
    readonly headers: Record<string, string> = {},
  ) {}
}

export interface BackendOptions {
  /** Ключ подписи JWT (в оригинале — SECRET_KEY из окружения). */
  secret: string;
  /** Словарь модели команды; грузится при первом обращении к рекомендеру. */
  model: () => Promise<TfidfData>;
  /** Текущее время, мс. */
  now?: () => number;
  /** Секундомер для processing_time, мс. */
  clock?: () => number;
}

const TOKEN_MINUTES = 60;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ROWS = 10000;
const TOPIC_COLORS = ['#5BC0F8', '#7C3AED', '#F2A541', '#142850', '#38B2AC', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const BEARER = { 'www-authenticate': 'Bearer' };

// --- мелочи Python и SQLite ---

/** lower() в SQLite без ICU трогает только ASCII; LIKE тоже сравнивает без учёта регистра только ASCII. */
const asciiLower = (s: string) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());

/** `lower(column) LIKE '%q%'` — % и _ в запросе работают как шаблоны, как в оригинале. */
function like(value: string | null, pattern: string): boolean {
  if (value === null) return false;
  const re = [...asciiLower(pattern)]
    .map((c) => (c === '%' ? '[\\s\\S]*' : c === '_' ? '[\\s\\S]' : c.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')))
    .join('');
  return new RegExp(`^${re}$`, 'u').test(asciiLower(value));
}

/** Сравнение INTEGER-колонки со строкой в SQLite: текст, похожий на число, приводится к числу. */
function sqliteIdEquals(id: number, text: string): boolean {
  return /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(text) && Number(text) === id;
}

/** Следующий rowid: max + 1, как у INTEGER PRIMARY KEY без AUTOINCREMENT. */
const nextId = (rows: readonly { id: number }[]) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;

/** str.split() без аргументов. */
const pySplit = (s: string) => s.split(/\s+/u).filter(Boolean);

/** round(x, 1) в Python: банковское округление точного двоичного значения. */
export function pyRound1(x: number): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, Math.abs(x));
  const bits = view.getBigUint64(0);
  const exp = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & ((1n << 52n) - 1n);
  const [m, e] = exp === 0 ? [frac, -1074] : [frac | (1n << 52n), exp - 1075];
  let q: bigint;
  if (e >= 0) q = m * 10n * (1n << BigInt(e));
  else {
    const den = 1n << BigInt(-e);
    const num = m * 10n;
    q = num / den;
    const r2 = 2n * (num % den);
    if (r2 > den || (r2 === den && q % 2n === 1n)) q += 1n;
  }
  return (x < 0 ? -1 : 1) * (Number(q) / 10);
}

const intParam = (name: string): Field => ({ name, type: 'int', required: true });
const strParam = (name: string): Field => ({ name, type: 'str', required: true });
const queryStr = (name: string): Field => ({ name, type: 'str', required: true, minLength: 2 });
const LIMIT: Field = { name: 'limit', type: 'int', required: false, default: 10, ge: 1, le: 100 };

// --- маршруты ---

interface Ctx {
  params: Record<string, string>;
  query: Record<string, string>;
  body: string | undefined;
  file: ApiRequest['file'];
  authorization: string | undefined;
}

interface Route {
  method: string;
  path: string;
  handle: (b: Backend, ctx: Ctx) => Promise<ApiResponse | unknown>;
}

const ok = (body: unknown, status = 200): ApiResponse => ({ status, body, headers: {} });

/** Проверка параметров; при ошибках — 422 с деталями, как RequestValidationError. */
function check(errors: ErrorDetail[]): void {
  if (errors.length) throw new HttpError(422, errors);
}

/** json.loads тела; пустое тело — отсутствующее. */
function parseJson(body: string | undefined, errors: ErrorDetail[]): { value: unknown } | null {
  if (body === undefined || body === '') {
    errors.push({ type: 'missing', loc: ['body'], msg: 'Field required', input: null });
    return null;
  }
  try {
    return { value: JSON.parse(body) as unknown };
  } catch (e) {
    // Отступление: позиция и текст ошибки — от парсера браузера, у Python json они свои
    const message = e instanceof Error ? e.message : String(e);
    const pos = Number(/position (\d+)/.exec(message)?.[1] ?? body.length);
    errors.push({ type: 'json_invalid', loc: ['body', pos], msg: 'JSON decode error', input: {}, ctx: { error: message } });
    return null;
  }
}

function jsonBody(ctx: Ctx, fields: readonly Field[], errors: ErrorDetail[]): Record<string, unknown> {
  const parsed = parseJson(ctx.body, errors);
  return parsed ? validateBody(parsed.value, fields, errors) : {};
}

const routes: readonly Route[] = [
  {
    method: 'POST',
    path: '/auth/register',
    handle: async (b, ctx) => {
      const errors: ErrorDetail[] = [];
      const p = jsonBody(ctx, USER_CREATE, errors);
      check(errors);
      if (b.users.some((u) => u.login === p['login'])) throw new HttpError(400, 'Login already taken');
      if (b.users.some((u) => u.email === p['email'])) throw new HttpError(400, 'Email already registered');
      // interests_list из запроса обработчик в модель не передаёт — у нового пользователя его нет
      const user: User = {
        id: nextId(b.users),
        login: p['login'] as string,
        email: p['email'] as string,
        first_name: p['first_name'] as string,
        last_name: p['last_name'] as string,
        google_scholar_id: p['google_scholar_id'] as string | null,
        scopus_id: p['scopus_id'] as string | null,
        wos_id: p['wos_id'] as string | null,
        rsci_id: p['rsci_id'] as string | null,
        orcid_id: p['orcid_id'] as string | null,
        interests_list: null,
        password_hash: await hashPassword(p['password'] as string),
      };
      b.users.push(user);
      return ok(userResponse(user), 201);
    },
  },
  {
    method: 'POST',
    path: '/auth/login',
    handle: async (b, ctx) => {
      const errors: ErrorDetail[] = [];
      const p = jsonBody(ctx, USER_LOGIN, errors);
      check(errors);
      const user = b.users.find((u) => u.login === p['login_or_email'] || u.email === p['login_or_email']);
      if (!user || (await hashPassword(p['password'] as string)) !== user.password_hash) throw new HttpError(401, 'Invalid credentials');
      const exp = Math.floor(b.now() / 1000) + TOKEN_MINUTES * 60;
      return { access_token: await sign({ sub: String(user.id), exp }, b.secret), token_type: 'bearer' };
    },
  },
  {
    method: 'GET',
    path: '/users/me',
    handle: async (b, ctx) => userResponse(await b.currentUser(ctx.authorization)),
  },
  {
    method: 'PUT',
    path: '/users/interests',
    handle: async (b, ctx) => {
      const errors: ErrorDetail[] = [];
      const p = jsonBody(ctx, UPDATE_INTERESTS, errors);
      check(errors);
      const user = b.users.find((u) => u.login === p['login']);
      if (!user) throw new HttpError(404, `Пользователь с login '${p['login'] as string}' не найден`);
      const list = p['interests_list'] as string[];
      user.interests_list = list.length ? list.join(', ') : null;
      return userResponse(user);
    },
  },
  {
    method: 'POST',
    path: '/users/{user_id}/publications/upload',
    handle: async (b, ctx) => {
      const errors: ErrorDetail[] = [];
      const userId = validateParam(ctx.params['user_id'], intParam('user_id'), 'path', errors) as number;
      if (!ctx.file) errors.push({ type: 'missing', loc: ['body', 'file'], msg: 'Field required', input: null });
      check(errors);
      if (!b.users.some((u) => u.id === userId)) throw new HttpError(404, `User with id ${userId} not found`);
      const file = ctx.file!;
      if (file.bytes.length > MAX_FILE_SIZE) {
        throw new HttpError(400, `File size exceeds maximum allowed size of ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)}MB`);
      }
      const ext = file.name ? file.name.split('.').at(-1)!.toLowerCase() : '';
      if (ext === 'xlsx' || ext === 'xls') {
        // Отступление: pd.read_excel (openpyxl) в браузер не перенесён
        throw new HttpError(501, 'Excel parsing (pandas + openpyxl) is not part of this in-browser port; upload a CSV file.');
      }
      if (ext !== 'csv') {
        throw new HttpError(400, 'Unsupported file format. Please upload Excel (.xlsx, .xls) or CSV (.csv) file');
      }

      let frame;
      try {
        frame = readCsv(decodeUtf8(file.bytes));
      } catch (e) {
        if (e instanceof CsvError) throw new HttpError(500, `Error processing file: ${e.message}`);
        throw e;
      }
      const columns = frame.columns.map((c) => pyStrip(c).toLowerCase());
      if (frame.rows.length > MAX_ROWS) throw new HttpError(400, `File contains too many rows. Maximum allowed: ${MAX_ROWS}`);
      const titleCol = columns.findIndex((c) => ['название статьи', 'название', 'title'].includes(c));
      if (titleCol < 0) throw new HttpError(400, "Required column 'Название статьи' (or 'Title') not found in file");

      let imported = 0;
      let failed = 0;
      for (const row of frame.rows) {
        const t = row[titleCol];
        const title = t === null || t === undefined ? null : pyStrip(t);
        if (!title || title === 'nan') {
          failed++;
          continue;
        }
        const pub: UserPublicationRow = {
          id: nextId(b.publications),
          user_id: userId,
          title,
          coauthors: null,
          citations: null,
          journal: null,
          publication_year: null,
          author_name: null,
        };
        // Словарь column_mapping в оригинале объявлен, но не используется: узнаются только эти имена колонок
        columns.forEach((col, j) => {
          const v = row[j];
          const value = v === null || v === undefined ? null : pyStrip(v);
          if (['соавторы', 'coauthors', 'соавтор'].includes(col)) pub.coauthors = value;
          else if (['цитирование', 'citations', 'цитаты'].includes(col)) pub.citations = value;
          else if (['журнал', 'journal'].includes(col)) pub.journal = value;
          else if (['год публикации', 'год', 'year', 'publication_year'].includes(col)) pub.publication_year = value;
          else if (['имя автора', 'author_name', 'автор'].includes(col)) pub.author_name = value;
        });
        b.publications.push(pub);
        imported++;
      }
      return {
        message: `Successfully imported ${imported} publications`,
        imported_count: imported,
        failed_count: failed,
        publications: b.publicationsOf(userId).map(publicationResponse),
      };
    },
  },
  {
    method: 'GET',
    path: '/users/{user_id}/publications',
    handle: async (b, ctx) => {
      const errors: ErrorDetail[] = [];
      const userId = validateParam(ctx.params['user_id'], intParam('user_id'), 'path', errors) as number;
      check(errors);
      if (!b.users.some((u) => u.id === userId)) throw new HttpError(404, `User with id ${userId} not found`);
      return b.publicationsOf(userId).map(publicationResponse);
    },
  },
  {
    method: 'DELETE',
    path: '/users/{user_id}/publications/{publication_id}',
    handle: async (b, ctx) => {
      const errors: ErrorDetail[] = [];
      const userId = validateParam(ctx.params['user_id'], intParam('user_id'), 'path', errors);
      const pubId = validateParam(ctx.params['publication_id'], intParam('publication_id'), 'path', errors);
      check(errors);
      const i = b.publications.findIndex((p) => p.id === pubId && p.user_id === userId);
      if (i < 0) throw new HttpError(404, 'Publication not found');
      b.publications.splice(i, 1);
      return { message: 'Publication deleted successfully' };
    },
  },
  {
    method: 'GET',
    path: '/search',
    handle: async (b, ctx) => {
      const errors: ErrorDetail[] = [];
      const query = validateParam(ctx.query['query'], queryStr('query'), 'query', errors) as string;
      const limit = validateParam(ctx.query['limit'], LIMIT, 'query', errors) as number;
      check(errors);
      const term = `%${query.toLowerCase()}%`;
      const registered = b.users.filter((u) => like(u.login, term)).slice(0, limit);
      const authors = b.authors.filter((a) => like(a.author_name, term)).slice(0, limit);
      // IN по уникальному индексу author_id: SQLite обходит список значений по возрастанию
      const ids = [...new Set(authors.map((a) => a.author_id).filter((id): id is string => Boolean(id)))].sort();
      const interests = ids.flatMap((id) => b.interests.filter((ai) => ai.author_id === id));
      return {
        registered_users: registered.map(userResponse),
        unregistered_authors: authors.map(authorResponse),
        author_interests: interests.map(interestResponse),
      };
    },
  },
  {
    method: 'GET',
    path: '/search/users',
    handle: async (b, ctx) => {
      const errors: ErrorDetail[] = [];
      const username = validateParam(ctx.query['username'], queryStr('username'), 'query', errors) as string;
      const limit = validateParam(ctx.query['limit'], LIMIT, 'query', errors) as number;
      check(errors);
      return b.users.filter((u) => like(u.login, `%${username.toLowerCase()}%`)).slice(0, limit).map(userResponse);
    },
  },
  {
    method: 'GET',
    path: '/search/authors',
    handle: async (b, ctx) => {
      const errors: ErrorDetail[] = [];
      const name = validateParam(ctx.query['name'], queryStr('name'), 'query', errors) as string;
      const limit = validateParam(ctx.query['limit'], LIMIT, 'query', errors) as number;
      check(errors);
      return b.authors.filter((a) => like(a.author_name, `%${name.toLowerCase()}%`)).slice(0, limit).map(authorResponse);
    },
  },
  {
    method: 'GET',
    path: '/authors/{author_id}/interests',
    handle: async (b, ctx) => {
      const errors: ErrorDetail[] = [];
      const id = validateParam(ctx.params['author_id'], strParam('author_id'), 'path', errors) as string;
      check(errors);
      const interest = b.interests.find((ai) => ai.author_id === id);
      if (!interest) throw new HttpError(404, `Научные интересы для автора с ID ${id} не найдены`);
      return interestResponse(interest);
    },
  },
  {
    method: 'GET',
    path: '/authors/{author_id}/profile',
    handle: async (b, ctx) => {
      const errors: ErrorDetail[] = [];
      const id = validateParam(ctx.params['author_id'], strParam('author_id'), 'path', errors) as string;
      check(errors);
      return b.profile(id);
    },
  },
  {
    method: 'GET',
    path: '/health',
    handle: async (b) => {
      const r = await b.recommender();
      return { status: 'healthy', authors_count: r.df.length, model_loaded: true };
    },
  },
  {
    method: 'POST',
    path: '/recommend',
    handle: async (b, ctx) => {
      const errors: ErrorDetail[] = [];
      const p = jsonBody(ctx, RECOMMENDATION_REQUEST, errors);
      check(errors);
      const r = await b.recommender();
      const start = b.clock();
      const recommendations = r.recommend(p['interests'] as string[], p['publications'] as string[] | null, p['num_recommendations'] as number);
      return { recommendations, processing_time: (b.clock() - start) / 1000 };
    },
  },
  {
    method: 'GET',
    path: '/knowledge-graph',
    handle: async (b, ctx) => b.knowledgeGraph(await b.currentUser(ctx.authorization)),
  },
];

const compiled = routes.map((r) => ({
  ...r,
  names: [...r.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!),
  re: new RegExp(`^${r.path.replace(/\{\w+\}/g, '([^/]+)')}$`),
}));

// --- ответы по схемам schemas.py, ключи в порядке полей ---

const userResponse = (u: User) => ({
  login: u.login,
  email: u.email,
  first_name: u.first_name,
  last_name: u.last_name,
  google_scholar_id: u.google_scholar_id,
  scopus_id: u.scopus_id,
  wos_id: u.wos_id,
  rsci_id: u.rsci_id,
  orcid_id: u.orcid_id,
  interests_list: u.interests_list,
  id: u.id,
});

const publicationResponse = (p: UserPublicationRow) => ({
  title: p.title,
  coauthors: p.coauthors,
  citations: p.citations,
  journal: p.journal,
  publication_year: p.publication_year,
  author_name: p.author_name,
  id: p.id,
  user_id: p.user_id,
});

const authorResponse = (a: AuthorRow) => ({ ...a });
const interestResponse = (a: AuthorInterestRow) => ({ ...a });

const splitList = (s: string | null) => (s ? s.split(',').map((i) => pyStrip(i)).filter(Boolean) : []);

// --- приложение ---

export class Backend {
  readonly users: User[] = [];
  readonly authors: AuthorRow[] = seedAuthors.map((a) => ({ ...a }));
  readonly interests: AuthorInterestRow[] = seedInterests.map((a) => ({ ...a }));
  readonly publications: UserPublicationRow[] = seedPublications.map((p) => ({ ...p }));
  readonly secret: string;
  readonly now: () => number;
  readonly clock: () => number;
  private readonly ready: Promise<void>;
  private model: Promise<Recommender> | null = null;

  constructor(private readonly options: BackendOptions) {
    this.secret = options.secret;
    this.now = options.now ?? (() => Date.now());
    this.clock = options.clock ?? (() => performance.now());
    this.ready = Promise.all(
      seedUsers.map(async ({ password, ...u }) => ({ ...u, password_hash: await hashPassword(password) })),
    ).then((rows) => {
      this.users.push(...rows);
    });
  }

  /** Рекомендер на датасете выдуманных учёных — тот же, что таблица author_interests при засеве. */
  recommender(): Promise<Recommender> {
    this.model ??= this.options.model().then((data) => new Recommender(new Tfidf(data), seedInterests));
    return this.model;
  }

  publicationsOf(userId: number): UserPublicationRow[] {
    return this.publications.filter((p) => p.user_id === userId).sort((a, b) => a.id - b.id);
  }

  /** OAuth2PasswordBearer + get_current_user из auth.py. */
  async currentUser(authorization: string | undefined): Promise<User> {
    const space = authorization?.indexOf(' ') ?? -1;
    const scheme = authorization ? (space < 0 ? authorization : authorization.slice(0, space)) : '';
    if (!authorization || scheme.toLowerCase() !== 'bearer') throw new HttpError(401, 'Not authenticated', BEARER);
    const token = space < 0 ? '' : authorization.slice(space + 1);
    const claims = await verify(token, this.secret, Math.floor(this.now() / 1000));
    if (!claims) throw new HttpError(401, 'Invalid or expired token. Please login again.', BEARER);
    const denied = new HttpError(401, 'Not authenticated. Please provide a valid Bearer token in the Authorization header.', BEARER);
    const sub = claims['sub'];
    if (sub === undefined || sub === null) throw denied;
    const user = this.users.find((u) => sqliteIdEquals(u.id, String(sub)));
    if (!user) throw denied;
    return user;
  }

  /** get_scientist_profile. */
  profile(authorId: string) {
    const interest = this.interests.find((ai) => ai.author_id === authorId);
    if (!interest) throw new HttpError(404, `Автор с ID ${authorId} не найден`);
    const pubs = this.authors.filter((a) => a.author_id === authorId);
    const registered = this.users.find((u) =>
      [u.orcid_id, u.google_scholar_id, u.scopus_id, u.wos_id, u.rsci_id].includes(interest.author_id),
    );

    const clean = (s: string) => pyStrip(s.replaceAll('.', '').replaceAll(',', ''));
    let username = 'N/A';
    if (registered) username = registered.login;
    else if (interest.author_name) {
      const parts = pySplit(interest.author_name);
      if (parts.length) {
        const first = clean(parts[0]!);
        if (parts.length > 1) {
          const last = [...clean(parts.at(-1)!)].slice(0, 5).join('');
          username = first && last ? first + last : first || 'N/A';
        } else username = first || 'N/A';
      }
    }

    const articles = interest.articles_count || pubs.length || 0;
    let index = 0;
    let average = 0;
    if (interest.interests_count && interest.articles_count) {
      const base = (interest.interests_count + interest.articles_count) / 2;
      index = pyRound1(base * 0.4);
      average = pyRound1(base * 0.45);
    }

    const topics: { label: string; value: number; color: string }[] = [];
    const list = splitList(interest.interests_list);
    if (list.length) {
      const baseValue = articles > 0 ? Math.floor(articles / list.length) : 1;
      const remainder = articles > 0 ? articles % list.length : 0;
      list.forEach((label, i) => {
        const value = baseValue + (i < remainder ? 1 : 0);
        topics.push({ label, value: value === 0 ? 1 : value, color: TOPIC_COLORS[i % TOPIC_COLORS.length]! });
      });
    }
    if (!topics.length) {
      topics.push({ label: interest.main_interest || 'Other', value: articles > 0 ? articles : 1, color: TOPIC_COLORS[0]! });
    }

    return {
      scientist: {
        username,
        name: interest.author_name || 'N/A',
        affiliation: 'N/A',
        orcid: registered?.orcid_id || 'N/A',
        metrics: [
          { label: 'H-Index', value: 'N/A' },
          { label: 'Citations', value: 'N/A' },
          { label: 'Publications', value: articles > 0 ? String(articles) : '0' },
        ],
      },
      analytics: { index, average, performance: 'Overall Performance' },
      topicDistribution: topics,
      publications: pubs.map((pub, i) => {
        const yearMatch = pub.publication_year === null ? null : /^\s*([+-]?\d+)\s*$/.exec(pub.publication_year);
        let summary = pub.citation || pub.title || 'N/A';
        if ([...summary].length > 200) summary = [...summary].slice(0, 197).join('') + '...';
        return {
          id: i + 1,
          title: pub.title || 'N/A',
          journal: pub.journal_book || 'N/A',
          year: yearMatch ? Number(yearMatch[1]) : 'N/A',
          citations: 'N/A',
          summary: summary || 'N/A',
        };
      }),
    };
  }

  /** get_knowledge_graph: интересы всех, сходство Жаккара с текущим пользователем, поднятое оценкой модели. */
  async knowledgeGraph(current: User) {
    const interestTo = new Map<string, Set<string>>();
    const add = (interest: string, who: string) => {
      if (!interestTo.has(interest)) interestTo.set(interest, new Set());
      interestTo.get(interest)!.add(who);
    };
    for (const u of this.users) if (u.interests_list !== null) for (const i of splitList(u.interests_list)) add(i, `user_${u.id}`);
    for (const ai of this.interests) if (ai.interests_list !== null) for (const i of splitList(ai.interests_list)) add(i, `author_${ai.id}`);

    const unique = [...interestTo.keys()].sort();
    const idOf = new Map(unique.map((name, i) => [name, i + 1]));
    const interests = unique.map((name) => ({ id: idOf.get(name)!, name, scientist_count: interestTo.get(name)!.size }));

    const mine = splitList(current.interests_list);
    const jaccard = (theirs: string[]) => {
      if (!mine.length || !theirs.length) return 0;
      const a = new Set(mine);
      const b = new Set(theirs);
      const common = [...a].filter((x) => b.has(x)).length;
      return common / new Set([...a, ...b]).size;
    };

    const scored: { id: number; name: string; username: string; interests: number[]; score: number }[] = [];
    for (const u of this.users) {
      if (u.id === current.id) continue;
      const theirs = splitList(u.interests_list);
      scored.push({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        username: u.login || `${u.first_name}${u.last_name}`,
        interests: theirs.filter((i) => idOf.has(i)).map((i) => idOf.get(i)!),
        score: jaccard(theirs),
      });
    }

    const ml = new Map<string, number>();
    if (mine.length) for (const r of (await this.recommender()).recommend(mine, null, 100)) ml.set(r.author_id, r.total_score);

    for (const ai of this.interests) {
      const theirs = splitList(ai.interests_list);
      const name = ai.author_name || 'Unknown';
      const parts = pySplit(name);
      const username = parts.length
        ? parts
            .slice(0, 2)
            .map((p) => [...p.replaceAll('.', '').replaceAll(',', '')].slice(0, 5).join(''))
            .join('')
        : [...name].slice(0, 10).join('');
      let score = jaccard(theirs);
      if (ml.has(ai.author_id)) score = Math.max(score, ml.get(ai.author_id)!);
      scored.push({ id: ai.id + 100000, name, username, interests: theirs.filter((i) => idOf.has(i)).map((i) => idOf.get(i)!), score });
    }

    scored.sort((a, b) => b.score - a.score);
    return {
      interests,
      scientists: scored.slice(0, 100).map(({ id, name, username, interests: ids }) => ({ id, name, username, interests: ids })),
    };
  }

  async handle(req: ApiRequest): Promise<ApiResponse> {
    await this.ready;
    const matches = compiled.map((r) => ({ r, m: r.re.exec(req.path) })).filter((x) => x.m);
    if (!matches.length) return { status: 404, body: { detail: 'Not Found' }, headers: {} };
    const hit = matches.find((x) => x.r.method === req.method);
    if (!hit) {
      return { status: 405, body: { detail: 'Method Not Allowed' }, headers: { allow: matches.map((x) => x.r.method).join(', ') } };
    }
    const params = Object.fromEntries(hit.r.names.map((n, i) => [n, hit.m![i + 1]!]));
    try {
      const out = await hit.r.handle(this, {
        params,
        query: req.query ?? {},
        body: req.body,
        file: req.file,
        authorization: req.authorization,
      });
      return isResponse(out) ? out : ok(out);
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, body: { detail: e.detail }, headers: e.headers };
      throw e;
    }
  }
}

const isResponse = (x: unknown): x is ApiResponse =>
  typeof x === 'object' && x !== null && 'status' in x && 'headers' in x && 'body' in x;
