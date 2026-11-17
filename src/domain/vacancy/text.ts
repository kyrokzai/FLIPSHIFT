/**
 * Низкоуровневые помощники для разбора русского текста.
 * `\b` в JavaScript не понимает кириллицу, поэтому границы слов задаём явно.
 */

const LETTER = "а-яa-z0-9";

/** Приводит текст к виду для поиска. Длина строки сохраняется — индексы совпадают с оригиналом. */
export function normalize(text: string): string {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    // Редкие символы меняют длину при toLowerCase — оставляем их как есть.
    const safe = lower.length === ch.length ? lower : ch;
    out += safe === "ё" ? "е" : safe === " " || safe === " " ? " " : safe;
  }
  return out;
}

/** Регулярное выражение, совпадающее только с целыми словами. */
export function word(source: string, flags = ""): RegExp {
  return new RegExp(`(?<![${LETTER}])(?:${source})(?![${LETTER}])`, flags);
}

export function capitalize(text: string): string {
  const trimmed = text.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed;
}

export function cleanPhrase(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:—–-]+|[\s,;:—–-]+$/g, "")
    .trim();
}

const NUMBER_WORDS: Record<string, number> = {
  один: 1, одного: 1, одна: 1, одну: 1,
  два: 2, две: 2, двух: 2, двое: 2, двоих: 2, пара: 2, пару: 2,
  три: 3, трех: 3, трое: 3, троих: 3,
  четыре: 4, четырех: 4, четверо: 4, четверых: 4,
  пять: 5, пяти: 5, пятеро: 5, пятерых: 5,
  шесть: 6, шести: 6,
  семь: 7, семи: 7,
  восемь: 8, восьми: 8,
  девять: 9, девяти: 9,
  десять: 10, десяти: 10,
};

export const NUMBER_WORD_SOURCE = Object.keys(NUMBER_WORDS).join("|");

/** «два», «двух», «2» → 2. */
export function parseCount(token: string): number | null {
  const value = token.trim();
  if (/^\d{1,3}$/.test(value)) return Number(value);
  return NUMBER_WORDS[value] ?? null;
}

/**
 * Делит перечисление на пункты: «кофе, работа с гостями, кассой и чистота» →
 * четыре пункта. Союз «и» разбивает только последний элемент перечисления с запятыми.
 */
export function splitList(text: string): string[] {
  const parts = text
    .split(/\s*[,;]\s*|\s+а также\s+|\n+/)
    .map(cleanPhrase)
    .filter(Boolean);

  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!;
    const at = last.lastIndexOf(" и ");
    if (at > 2 && last.length - at > 5) {
      parts.splice(parts.length - 1, 1, cleanPhrase(last.slice(0, at)), cleanPhrase(last.slice(at + 3)));
    }
  }

  const items: string[] = [];
  for (const part of parts) {
    const previous = items[items.length - 1];
    // «работа с гостями, кассой» — второй пункт наследует начало «работа с».
    const lead = previous?.match(/^(работа с|работа со|ведение|знание|владение|умение)\s/i)?.[1];
    if (lead && !/\s/.test(part)) {
      items.push(`${lead} ${part}`);
    } else {
      items.push(part);
    }
  }

  return unique(items.map((item) => capitalize(item.replace(/\.$/, ""))).filter((item) => item.length > 1));
}

export function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = normalize(item).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
