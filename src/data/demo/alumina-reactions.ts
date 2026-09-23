/**
 * Схема превращений кристаллических модификаций оксида алюминия.
 * Перенесено вручную со схемы «Рисунок 1.2.1 — Развернутая схема превращений, приводящих к образованию
 * различных кристаллических модификаций оксида алюминия» (reference/alumina-scheme.png) —
 * реакции, с которыми работала система подбора сырья (SIBUR, Jul 2025).
 *
 * Правила переноса:
 * - Одинаково записанные вещества — один узел (θ-Al₂O₃ (H₂O) встречается в четырёх цепочках, γ-AlO(OH) — в двух).
 * - γ-Al₂O₃ из высокотемпературного расплава — отдельный узел от γ-Al₂O₃ (H₂O): на схеме у них разное
 *   происхождение, и из «расплавной» γ дальнейших превращений не нарисовано. Склеивать нельзя — появятся
 *   маршруты, которых на схеме нет.
 * - γ-Al₂O₃ (H₂O) — один узел в цепочках 6 и 7, поэтому прямой переход γ → θ из цепочки 7 доступен и для γ,
 *   полученной из бёмита (маршрут boehmite → γ → θ → α без δ). Это следствие схемы, а не ошибка.
 * - Там, где на схеме условия не указаны (цепочка Al(MOₙ)₃ и первая стрелка расплава с SiO₂), поле пустое.
 *
 * Массовые коэффициенты — кг исходного вещества на 1 кг продукта, по молярным массам
 * Al(OH)₃ = 78.003, AlO(OH) = 59.988, Al₂O₃ = 101.961 г/моль:
 *   2 Al(OH)₃ → Al₂O₃ + 3 H₂O   → 1.5301
 *     Al(OH)₃ → AlO(OH) + H₂O   → 1.3003
 *   2 AlO(OH) → Al₂O₃ + H₂O     → 1.1767
 *   Al₂O₃ → Al₂O₃ (смена модификации) → 1.0  (остаточная вода «(H₂O)» в расчёте не учитывается)
 * Для Al(MOₙ)₃ молярная масса не определена (M и n не заданы) → коэффициент null, масса по такому
 * маршруту не считается.
 */

export type Family = 'hydroxide' | 'oxyhydroxide' | 'oxide' | 'precursor' | 'melt';

export interface Substance {
  id: string;
  label: string;          // как на схеме, с Unicode-индексами
  family: Family;
  note?: string;
}

export interface Transition {
  from: string;
  to: string;
  tempC: number | null;   // температура над стрелкой; null — на схеме не указана
  pressure?: string;      // «70–90 MPa»
  hydrothermal?: boolean;
  vacuum?: boolean;
  process?: string;       // для кристаллизации из расплава
  massFactor: number | null; // кг исходного на 1 кг продукта
}

export const substances: Substance[] = [
  // гидроксиды Al(OH)₃
  { id: 'bayerite',      label: 'α-Al(OH)₃ (bayerite)',      family: 'hydroxide' },
  { id: 'gibbsite',      label: 'γ-Al(OH)₃ (gibbsite)',      family: 'hydroxide' },
  { id: 'nordstrandite', label: 'Al(OH)₃ (nordstrandite)',   family: 'hydroxide' },
  { id: 'amorphous',     label: 'Al(OH)₃ (amorphous)',       family: 'hydroxide' },
  // оксигидроксиды AlO(OH)
  { id: 'boehmite',      label: 'γ-AlO(OH) (boehmite)',      family: 'oxyhydroxide' },
  { id: 'diaspore',      label: 'α-AlO(OH) (diaspore)',      family: 'oxyhydroxide' },
  // переходные оксиды
  { id: 'eta',       label: 'η-Al₂O₃ (H₂O)',              family: 'oxide' },
  { id: 'chi',       label: 'χ-Al₂O₃ (M⁺, H₂O)',          family: 'oxide', note: 'stabilized by M⁺ microimpurities' },
  { id: 'kappa',     label: 'κ-Al₂O₃ (M⁺, H₂O)',          family: 'oxide', note: 'stabilized by M⁺ microimpurities' },
  { id: 'rho',       label: 'ρ-Al₂O₃ (H₂O)',              family: 'oxide' },
  { id: 'gammaEta',  label: 'γ(η)-Al₂O₃ (H₂O)',           family: 'oxide' },
  { id: 'gamma',     label: 'γ-Al₂O₃ (H₂O)',              family: 'oxide' },
  { id: 'delta',     label: 'δ-Al₂O₃ (H₂O)',              family: 'oxide' },
  { id: 'theta',     label: 'θ-Al₂O₃ (H₂O)',              family: 'oxide' },
  { id: 'iota',      label: 'i-Al₂O₃',                    family: 'oxide' },
  { id: 'gammaMelt', label: 'γ-Al₂O₃ (from melt)',        family: 'oxide' },
  // конечный продукт
  { id: 'alpha',     label: 'α-Al₂O₃ (corundum)',         family: 'oxide' },
  // прекурсор и расплавы
  { id: 'alkoxide',  label: 'Al(MOₙ)₃',                   family: 'precursor' },
  { id: 'melt',      label: 'Al₂O₃ (melt)',               family: 'melt' },
  { id: 'htMelt',    label: 'Al₂O₃ (high-temperature melt)', family: 'melt' },
  { id: 'siMelt',    label: 'Al₂O₃ (melt + SiO₂ microimpurity)', family: 'melt' },
];

const OH3_TO_OXIDE = 1.5301;
const OH3_TO_OOH = 1.3003;
const OOH_TO_OXIDE = 1.1767;
const PHASE = 1.0;
const HYDRO = { pressure: '70–90 MPa', hydrothermal: true } as const;

export const transitions: Transition[] = [
  // 1. bayerite → η → θ → α
  { from: 'bayerite', to: 'eta',   tempC: 230,  massFactor: OH3_TO_OXIDE },
  { from: 'eta',      to: 'theta', tempC: 850,  massFactor: PHASE },
  { from: 'theta',    to: 'alpha', tempC: 1200, massFactor: PHASE },

  // 2. gibbsite → χ → κ → α
  { from: 'gibbsite', to: 'chi',   tempC: 230,  massFactor: OH3_TO_OXIDE },
  { from: 'chi',      to: 'kappa', tempC: 900,  massFactor: PHASE },
  { from: 'kappa',    to: 'alpha', tempC: 1200, massFactor: PHASE },

  // 3. {bayerite, gibbsite, nordstrandite} → ρ (вакуум) → γ(η) → θ → α
  { from: 'bayerite',      to: 'rho', tempC: 230, vacuum: true, massFactor: OH3_TO_OXIDE },
  { from: 'gibbsite',      to: 'rho', tempC: 230, vacuum: true, massFactor: OH3_TO_OXIDE },
  { from: 'nordstrandite', to: 'rho', tempC: 230, vacuum: true, massFactor: OH3_TO_OXIDE },
  { from: 'rho',      to: 'gammaEta', tempC: 850, massFactor: PHASE },
  { from: 'gammaEta', to: 'theta',    tempC: 750, massFactor: PHASE },
  // θ → α уже есть в цепочке 1

  // 4. {amorphous, gibbsite} → boehmite (гидротермально) → α (гидротермально)
  { from: 'amorphous', to: 'boehmite', tempC: 300, ...HYDRO, massFactor: OH3_TO_OOH },
  { from: 'gibbsite',  to: 'boehmite', tempC: 300, ...HYDRO, massFactor: OH3_TO_OOH },
  { from: 'boehmite',  to: 'alpha',    tempC: 450, ...HYDRO, massFactor: OOH_TO_OXIDE },

  // 5. diaspore → α
  { from: 'diaspore', to: 'alpha', tempC: 1200, massFactor: OOH_TO_OXIDE },

  // 6. boehmite → γ → δ → θ → α
  { from: 'boehmite', to: 'gamma', tempC: 450,  massFactor: OOH_TO_OXIDE },
  { from: 'gamma',    to: 'delta', tempC: 600,  massFactor: PHASE },
  { from: 'delta',    to: 'theta', tempC: 1050, massFactor: PHASE },

  // 7. Al(MOₙ)₃ → γ → θ → α — условия на схеме не указаны
  { from: 'alkoxide', to: 'gamma', tempC: null, massFactor: null },
  { from: 'gamma',    to: 'theta', tempC: null, massFactor: PHASE },

  // 8–10. расплавы
  { from: 'melt',   to: 'alpha',     tempC: null, process: 'equilibrium crystallization',    massFactor: PHASE },
  { from: 'htMelt', to: 'gammaMelt', tempC: null, process: 'nonequilibrium crystallization', massFactor: PHASE },
  { from: 'siMelt', to: 'iota',      tempC: null, massFactor: PHASE },
  { from: 'iota',   to: 'alpha',     tempC: 1300, massFactor: PHASE },
];

/**
 * Склад для демо — ВЫДУМАННЫЙ (Illustrative). Подобран так, чтобы 300 кг корунда закрывались одним
 * источником, а 450 кг требовали комбинации нескольких.
 */
export const demoStockKg: Record<string, number> = {
  gibbsite: 500,
  bayerite: 120,
  boehmite: 80,
  diaspore: 40,
  nordstrandite: 30,
  amorphous: 60,
};
