// Мини-Pydantic для демо ApiExplorer (SPEC.md §7.7): ровно те проверки, что задают schemas.py и Query(...) в main.py
// бэкенда Academic Profile, с ошибками в формате FastAPI 422 (Pydantic v2, режим python, как у FastAPI после json.loads).

export type Loc = (string | number)[];

export interface ErrorDetail {
  type: string;
  loc: Loc;
  msg: string;
  input: unknown;
  ctx?: Record<string, unknown>;
}

export type FieldType = 'str' | 'int' | 'list_str' | 'email';

export interface Field {
  name: string;
  type: FieldType;
  /** Нет значения по умолчанию — поле обязательное. */
  required: boolean;
  /** Optional[...]: null допустим. */
  nullable?: boolean;
  default?: unknown;
  minLength?: number;
  maxLength?: number;
  ge?: number;
  le?: number;
}

const strLen = (s: string) => [...s].length;

/** Целое из строки, как int в Pydantic: знак, цифры, подчёркивания между цифрами, пробелы по краям. */
function parseIntStr(s: string): number | null {
  const m = /^\s*([+-]?\d+(?:_\d+)*)\s*$/.exec(s);
  return m ? Number(m[1]!.replaceAll('_', '')) : null;
}

const INT_PARSING = 'Input should be a valid integer, unable to parse string as an integer';

function checkInt(v: unknown, f: Field, loc: Loc, errors: ErrorDetail[]): number | undefined {
  let n: number | null = null;
  if (typeof v === 'boolean') n = Number(v);
  else if (typeof v === 'number') {
    if (!Number.isFinite(v)) {
      errors.push({ type: 'finite_number', loc, msg: 'Input should be a finite number', input: v });
      return;
    }
    if (!Number.isInteger(v)) {
      errors.push({ type: 'int_from_float', loc, msg: 'Input should be a valid integer, got a number with a fractional part', input: v });
      return;
    }
    n = v;
  } else if (typeof v === 'string') {
    n = parseIntStr(v);
    if (n === null) {
      errors.push({ type: 'int_parsing', loc, msg: INT_PARSING, input: v });
      return;
    }
  } else {
    errors.push({ type: 'int_type', loc, msg: 'Input should be a valid integer', input: v });
    return;
  }
  if (f.ge !== undefined && n < f.ge) {
    errors.push({ type: 'greater_than_equal', loc, msg: `Input should be greater than or equal to ${f.ge}`, input: v, ctx: { ge: f.ge } });
    return;
  }
  if (f.le !== undefined && n > f.le) {
    errors.push({ type: 'less_than_equal', loc, msg: `Input should be less than or equal to ${f.le}`, input: v, ctx: { le: f.le } });
    return;
  }
  return n;
}

function checkStr(v: unknown, f: Field, loc: Loc, errors: ErrorDetail[]): string | undefined {
  if (typeof v !== 'string') {
    errors.push({ type: 'string_type', loc, msg: 'Input should be a valid string', input: v });
    return;
  }
  const n = strLen(v);
  if (f.minLength !== undefined && n < f.minLength) {
    const s = f.minLength === 1 ? '' : 's';
    errors.push({ type: 'string_too_short', loc, msg: `String should have at least ${f.minLength} character${s}`, input: v, ctx: { min_length: f.minLength } });
    return;
  }
  if (f.maxLength !== undefined && n > f.maxLength) {
    const s = f.maxLength === 1 ? '' : 's';
    errors.push({ type: 'string_too_long', loc, msg: `String should have at most ${f.maxLength} character${s}`, input: v, ctx: { max_length: f.maxLength } });
    return;
  }
  return v;
}

// --- EmailStr: проверки email-validator 2.x в том порядке, в каком он их делает (сначала часть до @, потом после) ---

const ATEXT = /^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~.]$/;
const SPECIAL_USE = ['arpa', 'invalid', 'local', 'localhost', 'onion', 'test'];

/** Как safe_character_display: печатный символ — в кавычках, пробельный — именем Unicode. */
function display(c: string): string {
  const names: Record<string, string> = { ' ': 'SPACE', '\t': 'CHARACTER TABULATION', '\n': 'LINE FEED (LF)', '\r': 'CARRIAGE RETURN (CR)', ' ': 'NO-BREAK SPACE' };
  return names[c] ?? `'${c}'`;
}

const badChars = (chars: string[]) => [...new Set(chars)].sort().map(display).join(', ');

/** Нормализованный адрес или причина отказа (текст email-validator). */
export function checkEmail(email: string): { ok: string } | { reason: string } {
  const at = email.indexOf('@');
  if (at < 0) return { reason: 'An email address must have an @-sign.' };
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local) return { reason: 'There must be something before the @-sign.' };
  if (!domain) return { reason: 'There must be something after the @-sign.' };

  const badLocal = [...local].filter((c) => (c.charCodeAt(0) < 128 ? !ATEXT.test(c) : /\s/u.test(c)));
  if (badLocal.length) return { reason: `The email address contains invalid characters before the @-sign: ${badChars(badLocal)}.` };
  if (strLen(local) > 64) return { reason: `The email address is too long before the @-sign (${strLen(local) - 64} characters too many).` };
  if (local.startsWith('.')) return { reason: 'An email address cannot start with a period.' };
  if (local.endsWith('.')) return { reason: 'An email address cannot have a period immediately before the @-sign.' };
  if (local.includes('..')) return { reason: 'An email address cannot have two periods in a row.' };

  const badDomain = [...domain].filter((c) => (c.charCodeAt(0) < 128 ? !/[A-Za-z0-9.-]/.test(c) : /\s/u.test(c)));
  if (badDomain.length) return { reason: `The part after the @-sign contains invalid characters: ${badChars(badDomain)}.` };
  if (domain.endsWith('.')) return { reason: 'An email address cannot end with a period.' };
  if (domain.startsWith('.')) return { reason: 'An email address cannot have a period immediately after the @-sign.' };
  if (domain.includes('..')) return { reason: 'An email address cannot have two periods in a row.' };
  if (domain.startsWith('-')) return { reason: 'An email address cannot have a hyphen immediately after the @-sign.' };
  const lower = domain.toLowerCase();
  if (!lower.includes('.')) return { reason: 'The part after the @-sign is not valid. It should have a period.' };
  if (SPECIAL_USE.some((d) => lower === d || lower.endsWith(`.${d}`))) {
    return { reason: 'The part after the @-sign is a special-use or reserved name that cannot be used with email.' };
  }
  return { ok: `${local}@${lower}` };
}

function checkField(v: unknown, f: Field, loc: Loc, errors: ErrorDetail[]): unknown {
  if (v === null && f.nullable) return null;
  switch (f.type) {
    case 'str':
      return checkStr(v, f, loc, errors);
    case 'int':
      return checkInt(v, f, loc, errors);
    case 'email': {
      const s = checkStr(v, f, loc, errors);
      if (s === undefined) return;
      const r = checkEmail(s);
      if ('ok' in r) return r.ok;
      errors.push({ type: 'value_error', loc, msg: `value is not a valid email address: ${r.reason}`, input: v, ctx: { reason: r.reason } });
      return;
    }
    case 'list_str': {
      if (!Array.isArray(v)) {
        errors.push({ type: 'list_type', loc, msg: 'Input should be a valid list', input: v });
        return;
      }
      const out = v.map((item, i) => checkStr(item, { name: String(i), type: 'str', required: true }, [...loc, i], errors));
      return out.includes(undefined) ? undefined : out;
    }
  }
}

/** Тело-модель: объект, поля по порядку схемы; лишние поля игнорируются. */
export function validateBody(raw: unknown, fields: readonly Field[], errors: ErrorDetail[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push({ type: 'model_attributes_type', loc: ['body'], msg: 'Input should be a valid dictionary or object to extract fields from', input: raw });
    return out;
  }
  const obj = raw as Record<string, unknown>;
  for (const f of fields) {
    if (!(f.name in obj)) {
      if (f.required) errors.push({ type: 'missing', loc: ['body', f.name], msg: 'Field required', input: raw });
      else out[f.name] = f.default ?? null;
      continue;
    }
    out[f.name] = checkField(obj[f.name], f, ['body', f.name], errors);
  }
  return out;
}

/** Параметр пути или запроса: всегда строка на входе. */
export function validateParam(raw: string | undefined, f: Field, where: 'path' | 'query', errors: ErrorDetail[]): unknown {
  const loc = [where, f.name];
  if (raw === undefined) {
    if (f.required) errors.push({ type: 'missing', loc, msg: 'Field required', input: null });
    return f.default;
  }
  return checkField(raw, f, loc, errors);
}

// --- схемы из schemas.py ---

const optStr = (name: string): Field => ({ name, type: 'str', required: false, nullable: true, default: null });

export const USER_CREATE: readonly Field[] = [
  { name: 'login', type: 'str', required: true, minLength: 3, maxLength: 255 },
  { name: 'email', type: 'email', required: true },
  { name: 'first_name', type: 'str', required: true },
  { name: 'last_name', type: 'str', required: true },
  optStr('google_scholar_id'),
  optStr('scopus_id'),
  optStr('wos_id'),
  optStr('rsci_id'),
  optStr('orcid_id'),
  optStr('interests_list'),
  { name: 'password', type: 'str', required: true, minLength: 8 },
];

export const USER_LOGIN: readonly Field[] = [
  { name: 'login_or_email', type: 'str', required: true },
  { name: 'password', type: 'str', required: true },
];

export const UPDATE_INTERESTS: readonly Field[] = [
  { name: 'login', type: 'str', required: true, minLength: 3 },
  { name: 'interests_list', type: 'list_str', required: true },
];

export const RECOMMENDATION_REQUEST: readonly Field[] = [
  { name: 'interests', type: 'list_str', required: true },
  { name: 'publications', type: 'list_str', required: false, nullable: true, default: null },
  { name: 'num_recommendations', type: 'int', required: false, default: 10, ge: 1, le: 100 },
];
