import { extractRoleTitles, findCityName, findMoney } from "@/domain/vacancy/parse";
import { NUMBER_WORD_SOURCE, cleanPhrase, normalize, parseCount, splitList } from "@/domain/vacancy/text";
import type { ResumeFacts } from "./schema";

/**
 * Извлечение профессиональных сведений из текста резюме.
 * Берётся только то, что относится к работе. Возраст, пол, семейное
 * положение, фото и прочие личные признаки не извлекаются и не оцениваются.
 */

const MONTHS: Record<string, number> = {
  январ: 0, феврал: 1, март: 2, апрел: 3, ма: 4, июн: 5, июл: 6, август: 7, сентябр: 8, октябр: 9, ноябр: 10, декабр: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const MONTH_SOURCE = "январ[ьяе]|феврал[ьяе]|март[ае]?|апрел[ьяе]|ма[йяе]|июн[ьяе]|июл[ьяе]|август[ае]?|сентябр[ьяе]|октябр[ьяе]|ноябр[ьяе]|декабр[ьяе]|jan[a-z]*|feb[a-z]*|mar[a-z]*|apr[a-z]*|may|jun[a-z]*|jul[a-z]*|aug[a-z]*|sep[a-z]*|oct[a-z]*|nov[a-z]*|dec[a-z]*";

function monthIndex(raw: string | undefined): number | null {
  if (!raw) return null;
  if (/^\d{1,2}$/.test(raw)) return Math.min(11, Math.max(0, Number(raw) - 1));
  const key = Object.keys(MONTHS)
    .sort((a, b) => b.length - a.length)
    .find((name) => raw.startsWith(name));
  return key ? MONTHS[key]! : null;
}

/** Суммарный стаж по периодам работы: пересекающиеся периоды не удваиваются. */
function experienceFromRanges(norm: string, now: Date): number | null {
  const point = `(?:(${MONTH_SOURCE}|\\d{1,2})[\\s./]*)?((?:19|20)\\d{2})`;
  const present = "настоящее время|по настоящее|наст\\. ?время|н\\.в\\.|сейчас|текущее время|present|now";
  const pattern = new RegExp(`${point}\\s*(?:г\\.?|года)?\\s*(?:-|–|—|по|до)\\s*(?:${point}|(${present}))`, "g");
  const nowMonths = now.getFullYear() * 12 + now.getMonth();
  const ranges: Array<[number, number]> = [];

  for (const match of norm.matchAll(pattern)) {
    const startYear = Number(match[2]);
    const start = startYear * 12 + (monthIndex(match[1]) ?? 0);
    const end = match[5] ? nowMonths : Number(match[4]) * 12 + (monthIndex(match[3]) ?? 11);
    if (startYear < 1970 || start > nowMonths || end < start || end - start > 50 * 12) continue;
    // Учёба часто записана таким же периодом — её в стаж не включаем.
    const lineStart = norm.lastIndexOf("\n", match.index) + 1;
    const lineEnd = norm.indexOf("\n", match.index + match[0].length);
    const context = norm.slice(lineStart, lineEnd === -1 ? norm.length : lineEnd);
    if (/университет|институт|колледж|академи|бакалавр|магистр|образовани|факультет|школа|курсы/.test(context)) continue;
    ranges.push([start, Math.min(end, nowMonths)]);
  }
  if (ranges.length === 0) return null;

  ranges.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [from, to] = ranges[0]!;
  for (const [start, end] of ranges.slice(1)) {
    if (start <= to) to = Math.max(to, end);
    else {
      total += to - from + 1;
      [from, to] = [start, end];
    }
  }
  total += to - from + 1;
  return Math.round((total / 12) * 10) / 10;
}

function experienceYears(norm: string, now: Date): number | null {
  const number = `(\\d{1,2}|${NUMBER_WORD_SOURCE})`;
  const explicit =
    norm.match(new RegExp(`(?:опыт работы|общий стаж|стаж работы|стаж|опыт)\\s*[:—–-]?\\s*(?:более\\s+|свыше\\s+|около\\s+)?${number}\\s*(?:\\+\\s*)?(?:год|лет|года)(?:\\s*(?:и\\s*)?(\\d{1,2})\\s*мес)?`)) ??
    norm.match(new RegExp(`(?:более|свыше|около)?\\s*${number}\\s*(?:\\+\\s*)?(?:год|лет|года)\\s+(?:опыта|стажа|в продажах|в сфере|работы в|работаю)`));
  if (explicit) {
    const years = parseCount(explicit[1]!);
    if (years !== null && years <= 60) return Math.round((years + Number(explicit[2] ?? 0) / 12) * 10) / 10;
  }
  return experienceFromRanges(norm, now);
}

const HEADER_WORD = /резюме|curriculum|vitae|опыт|образовани|навык|контакт|телефон|email|e-mail|почта|адрес|должност|зарплат|гражданств|город|дата|возраст|пол|мужчин|женщин|обо мне|цель/i;

function detectName(text: string): string | null {
  for (const line of text.split("\n").slice(0, 8)) {
    const value = cleanPhrase(line.replace(/^(?:фио|ф\.и\.о\.|имя)\s*[:—-]\s*/i, ""));
    if (!value || value.length > 60 || /\d|@/.test(value) || HEADER_WORD.test(value)) continue;
    const words = value.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && words.every((part) => /^[A-ZА-ЯЁ][a-zа-яё-]+\.?$/.test(part) || /^[A-ZА-ЯЁ]\.$/.test(part))) {
      return value;
    }
  }
  return null;
}

function detectHeadline(text: string): string | null {
  const labelled = text.match(/(?:желаемая должность|должность|позиция|цель|претендую на должность)\s*[:—–-]\s*([^\n.]{3,120})/i);
  if (labelled) return cleanPhrase(labelled[1]!);
  for (const line of text.split("\n").slice(0, 10)) {
    const value = cleanPhrase(line);
    if (value.length >= 4 && value.length <= 70 && !/[.!?:]\s/.test(value) && extractRoleTitles(value, 1).length > 0) return value;
  }
  return null;
}

function detectCity(text: string): string | null {
  const labelled = text.match(/(?:город проживания|место проживания|проживаю в|проживает|место жительства|локация|город|г\.)\s*[:—–-]?\s*([^\n,.;]{2,40})/i);
  if (labelled) {
    const city = findCityName(labelled[1]!);
    if (city) return city;
  }
  // В шапке резюме город обычно указан рядом с именем и контактами.
  return findCityName(text.slice(0, 500));
}

function detectSkills(text: string): string[] {
  const section = text.match(/(?:ключевые навыки|профессиональные навыки|навыки|skills)\s*[:—–-]?\s*\n?([^\n]+(?:\n(?![^\n]{0,40}(?::|—)\s*$)[^\n]+){0,6})/i);
  if (!section) return [];
  return splitList(section[1]!.replace(/[•·●▪■*]/g, ","))
    .filter((item) => item.length <= 60)
    .slice(0, 20);
}

function detectSalary(norm: string): ResumeFacts["salaryExpectation"] {
  const marker = norm.match(/желаем[а-я]+\s+(?:зарплат|доход|оклад|уровень)[а-я]*|зарплатн[а-я]+\s+ожидани[а-я]+|ожидаем[а-я]+\s+(?:зарплат|доход)[а-я]*|ожидани[а-я]+\s+по\s+(?:зарплате|оплате|доходу)|рассматриваю\s+(?:зарплату|доход|оклад)/);
  if (!marker || marker.index === undefined) return null;
  const money = findMoney(norm.slice(marker.index, marker.index + marker[0].length + 70), true);
  const amount = money?.amountFrom ?? money?.amountTo;
  return amount ? { amount, currency: money?.currency ?? "KZT" } : null;
}

export function extractFacts(resumeText: string, options: { name?: string | null; now?: Date } = {}): ResumeFacts {
  const norm = normalize(resumeText);
  return {
    name: options.name?.trim() || detectName(resumeText),
    headline: detectHeadline(resumeText),
    city: detectCity(resumeText),
    relocation: /готов[а-я]*\s+к\s+переезду|рассматриваю\s+переезд|возможен\s+переезд/.test(norm),
    experienceYears: experienceYears(norm, options.now ?? new Date()),
    positions: extractRoleTitles(resumeText, 6),
    skills: detectSkills(resumeText),
    salaryExpectation: detectSalary(norm),
  };
}

const CONTACT_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  /(?:\+?\d[\s()-]*){10,13}/g,
  /(?:https?:\/\/)?(?:t\.me|wa\.me|telegram\.me|instagram\.com|vk\.com|facebook\.com)\/\S+/gi,
  /@[A-Za-z0-9_]{4,}/g,
];
const PERSONAL_LINE = /^\s*(?:дата рождения|возраст|пол|семейное положение|дети|национальность|гражданство|вероисповедание|рост|вес|фото)\s*[:—–-].*$/gim;

/**
 * Текст резюме для передачи в языковую модель: без контактов и без строк
 * с личными признаками. Модель видит только профессиональные сведения.
 */
export function redactForModel(resumeText: string): string {
  let text = resumeText.replace(PERSONAL_LINE, "");
  for (const pattern of CONTACT_PATTERNS) text = text.replace(pattern, "[скрыто]");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}
