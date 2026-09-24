/**
 * Граф превращений оксида алюминия — выгрузка таблиц БД проекта SIBUR (github.com/MakarON-228/sibur-ml,
 * `data/chemicalobjects.csv` и `data/chemicaloperations.csv`), на которых работала система подбора сырья (Jul 2025).
 * Id, формулы, молярные массы, исходники, температуры и строки условий — как в БД, без правок.
 *
 * Сверх БД добавлены только подписи для сайта: `label` — формула в Unicode, `name` — название минерала.
 * В БД γ(η)-Al₂O₃ записан как `\gamma(n)`; на схеме (reference/alumina-scheme.png) это γ(η).
 *
 * `formula` оставлена в записи БД: по ней `al_coeff` пайплайна считает атомы Al (символ через три после «Al»).
 * `sourceCheck` — вещество есть на складе как сырьё; с его реакций начинается поиск цепочек.
 */

export interface Substance {
  id: number;
  formula: string; // chemical_formula из БД
  label: string;
  name?: string;
  sourceCheck: boolean;
  molarMass: number; // г/моль, как в БД
}

export interface Reaction {
  id: number;
  sources: readonly number[]; // source_id из БД — у реакций 7 и 12 несколько исходников
  target: number;
  temperature: number; // °C
  conditions: string | null; // additional_conditions из БД, как записано
}

export const substances: readonly Substance[] = [
  { id: 1, formula: '\\theta-Al_2O_3 (H_2O)', label: 'θ-Al₂O₃ (H₂O)', sourceCheck: false, molarMass: 102 },
  { id: 2, formula: '\\alpha-Al_2O_3', label: 'α-Al₂O₃', name: 'corundum', sourceCheck: false, molarMass: 102 },
  { id: 3, formula: '\\gamma-Al(OH)_3', label: 'γ-Al(OH)₃', name: 'gibbsite', sourceCheck: true, molarMass: 78 },
  { id: 4, formula: '\\chi-Al_2O_3 (H_2O)', label: 'χ-Al₂O₃ (H₂O)', sourceCheck: false, molarMass: 102 },
  { id: 5, formula: '\\kappa-Al_2O_3 (H_2O)', label: 'κ-Al₂O₃ (H₂O)', sourceCheck: false, molarMass: 102 },
  { id: 8, formula: '\\alpha-Al(OH)_3', label: 'α-Al(OH)₃', name: 'bayerite', sourceCheck: true, molarMass: 78 },
  { id: 9, formula: '\\eta-Al_2O_3 (H_2O)', label: 'η-Al₂O₃ (H₂O)', sourceCheck: false, molarMass: 102 },
  { id: 11, formula: '\\rho-Al_2O_3 (H_2O)', label: 'ρ-Al₂O₃ (H₂O)', sourceCheck: false, molarMass: 102 },
  { id: 12, formula: '\\gamma(n)-Al_2O_3 (H_2O)', label: 'γ(η)-Al₂O₃ (H₂O)', sourceCheck: false, molarMass: 102 },
  {
    id: 13,
    formula: 'Al(OH)_3 (amorphous-alumina-hydroxide)',
    label: 'Al(OH)₃',
    name: 'amorphous',
    sourceCheck: true,
    molarMass: 78,
  },
  { id: 14, formula: '\\gamma-AlO(OH)', label: 'γ-AlO(OH)', name: 'boehmite', sourceCheck: true, molarMass: 60 },
  { id: 15, formula: '\\alpha-AlO(OH)', label: 'α-AlO(OH)', name: 'diaspore', sourceCheck: true, molarMass: 60 },
  { id: 16, formula: '\\gamma-Al_2O_3 (H_2O)', label: 'γ-Al₂O₃ (H₂O)', sourceCheck: false, molarMass: 102 },
  { id: 17, formula: '\\delta-Al_2O_3 (H_2O)', label: 'δ-Al₂O₃ (H₂O)', sourceCheck: false, molarMass: 102 },
  { id: 19, formula: 'Al_2O_3', label: 'Al₂O₃', sourceCheck: true, molarMass: 102 },
  { id: 20, formula: '\\i-Al_2O_3', label: 'i-Al₂O₃', sourceCheck: false, molarMass: 102 },
  { id: 10, formula: 'Al(OH)_3 (nordstrandite)', label: 'Al(OH)₃', name: 'nordstrandite', sourceCheck: true, molarMass: 78 },
];

export const reactions: readonly Reaction[] = [
  { id: 1, sources: [1], target: 2, temperature: 1200, conditions: null },
  { id: 2, sources: [3], target: 4, temperature: 230, conditions: null },
  { id: 3, sources: [4], target: 5, temperature: 900, conditions: 'stab. by M+' },
  { id: 4, sources: [5], target: 2, temperature: 1200, conditions: null },
  { id: 5, sources: [9], target: 1, temperature: 850, conditions: null },
  { id: 6, sources: [8], target: 9, temperature: 230, conditions: null },
  { id: 7, sources: [3, 8, 10], target: 11, temperature: 230, conditions: 'vacuum' },
  { id: 10, sources: [11], target: 12, temperature: 850, conditions: null },
  { id: 11, sources: [12], target: 1, temperature: 750, conditions: null },
  { id: 12, sources: [3, 13], target: 14, temperature: 300, conditions: '70-90MPa, hydrotermal process' },
  { id: 14, sources: [15], target: 2, temperature: 1200, conditions: null },
  { id: 15, sources: [14], target: 16, temperature: 450, conditions: null },
  { id: 16, sources: [16], target: 17, temperature: 600, conditions: null },
  { id: 17, sources: [17], target: 1, temperature: 1050, conditions: null },
  { id: 18, sources: [14], target: 2, temperature: 450, conditions: '70-90MPa, hydrotermal process' },
  { id: 19, sources: [19], target: 16, temperature: 2300, conditions: 'nonequilibrium crystallization' },
  { id: 20, sources: [19], target: 20, temperature: 2100, conditions: '+SiO_2 microimpurity' },
];

/** Подписи условий для сайта: строки БД с Unicode-индексами и без опечатки `hydrotermal`. */
export const conditionLabels: Readonly<Record<string, string>> = {
  'stab. by M+': 'stab. by M⁺',
  vacuum: 'vacuum',
  '70-90MPa, hydrotermal process': '70–90 MPa, hydrothermal process',
  'nonequilibrium crystallization': 'nonequilibrium crystallization',
  '+SiO_2 microimpurity': '+ SiO₂ microimpurity',
};

/** Цель по умолчанию — α-Al₂O₃ (корунд), как в запуске ноутбука. */
export const CORUNDUM = 2;
