/**
 * 15 эндпоинтов бэкенда Academic Profile (`backend_academic/app/main.py`) для демо ApiExplorer (SPEC.md §7.7):
 * метод, путь, параметры с ограничениями `Query(...)` и название — так его выводит Swagger FastAPI из имени функции.
 * Замок — только у эндпоинтов с `Depends(get_current_user)`. Примеры запросов выдуманы (ILLUSTRATIVE).
 */
import { DEMO_LOGIN } from './academic-scientists';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface Param {
  name: string;
  in: 'path' | 'query';
  type: 'integer' | 'string';
  required: boolean;
  /** Ограничения из `Query(...)`: min_length, ge, le. */
  minLength?: number;
  ge?: number;
  le?: number;
  default?: string;
  example: string;
}

export interface Endpoint {
  id: string;
  method: Method;
  path: string;
  summary: string;
  auth: boolean;
  params: readonly Param[];
  /** Тело запроса: JSON (пример — текст) или файл multipart. */
  body?: { kind: 'json'; example: string } | { kind: 'file' };
}

const json = (value: unknown) => ({ kind: 'json' as const, example: JSON.stringify(value, null, 2) });
const limit: Param = { name: 'limit', in: 'query', type: 'integer', required: false, ge: 1, le: 100, default: '10', example: '10' };
const userId: Param = { name: 'user_id', in: 'path', type: 'integer', required: true, example: '1' };

export const endpoints: readonly Endpoint[] = [
  {
    id: 'register',
    method: 'POST',
    path: '/auth/register',
    summary: 'Register User',
    auth: false,
    params: [],
    body: json({
      login: 'new_scientist',
      email: 'new.scientist@example.org',
      first_name: 'Nova',
      last_name: 'Reyes',
      orcid_id: '0000-0002-5555-0042',
      password: 'correct-horse-42',
    }),
  },
  { id: 'login', method: 'POST', path: '/auth/login', summary: 'Login', auth: false, params: [], body: json(DEMO_LOGIN) },
  { id: 'me', method: 'GET', path: '/users/me', summary: 'Read Current User', auth: true, params: [] },
  {
    id: 'interests',
    method: 'PUT',
    path: '/users/interests',
    summary: 'Update User Interests',
    auth: false,
    params: [],
    body: json({ login: DEMO_LOGIN.login_or_email, interests_list: ['Machine Learning', 'Radiology', 'Genomics'] }),
  },
  {
    id: 'upload',
    method: 'POST',
    path: '/users/{user_id}/publications/upload',
    summary: 'Upload Publications',
    auth: false,
    params: [userId],
    body: { kind: 'file' },
  },
  { id: 'publications', method: 'GET', path: '/users/{user_id}/publications', summary: 'Get User Publications', auth: false, params: [userId] },
  {
    id: 'delete',
    method: 'DELETE',
    path: '/users/{user_id}/publications/{publication_id}',
    summary: 'Delete User Publication',
    auth: false,
    params: [userId, { name: 'publication_id', in: 'path', type: 'integer', required: true, example: '2' }],
  },
  {
    id: 'search',
    method: 'GET',
    path: '/search',
    summary: 'Search Users And Authors',
    auth: false,
    params: [{ name: 'query', in: 'query', type: 'string', required: true, minLength: 2, example: 'mor' }, limit],
  },
  {
    id: 'search-users',
    method: 'GET',
    path: '/search/users',
    summary: 'Search Registered Users',
    auth: false,
    params: [{ name: 'username', in: 'query', type: 'string', required: true, minLength: 2, example: 'mo' }, limit],
  },
  {
    id: 'search-authors',
    method: 'GET',
    path: '/search/authors',
    summary: 'Search Unregistered Authors',
    auth: false,
    params: [{ name: 'name', in: 'query', type: 'string', required: true, minLength: 2, example: 'zhou' }, limit],
  },
  {
    id: 'author-interests',
    method: 'GET',
    path: '/authors/{author_id}/interests',
    summary: 'Get Author Interests',
    auth: false,
    params: [{ name: 'author_id', in: 'path', type: 'string', required: true, example: 'f20eae610ef8' }],
  },
  {
    id: 'profile',
    method: 'GET',
    path: '/authors/{author_id}/profile',
    summary: 'Get Scientist Profile',
    auth: false,
    params: [{ name: 'author_id', in: 'path', type: 'string', required: true, example: 'aadc2baaccdb' }],
  },
  { id: 'health', method: 'GET', path: '/health', summary: 'Health Check', auth: false, params: [] },
  {
    id: 'recommend',
    method: 'POST',
    path: '/recommend',
    summary: 'Get Recommendations',
    auth: false,
    params: [],
    body: json({ interests: ['Machine Learning', 'Radiology'], num_recommendations: 3 }),
  },
  { id: 'knowledge-graph', method: 'GET', path: '/knowledge-graph', summary: 'Get Knowledge Graph', auth: true, params: [] },
];
