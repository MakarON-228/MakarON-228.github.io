/**
 * Склад для демо RouteFinder — ILLUSTRATIVE: тестовые данные команды проекта SIBUR, выгрузка таблицы `warehouse`
 * (github.com/MakarON-228/sibur-ml, `data/warehouse.csv`), без правок и в том же порядке.
 *
 * Партия — id, вид сырья (`type` = id вещества из alumina-reactions.ts) и состав в процентах: основное вещество и
 * примеси. Количеств на складе в таблице нет: пайплайн подбирает, сколько кг каждой партии взять.
 * Ключи состава — как в словаре партии в `notebooks/pipeline.ipynb`.
 */

export const COMPONENTS = ['main_percent', 'fe_percent', 'si_percent', 'k_percent', 'ca_percent', 'mg_percent', 'na_percent'] as const;
export type Component = (typeof COMPONENTS)[number];

export type Batch = { id: number; type: number } & Record<Component, number>;

export const warehouse: readonly Batch[] = [
  { id: 2, type: 3, main_percent: 98, fe_percent: 0.03, si_percent: 0.1, k_percent: 0.01, ca_percent: 0.02, mg_percent: 0.02, na_percent: 0.05 },
  { id: 5, type: 3, main_percent: 98.8, fe_percent: 0, si_percent: 0.123, k_percent: 0, ca_percent: 0.0223, mg_percent: 0.0121, na_percent: 0.0314 },
  { id: 4, type: 3, main_percent: 98.5, fe_percent: 0.029, si_percent: 0.438, k_percent: 0, ca_percent: 0.0194, mg_percent: 0, na_percent: 0.0032 },
  { id: 3, type: 3, main_percent: 99, fe_percent: 0, si_percent: 0.13, k_percent: 0.07, ca_percent: 0.11, mg_percent: 0, na_percent: 0 },
  { id: 26, type: 19, main_percent: 98.9, fe_percent: 0.01, si_percent: 0.1, k_percent: 0.03, ca_percent: 0.02, mg_percent: 0.01, na_percent: 0.01 },
  { id: 27, type: 19, main_percent: 99.1, fe_percent: 0, si_percent: 0.07, k_percent: 0.01, ca_percent: 0.01, mg_percent: 0, na_percent: 0 },
  { id: 28, type: 19, main_percent: 98.4, fe_percent: 0.02, si_percent: 0.18, k_percent: 0.04, ca_percent: 0.03, mg_percent: 0.01, na_percent: 0.01 },
  { id: 29, type: 19, main_percent: 98.7, fe_percent: 0.015, si_percent: 0.13, k_percent: 0.02, ca_percent: 0.02, mg_percent: 0.02, na_percent: 0.01 },
  { id: 30, type: 19, main_percent: 99.2, fe_percent: 0, si_percent: 0.05, k_percent: 0, ca_percent: 0.01, mg_percent: 0, na_percent: 0 },
  { id: 6, type: 8, main_percent: 98.7, fe_percent: 0.01, si_percent: 0.13, k_percent: 0.04, ca_percent: 0.05, mg_percent: 0.03, na_percent: 0.02 },
  { id: 7, type: 8, main_percent: 99.2, fe_percent: 0, si_percent: 0.09, k_percent: 0.02, ca_percent: 0.03, mg_percent: 0.01, na_percent: 0 },
  { id: 8, type: 8, main_percent: 98.5, fe_percent: 0.015, si_percent: 0.18, k_percent: 0.03, ca_percent: 0.07, mg_percent: 0.02, na_percent: 0.01 },
  { id: 9, type: 8, main_percent: 98.9, fe_percent: 0.005, si_percent: 0.05, k_percent: 0.01, ca_percent: 0.02, mg_percent: 0.01, na_percent: 0 },
  { id: 10, type: 8, main_percent: 99, fe_percent: 0, si_percent: 0.07, k_percent: 0.02, ca_percent: 0.04, mg_percent: 0.02, na_percent: 0.01 },
  { id: 11, type: 13, main_percent: 99.5, fe_percent: 0, si_percent: 0.02, k_percent: 0.01, ca_percent: 0.01, mg_percent: 0.01, na_percent: 0 },
  { id: 12, type: 13, main_percent: 98.9, fe_percent: 0.02, si_percent: 0.1, k_percent: 0.03, ca_percent: 0.02, mg_percent: 0.01, na_percent: 0.01 },
  { id: 13, type: 13, main_percent: 98.7, fe_percent: 0.01, si_percent: 0.14, k_percent: 0.05, ca_percent: 0.03, mg_percent: 0.02, na_percent: 0.01 },
  { id: 14, type: 13, main_percent: 99.1, fe_percent: 0, si_percent: 0.08, k_percent: 0.01, ca_percent: 0.01, mg_percent: 0, na_percent: 0 },
  { id: 15, type: 13, main_percent: 98.8, fe_percent: 0.03, si_percent: 0.12, k_percent: 0.04, ca_percent: 0.02, mg_percent: 0.01, na_percent: 0.01 },
  { id: 16, type: 14, main_percent: 99.3, fe_percent: 0.005, si_percent: 0.09, k_percent: 0.02, ca_percent: 0.01, mg_percent: 0, na_percent: 0 },
  { id: 17, type: 14, main_percent: 98.6, fe_percent: 0.01, si_percent: 0.17, k_percent: 0.06, ca_percent: 0.03, mg_percent: 0.01, na_percent: 0.01 },
  { id: 18, type: 14, main_percent: 99, fe_percent: 0.02, si_percent: 0.07, k_percent: 0.01, ca_percent: 0.01, mg_percent: 0.01, na_percent: 0 },
  { id: 19, type: 14, main_percent: 98.4, fe_percent: 0.015, si_percent: 0.2, k_percent: 0.05, ca_percent: 0.04, mg_percent: 0.03, na_percent: 0.02 },
  { id: 20, type: 14, main_percent: 99.1, fe_percent: 0.01, si_percent: 0.1, k_percent: 0.03, ca_percent: 0.02, mg_percent: 0.01, na_percent: 0.01 },
  { id: 21, type: 15, main_percent: 99, fe_percent: 0.01, si_percent: 0.06, k_percent: 0.02, ca_percent: 0.01, mg_percent: 0.01, na_percent: 0 },
  { id: 22, type: 15, main_percent: 98.5, fe_percent: 0.02, si_percent: 0.15, k_percent: 0.03, ca_percent: 0.03, mg_percent: 0.01, na_percent: 0.01 },
  { id: 23, type: 15, main_percent: 98.8, fe_percent: 0.005, si_percent: 0.09, k_percent: 0.01, ca_percent: 0.01, mg_percent: 0.02, na_percent: 0 },
  { id: 24, type: 15, main_percent: 99.3, fe_percent: 0, si_percent: 0.04, k_percent: 0, ca_percent: 0, mg_percent: 0, na_percent: 0 },
  { id: 25, type: 15, main_percent: 98.6, fe_percent: 0.03, si_percent: 0.12, k_percent: 0.04, ca_percent: 0.02, mg_percent: 0.01, na_percent: 0.01 },
  { id: 35, type: 10, main_percent: 99.2, fe_percent: 0.009, si_percent: 0.22, k_percent: 0.024, ca_percent: 0.01, mg_percent: 0, na_percent: 0.01 },
  { id: 34, type: 10, main_percent: 99, fe_percent: 0.11, si_percent: 0.13, k_percent: 0.03, ca_percent: 0, mg_percent: 0.01, na_percent: 0 },
  { id: 33, type: 10, main_percent: 98.7, fe_percent: 0, si_percent: 0.1, k_percent: 0.01, ca_percent: 0.03, mg_percent: 0.01, na_percent: 0.01 },
  { id: 32, type: 10, main_percent: 98.1, fe_percent: 0.019, si_percent: 0.06, k_percent: 0, ca_percent: 0.021, mg_percent: 0.03, na_percent: 0 },
  { id: 31, type: 10, main_percent: 97.9, fe_percent: 0.013, si_percent: 0, k_percent: 0.05, ca_percent: 0.37, mg_percent: 0.02, na_percent: 0.01 },
  { id: 1, type: 3, main_percent: 99.9, fe_percent: 0.001, si_percent: 0.03, k_percent: 0.001, ca_percent: 0.001, mg_percent: 0.001, na_percent: 0.001 },
  { id: 36, type: 3, main_percent: 99, fe_percent: 0.01, si_percent: 0.11, k_percent: 0.05, ca_percent: 0.07, mg_percent: 0.015, na_percent: 0.01 },
  { id: 43, type: 10, main_percent: 99.6, fe_percent: 0.001, si_percent: 0.009, k_percent: 0.001, ca_percent: 0.001, mg_percent: 0.001, na_percent: 0.001 },
  { id: 42, type: 19, main_percent: 99.4, fe_percent: 0.001, si_percent: 0.01, k_percent: 0.001, ca_percent: 0.001, mg_percent: 0.001, na_percent: 0.001 },
  { id: 41, type: 15, main_percent: 99.7, fe_percent: 0.001, si_percent: 0.008, k_percent: 0.001, ca_percent: 0.001, mg_percent: 0.001, na_percent: 0.001 },
  { id: 40, type: 14, main_percent: 99.5, fe_percent: 0.001, si_percent: 0.005, k_percent: 0.001, ca_percent: 0.001, mg_percent: 0.001, na_percent: 0.001 },
  { id: 39, type: 13, main_percent: 99.6, fe_percent: 0.002, si_percent: 0.013, k_percent: 0.002, ca_percent: 0.002, mg_percent: 0.002, na_percent: 0.001 },
  { id: 38, type: 8, main_percent: 99.7, fe_percent: 0.001, si_percent: 0.01, k_percent: 0.001, ca_percent: 0.001, mg_percent: 0.001, na_percent: 0.001 },
  { id: 37, type: 3, main_percent: 99.3, fe_percent: 0.008, si_percent: 0.007, k_percent: 0.035, ca_percent: 0.06, mg_percent: 0.02, na_percent: 0.005 },
  { id: 44, type: 8, main_percent: 98.3, fe_percent: 0.005, si_percent: 0.12, k_percent: 0.044, ca_percent: 0.065, mg_percent: 0.013, na_percent: 0.02 },
  { id: 48, type: 19, main_percent: 99.3, fe_percent: 0.0102, si_percent: 0.125, k_percent: 0.055, ca_percent: 0.063, mg_percent: 0.0129, na_percent: 0.009 },
  { id: 45, type: 13, main_percent: 98.7, fe_percent: 0.007, si_percent: 0.13, k_percent: 0.06, ca_percent: 0.07, mg_percent: 0.015, na_percent: 0.012 },
  { id: 47, type: 15, main_percent: 99.1, fe_percent: 0.01, si_percent: 0.095, k_percent: 0.05, ca_percent: 0.069, mg_percent: 0.016, na_percent: 0.01 },
  { id: 46, type: 14, main_percent: 98, fe_percent: 0.009, si_percent: 0.1, k_percent: 0.061, ca_percent: 0.074, mg_percent: 0.017, na_percent: 0.018 },
  { id: 49, type: 10, main_percent: 99.2, fe_percent: 0.01, si_percent: 0.1, k_percent: 0.05, ca_percent: 0.07, mg_percent: 0.015, na_percent: 0.01 },
];
