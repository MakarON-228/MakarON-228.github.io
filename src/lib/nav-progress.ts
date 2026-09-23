// Поезд прогресса в навигации (SPEC.md §5): где он стоит на линии при данной прокрутке.

/**
 * Прокрутка, при которой поезд прибывает на каждую станцию: верх секции под навигацией.
 * Секции, до которых страница не докручивается (короткий низ), распределяются поровну
 * до конца прокрутки — так поезд доезжает до конечной.
 */
export function arrivals(sectionTops: readonly number[], maxScroll: number): number[] {
  const result: number[] = [];
  let prev = 0;
  const reachable = sectionTops.findIndex((top) => top >= maxScroll);
  const cut = reachable < 0 ? sectionTops.length : reachable;
  for (let i = 0; i < cut; i++) {
    prev = Math.max(prev, sectionTops[i]!);
    result.push(prev);
  }
  const rest = sectionTops.length - cut;
  for (let k = 1; k <= rest; k++) {
    result.push(prev + ((maxScroll - prev) * k) / rest);
  }
  return result;
}

/** Координата поезда: до первой секции — `start`, на прибытии — станция, между — линейно. */
export function trainX(scrollY: number, arrive: readonly number[], stationXs: readonly number[], start: number): number {
  const anchors = [{ at: 0, x: start }, ...arrive.map((at, i) => ({ at, x: stationXs[i]! }))];
  if (scrollY <= anchors[0]!.at) return start;
  for (let i = anchors.length - 1; i >= 0; i--) {
    const a = anchors[i]!;
    if (scrollY < a.at) continue;
    const b = anchors[i + 1];
    if (!b || b.at <= a.at) return a.x;
    return a.x + ((b.x - a.x) * (scrollY - a.at)) / (b.at - a.at);
  }
  return start;
}

/** Текущая станция: последняя, до которой доехали; −1 — ещё до первой секции. */
export function activeIndex(scrollY: number, arrive: readonly number[]): number {
  let index = -1;
  arrive.forEach((at, i) => {
    if (scrollY >= at - 1) index = i;
  });
  return index;
}
