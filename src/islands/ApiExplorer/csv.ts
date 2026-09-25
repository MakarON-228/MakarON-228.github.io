// Разбор CSV так, как его видит обработчик загрузки публикаций: pd.read_csv(encoding='utf-8-sig') и затем
// str(row[col]) по строкам df.iterrows(). Отсюда причуды оригинала: «NA», «N/A», «nan» и пустые ячейки — NaN;
// колонка из целых с пропуском становится float и отдаёт «2021.0»; «007» в целой колонке — «7».

/** Значение ячейки после str(): строка или null для NaN. */
export type Cell = string | null;

export interface Frame {
  columns: string[];
  rows: Cell[][];
}

export class CsvError extends Error {}

// Значения, которые pandas по умолчанию читает как NaN
const NA = new Set(['', '#N/A', '#N/A N/A', '#NA', '-1.#IND', '-1.#QNAN', '-NaN', '-nan', '1.#IND', '1.#QNAN', '<NA>', 'N/A', 'NA', 'NULL', 'NaN', 'None', 'n/a', 'nan', 'null']);
const INT = /^\s*[+-]?\d+\s*$/;
const FLOAT = /^\s*[+-]?(?:(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|inf(?:inity)?)\s*$/i;
const BOOL: Record<string, boolean> = { True: true, TRUE: true, true: true, False: false, FALSE: false, false: false };

/** repr(float) в Python: кратчайшие цифры, экспонента при порядке < −4 или ≥ 16, у целых — «.0». */
export function pyFloat(x: number): string {
  if (Number.isNaN(x)) return 'nan';
  if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
  const [mant, expStr] = x.toExponential().split('e') as [string, string];
  const exp = Number(expStr);
  const neg = mant.startsWith('-');
  const digits = mant.replace('-', '').replace('.', '');
  const sign = neg ? '-' : '';
  if (exp < -4 || exp >= 16) {
    const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    return `${sign}${m}e${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`;
  }
  if (exp < 0) return `${sign}0.${'0'.repeat(-exp - 1)}${digits}`;
  const int = digits.slice(0, exp + 1).padEnd(exp + 1, '0');
  const frac = digits.slice(exp + 1);
  return `${sign}${int}.${frac || '0'}`;
}

/** Записи CSV: кавычки с удвоением, разделитель «,», переводы строк LF, CRLF и CR. */
function records(text: string): { fields: string[]; line: number }[] {
  const out: { fields: string[]; line: number }[] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let start = 1;
  let blank = true;
  const endRecord = () => {
    fields.push(field);
    // Пустые строки pandas пропускает (skip_blank_lines)
    if (!(blank && fields.length === 1 && field === '')) out.push({ fields, line: start });
    fields = [];
    field = '';
    blank = true;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else {
        if (c === '\n') line++;
        field += c;
      }
      continue;
    }
    if (c === '"') {
      quoted = true;
      blank = false;
    } else if (c === ',') {
      fields.push(field);
      field = '';
      blank = false;
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRecord();
      line++;
      start = line;
    } else {
      field += c;
      blank = false;
    }
  }
  if (field !== '' || fields.length || !blank) endRecord();
  return out;
}

type Kind = 'int' | 'float' | 'bool' | 'object';

/** pd.read_csv + str(): заголовок из первой непустой строки, выведенные типы колонок, NaN → null. */
export function readCsv(text: string): Frame {
  const recs = records(text.startsWith('﻿') ? text.slice(1) : text);
  if (!recs.length) throw new CsvError('No columns to parse from file');
  const [head, ...body] = recs as [(typeof recs)[number], ...typeof recs];

  // Пустое имя — «Unnamed: i», повтор — «name.1», как у pandas
  const seen = new Map<string, number>();
  const columns = head.fields.map((name, i) => {
    let n = name === '' ? `Unnamed: ${i}` : name;
    const k = seen.get(n) ?? 0;
    seen.set(name, k + 1);
    if (k) n = `${n}.${k}`;
    return n;
  });

  const raw = body.map(({ fields, line }) => {
    if (fields.length > columns.length) {
      throw new CsvError(`Error tokenizing data. C error: Expected ${columns.length} fields in line ${line}, saw ${fields.length}\n`);
    }
    return columns.map((_, j) => {
      const v = fields[j];
      return v === undefined || NA.has(v) ? null : v;
    });
  });

  const kinds: Kind[] = columns.map((_, j) => {
    const vals = raw.map((r) => r[j]).filter((v): v is string => v !== null);
    const hasNa = vals.length < raw.length;
    if (!vals.length) return 'float';
    if (vals.every((v) => INT.test(v))) return hasNa ? 'float' : 'int';
    if (vals.every((v) => FLOAT.test(v))) return 'float';
    if (vals.every((v) => v in BOOL)) return 'bool';
    return 'object';
  });
  // df.iterrows() приводит строку к общему типу: только целые — int, целые и float — float, иначе object
  const rowKind: Kind = kinds.every((k) => k === 'int') ? 'int' : kinds.every((k) => k === 'int' || k === 'float') ? 'float' : 'object';

  const rows = raw.map((r) =>
    r.map((v, j): Cell => {
      if (v === null) return null;
      const kind = kinds[j];
      if (kind === 'int') return rowKind === 'float' ? pyFloat(Number(v)) : String(Number(v));
      if (kind === 'float') return pyFloat(/inf/i.test(v) ? (v.includes('-') ? -Infinity : Infinity) : Number(v));
      if (kind === 'bool') return BOOL[v] ? 'True' : 'False';
      return v;
    }),
  );
  return { columns, rows };
}

/** str.strip() Python: пробельные символы Unicode по краям. */
export const pyStrip = (s: string) => s.replace(/^[\s\u001c-\u001f\u0085]+|[\s\u001c-\u001f\u0085]+$/gu, '');

/** Декодирование UTF-8 со строгой проверкой; ошибка — в словах Python-кодека. */
export function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    let pos = 0;
    while (pos < bytes.length) {
      const b = bytes[pos]!;
      const len = b < 0x80 ? 1 : b >= 0xc2 && b <= 0xdf ? 2 : b >= 0xe0 && b <= 0xef ? 3 : b >= 0xf0 && b <= 0xf4 ? 4 : 0;
      const hex = `0x${b.toString(16).padStart(2, '0')}`;
      if (!len) throw new CsvError(`'utf-8' codec can't decode byte ${hex} in position ${pos}: invalid start byte`);
      for (let k = 1; k < len; k++) {
        const c = bytes[pos + k];
        if (c === undefined) throw new CsvError(`'utf-8' codec can't decode byte ${hex} in position ${pos}: unexpected end of data`);
        if ((c & 0xc0) !== 0x80) throw new CsvError(`'utf-8' codec can't decode byte ${hex} in position ${pos}: invalid continuation byte`);
      }
      pos += len;
    }
    throw new CsvError("'utf-8' codec can't decode the file");
  }
}
