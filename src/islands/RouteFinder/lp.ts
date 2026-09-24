// Линейная программа для подбора масс (SPEC.md §7.8). В пайплайне её решал PuLP (CBC); здесь — плотный двухфазный
// симплекс: задачи крошечные (до 7 партий и 15 ограничений), а библиотека не нужна острову.
// Строки масштабируются к max |a| = 1 — коэффициенты примесей порядка 1e-6, без этого допуски теряли бы смысл.
// Правило Бланда (наименьший индекс и на входе, и на выходе) исключает зацикливание на вырожденных вершинах.

export interface Constraint {
  a: readonly number[];
  op: '<=' | '>=' | '=';
  b: number;
}

export type LpResult = { status: 'optimal'; x: number[]; value: number } | { status: 'infeasible' } | { status: 'unbounded' };

const EPS = 1e-9;

/** min c·x при ограничениях и x ≥ 0. */
export function minimize(c: readonly number[], constraints: readonly Constraint[]): LpResult {
  const n = c.length;

  // Нормализация: масштаб строки, b ≥ 0. Пустая строка (0 op b) проверяется сразу.
  const rows: Constraint[] = [];
  for (const { a, op, b } of constraints) {
    const scale = Math.max(0, ...a.map(Math.abs));
    if (scale < EPS) {
      const ok = op === '<=' ? b >= -EPS : op === '>=' ? b <= EPS : Math.abs(b) <= EPS;
      if (!ok) return { status: 'infeasible' };
      continue;
    }
    const sign = b < 0 ? -1 : 1;
    const flipped = sign < 0 && op !== '=' ? (op === '<=' ? '>=' : '<=') : op;
    rows.push({ a: a.map((v) => (sign * v) / scale), op: flipped, b: (sign * b) / scale });
  }

  // Столбцы: x, затем по добавочной на каждое неравенство, затем искусственные для ≥ и =.
  const m = rows.length;
  const slackOf = rows.map(() => -1);
  let cols = n;
  rows.forEach((r, i) => {
    if (r.op !== '=') slackOf[i] = cols++;
  });
  const firstArtificial = cols;
  const artificialOf = rows.map(() => -1);
  rows.forEach((r, i) => {
    if (r.op !== '<=') artificialOf[i] = cols++;
  });
  const rhs = cols;

  const t: number[][] = rows.map((r, i) => {
    const row = new Array<number>(cols + 1).fill(0);
    r.a.forEach((v, j) => (row[j] = v));
    if (slackOf[i]! >= 0) row[slackOf[i]!] = r.op === '<=' ? 1 : -1;
    if (artificialOf[i]! >= 0) row[artificialOf[i]!] = 1;
    row[rhs] = r.b;
    return row;
  });
  const basis = rows.map((r, i) => (r.op === '<=' ? slackOf[i]! : artificialOf[i]!));

  const pivot = (pr: number, pc: number) => {
    const p = t[pr]!;
    const k = p[pc]!;
    for (let j = 0; j <= cols; j++) p[j]! /= k;
    for (let i = 0; i < t.length; i++) {
      if (i === pr) continue;
      const f = t[i]![pc]!;
      if (Math.abs(f) < EPS) continue;
      const row = t[i]!;
      for (let j = 0; j <= cols; j++) row[j]! -= f * p[j]!;
    }
    basis[pr] = pc;
  };

  /** Симплекс по правилу Бланда для стоимости `cost` на столбцах `0…limit-1`. */
  const optimize = (cost: readonly number[], limit: number): 'optimal' | 'unbounded' => {
    for (;;) {
      let enter = -1;
      for (let j = 0; j < limit && enter < 0; j++) {
        let d = cost[j]!;
        for (let i = 0; i < t.length; i++) d -= cost[basis[i]!]! * t[i]![j]!;
        if (d < -EPS) enter = j;
      }
      if (enter < 0) return 'optimal';
      let leave = -1;
      let best = Infinity;
      for (let i = 0; i < t.length; i++) {
        const v = t[i]![enter]!;
        if (v <= EPS) continue;
        const ratio = t[i]![rhs]! / v;
        if (ratio < best - EPS || (ratio <= best + EPS && basis[i]! < basis[leave]!)) {
          best = ratio;
          leave = i;
        }
      }
      if (leave < 0) return 'unbounded';
      pivot(leave, enter);
    }
  };

  // Фаза 1: сумма искусственных → 0, иначе допустимых точек нет.
  const phase1 = Array.from({ length: cols }, (_, j) => (j >= firstArtificial ? 1 : 0));
  optimize(phase1, cols);
  const infeasibility = t.reduce((s, row, i) => s + phase1[basis[i]!]! * row[rhs]!, 0);
  if (infeasibility > 1e-7 * Math.max(1, m)) return { status: 'infeasible' };

  // Искусственные, оставшиеся в базисе на нуле, выводим; строка без других ненулевых — лишняя, убираем.
  for (let i = t.length - 1; i >= 0; i--) {
    if (basis[i]! < firstArtificial) continue;
    const j = t[i]!.findIndex((v, k) => k < firstArtificial && Math.abs(v) > EPS);
    if (j >= 0) pivot(i, j);
    else {
      t.splice(i, 1);
      basis.splice(i, 1);
    }
  }

  // Фаза 2: исходная цель, искусственные столбцы больше не входят.
  const phase2 = Array.from({ length: cols }, (_, j) => (j < n ? c[j]! : 0));
  if (optimize(phase2, firstArtificial) === 'unbounded') return { status: 'unbounded' };

  const x = new Array<number>(n).fill(0);
  basis.forEach((j, i) => {
    if (j < n) x[j] = t[i]![rhs]!;
  });
  return { status: 'optimal', x, value: x.reduce((s, v, j) => s + v * c[j]!, 0) };
}
