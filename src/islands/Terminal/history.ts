// История команд для ↑ / ↓ (SPEC.md §7.11): недописанная строка не теряется, повтор подряд не сохраняется.

export class History {
  private items: string[] = [];
  /** Позиция просмотра; items.length — сама строка ввода. */
  private index = 0;
  private draft = '';

  push(command: string): void {
    const value = command.trim();
    if (value !== '' && value !== this.items.at(-1)) this.items.push(value);
    this.index = this.items.length;
    this.draft = '';
  }

  /** Предыдущая команда или null, если раньше ничего нет. */
  prev(current: string): string | null {
    if (this.index === 0) return null;
    if (this.index === this.items.length) this.draft = current;
    this.index -= 1;
    return this.items[this.index] ?? null;
  }

  /** Следующая команда, после последней — недописанная строка; null, если листать некуда. */
  next(): string | null {
    if (this.index >= this.items.length) return null;
    this.index += 1;
    return this.index === this.items.length ? this.draft : (this.items[this.index] ?? null);
  }
}
