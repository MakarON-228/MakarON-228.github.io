export type Segment = { kind: 'text' | 'strong' | 'em'; text: string };

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*)/;

/** Разбирает строку из resume.ts: **…** — выделенный факт, *…* — название. */
export function parseRich(source: string): Segment[] {
  return source
    .split(TOKEN)
    .filter((part) => part !== '')
    .map((part): Segment => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return { kind: 'strong', text: part.slice(2, -2) };
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return { kind: 'em', text: part.slice(1, -1) };
      }
      return { kind: 'text', text: part };
    });
}

/** Текст без разметки — для meta description и проверок. */
export function plainText(source: string): string {
  return parseRich(source)
    .map((s) => s.text)
    .join('');
}
