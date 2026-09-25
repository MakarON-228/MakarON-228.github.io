// Запрос из формы консоли ApiExplorer и его вид для человека: Request URL и curl в формате Swagger UI.
// Как Swagger, пустые необязательные поля не отправляются, а токен уходит только эндпоинтам с замком.
import type { Endpoint } from '../../data/demo/academic-endpoints';
import type { ApiRequest } from './server';

/** База из README бэкенда: так выглядит запрос к локально запущенному сервису. */
export const BASE_URL = 'http://localhost:8000';

export interface Form {
  params: Record<string, string>;
  body: string;
}

export interface FileInput {
  name: string;
  bytes: Uint8Array;
}

export const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  405: 'Method Not Allowed',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  503: 'Service Unavailable',
};

export function initialForm(ep: Endpoint): Form {
  return {
    params: Object.fromEntries(ep.params.map((p) => [p.name, p.example])),
    body: ep.body?.kind === 'json' ? ep.body.example : '',
  };
}

export interface Prepared {
  req: ApiRequest;
  url: string;
  curl: string;
}

/** Запрос для бэкенда и его вид в панели — снимок формы на момент отправки. */
export function prepare(ep: Endpoint, form: Form, file: FileInput | null, token: string | null): Prepared {
  const value = (name: string) => form.params[name] ?? '';
  const path = ep.path.replace(/\{(\w+)\}/g, (_, name: string) => value(name));
  const query: Record<string, string> = {};
  for (const p of ep.params) if (p.in === 'query' && value(p.name)) query[p.name] = value(p.name);
  const req: ApiRequest = {
    method: ep.method,
    path,
    query,
    body: ep.body?.kind === 'json' ? form.body : undefined,
    file: ep.body?.kind === 'file' && file ? file : undefined,
    authorization: ep.auth && token ? `Bearer ${token}` : undefined,
  };
  const qs = new URLSearchParams(query).toString();
  const url = `${BASE_URL}${ep.path.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(value(name)))}${qs ? `?${qs}` : ''}`;

  const lines = [`curl -X ${quote(ep.method)}`, quote(url), `-H ${quote('accept: application/json')}`];
  if (req.authorization) lines.push(`-H ${quote(`Authorization: ${req.authorization}`)}`);
  if (ep.body?.kind === 'json') {
    lines.push(`-H ${quote('Content-Type: application/json')}`);
    if (req.body) lines.push(`-d ${quote(req.body)}`);
  }
  if (ep.body?.kind === 'file') {
    lines.push(`-H ${quote('Content-Type: multipart/form-data')}`);
    if (req.file) lines.push(`-F ${quote(`file=@${req.file.name};type=text/csv`)}`);
  }
  return { req, url, curl: lines.join(' \\\n  ') };
}

const quote = (s: string) => `'${s.replaceAll("'", "'\\''")}'`;
