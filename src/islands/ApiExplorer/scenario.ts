// Сценарий сверки порта с оригиналом (SPEC.md §7.7): scripts/academic-api.py прогоняет эти запросы через настоящий
// FastAPI-бэкенд Academic Profile на тех же выдуманных данных и пишет ответы в golden.json; server.test.ts повторяет
// их против порта. Порядок важен: база меняется по ходу (регистрация, интересы, загрузки, удаления).
// Импорты с расширением .ts — модуль читает и Node в scripts/academic-api.ts.
import { SAMPLE_CSV } from '../../data/demo/academic-scientists.ts';
import type { Method } from '../../data/demo/academic-endpoints';

export interface ScenarioRequest {
  method: Method;
  path: string;
  query?: Record<string, string>;
  /** Сырой текст тела; тип — application/json. */
  body?: string;
  file?: { name: string; text: string };
  /** token — последний токен из успешного /auth/login; bad — мусор; ghost — подписан верно, но пользователя нет. */
  auth?: 'token' | 'bad' | 'ghost';
  /** Битый JSON: позиция и текст ошибки у браузера свои — сравниваются только type, msg и loc[0]. */
  loose?: true;
}

const body = (value: unknown) => JSON.stringify(value);

// Колонки шаблона фронтенда: «Publication Year», «Author», «Source» обработчик не узнаёт; пропуски в числовой
// колонке pandas читает как float — цитирования приходят строкой «2.0». Строка без названия — failed.
const TEMPLATE_CSV = {
  name: 'template.csv',
  text:
    'Title,Publication Year,Author,Coauthors,Source,Citations\r\n' +
    'Heart rate variability after long flights,2021,Demo User,Moreau L,Clinical Data Review,2\r\n' +
    ',2022,Demo User,,Clinical Data Review,\r\n' +
    'Wearable sensors in cardiac rehabilitation,,Demo User,,Clinical Data Review,\r\n',
};

export const scenario: readonly ScenarioRequest[] = [
  { method: 'GET', path: '/health' },

  // Рекомендации — модель команды
  { method: 'POST', path: '/recommend', body: body({ interests: ['Machine Learning', 'Radiology'], num_recommendations: 3 }) },
  {
    method: 'POST',
    path: '/recommend',
    body: body({
      interests: ['Genomics', 'Epidemiology'],
      publications: ['Polygenic risk scores for diabetes', 'Risk prediction for diabetes cohorts with genomics data'],
      num_recommendations: 5,
    }),
  },
  { method: 'POST', path: '/recommend', body: body({ interests: ['Machine Learning'], num_recommendations: 100 }) },
  { method: 'POST', path: '/recommend', body: body({ interests: ['Pediatrics', 'Clinical Research'], num_recommendations: 4 }) },
  { method: 'POST', path: '/recommend', body: body({ interests: [], num_recommendations: 3 }) },
  { method: 'POST', path: '/recommend', body: body({ interests: ['Radiology'], num_recommendations: '4' }) },
  { method: 'POST', path: '/recommend', body: body({ interests: 'Radiology' }) },
  { method: 'POST', path: '/recommend', body: body({ interests: ['Radiology'], num_recommendations: 0 }) },
  { method: 'POST', path: '/recommend', body: body({ interests: ['Radiology'], num_recommendations: 101 }) },
  { method: 'POST', path: '/recommend', body: body({ interests: ['Radiology', 5] }) },
  { method: 'POST', path: '/recommend', body: body({ interests: ['Radiology'], num_recommendations: 2.5 }) },
  { method: 'POST', path: '/recommend', body: body({ publications: null }) },
  { method: 'POST', path: '/recommend', body: '[1, 2]' },
  { method: 'POST', path: '/recommend', body: '{"interests": [', loose: true },
  { method: 'POST', path: '/recommend' },

  // Авторизация
  { method: 'GET', path: '/knowledge-graph' },
  { method: 'GET', path: '/knowledge-graph', auth: 'bad' },
  { method: 'GET', path: '/knowledge-graph', auth: 'ghost' },
  { method: 'POST', path: '/auth/login', body: body({ login_or_email: 'demo', password: 'wrong-password' }) },
  { method: 'POST', path: '/auth/login', body: body({ login_or_email: 'demo' }) },
  { method: 'POST', path: '/auth/login', body: body({ login_or_email: 'demo', password: 'demo-password' }) },
  { method: 'GET', path: '/users/me', auth: 'token' },
  { method: 'GET', path: '/knowledge-graph', auth: 'token' },

  // Регистрация
  {
    method: 'POST',
    path: '/auth/register',
    body: body({
      login: 'new_scientist',
      email: 'new.scientist@example.org',
      first_name: 'Nova',
      last_name: 'Reyes',
      orcid_id: '0000-0002-5555-0042',
      password: 'correct-horse-42',
    }),
  },
  {
    method: 'POST',
    path: '/auth/register',
    body: body({ login: 'new_scientist', email: 'other@example.org', first_name: 'N', last_name: 'R', password: '12345678' }),
  },
  {
    method: 'POST',
    path: '/auth/register',
    body: body({ login: 'another', email: 'new.scientist@example.org', first_name: 'N', last_name: 'R', password: '12345678' }),
  },
  { method: 'POST', path: '/auth/register', body: body({ login: 'ab', email: 'not-an-email', first_name: 'A', password: 'short' }) },
  { method: 'POST', path: '/auth/register', body: body({ login: 'x'.repeat(256), email: 'a@b', first_name: 7, last_name: null, password: 12345678 }) },
  {
    method: 'POST',
    path: '/auth/register',
    body: body({
      login: 'MixedCase',
      email: 'Mixed.Case@Example.ORG',
      first_name: 'Mia',
      last_name: 'Case',
      interests_list: 'Genomics',
      password: 'mixed-case-password',
    }),
  },
  { method: 'POST', path: '/auth/login', body: body({ login_or_email: 'new.scientist@example.org', password: 'correct-horse-42' }) },
  { method: 'GET', path: '/users/me', auth: 'token' },
  { method: 'GET', path: '/knowledge-graph', auth: 'token' },

  // Интересы — без токена, по логину
  { method: 'PUT', path: '/users/interests', body: body({ login: 'new_scientist', interests_list: ['Genomics', 'Machine Learning', 'Quantum Biology'] }) },
  { method: 'GET', path: '/knowledge-graph', auth: 'token' },
  { method: 'PUT', path: '/users/interests', body: body({ login: 'nobody', interests_list: ['Genomics'] }) },
  { method: 'PUT', path: '/users/interests', body: body({ login: 'r.silva', interests_list: [] }) },
  { method: 'PUT', path: '/users/interests', body: body({ login: 'r.', interests_list: ['Genomics'] }) },
  { method: 'PUT', path: '/users/interests', body: body({ login: 'demo', interests_list: 'Genomics' }) },

  // Публикации
  { method: 'GET', path: '/users/1/publications' },
  { method: 'POST', path: '/users/1/publications/upload', file: SAMPLE_CSV },
  { method: 'POST', path: '/users/1/publications/upload', file: TEMPLATE_CSV },
  { method: 'POST', path: '/users/1/publications/upload', file: { name: 'notes.txt', text: 'title\nNotes\n' } },
  { method: 'POST', path: '/users/1/publications/upload', file: { name: 'no-title.csv', text: '﻿Name,Year\nX,2020\n' } },
  { method: 'POST', path: '/users/1/publications/upload', file: { name: 'empty.csv', text: '' } },
  { method: 'POST', path: '/users/1/publications/upload', file: { name: 'header-only.CSV', text: '﻿ Title \n' } },
  {
    method: 'POST',
    path: '/users/1/publications/upload',
    file: { name: 'quirks.csv', text: 'Название,Год,Журнал,Автор\n"Quoted, title",2020,J,A\nN/A,2021,J,A\nnan,2022,,\n3.5,1e-5,True,\n' },
  },
  { method: 'POST', path: '/users/99/publications/upload', file: SAMPLE_CSV },
  { method: 'POST', path: '/users/abc/publications/upload', file: SAMPLE_CSV },
  { method: 'POST', path: '/users/1/publications/upload' },
  { method: 'DELETE', path: '/users/1/publications/2' },
  { method: 'DELETE', path: '/users/1/publications/2' },
  { method: 'DELETE', path: '/users/2/publications/1' },
  { method: 'DELETE', path: '/users/1/publications/8' },
  { method: 'POST', path: '/users/1/publications/upload', file: SAMPLE_CSV },
  { method: 'GET', path: '/users/1/publications' },
  { method: 'GET', path: '/users/99/publications' },
  { method: 'GET', path: '/users/x/publications' },

  // Поиск
  { method: 'GET', path: '/search', query: { query: 'mor' } },
  { method: 'GET', path: '/search', query: { query: 'er', limit: '3' } },
  { method: 'GET', path: '/search', query: { query: 'M_R' } },
  { method: 'GET', path: '/search', query: { query: 'a' } },
  { method: 'GET', path: '/search', query: { query: 'an', limit: '0' } },
  { method: 'GET', path: '/search', query: { query: 'an', limit: 'abc' } },
  { method: 'GET', path: '/search' },
  { method: 'GET', path: '/search/users', query: { username: 'SI' } },
  { method: 'GET', path: '/search/users', query: { username: 'e', limit: '200' } },
  { method: 'GET', path: '/search/authors', query: { name: 'zhou' } },
  { method: 'GET', path: '/search/authors', query: { name: 'an', limit: '2' } },

  // Авторы
  { method: 'GET', path: '/authors/f20eae610ef8/interests' },
  { method: 'GET', path: '/authors/unknown/interests' },
  { method: 'GET', path: '/authors/aadc2baaccdb/profile' },
  { method: 'GET', path: '/authors/f20eae610ef8/profile' },
  { method: 'GET', path: '/authors/da359a4dcc9d/profile' },
  { method: 'GET', path: '/authors/nope/profile' },

  { method: 'GET', path: '/users/me', auth: 'bad' },
  { method: 'POST', path: '/auth/login', body: body({ login_or_email: 'demo@example.org', password: 'demo-password' }) },
  { method: 'GET', path: '/knowledge-graph', auth: 'token' },
  { method: 'GET', path: '/nowhere' },
  { method: 'POST', path: '/health' },
];

/** Адреса для проверки EmailStr отдельно от HTTP: сообщения email-validator. */
export const EMAILS = [
  'demo@example.org',
  'Mixed.Case@Example.ORG',
  'not-an-email',
  '@example.org',
  'user@',
  'a@b',
  'a b@example.org',
  'user@exa mple.org',
  'user@@example.org',
  'user.@example.org',
  '.user@example.org',
  'us..er@example.org',
  'user@example..org',
  'user@-example.org',
  'user@example.org.',
  'user@localhost',
  'user@example.test',
  '',
] as const;

/** Строки для сверки TF-IDF с sklearn. */
export const TFIDF_SAMPLES = [
  'Machine Learning Radiology',
  'machine learning for chest radiographs, radiology and data science',
  'The of and',
  'Genomics,Epidemiology polygenic,risk,type,diabetes,east,asian,cohorts Other',
  'Émigré naïve café — 42 x',
  '',
] as const;
