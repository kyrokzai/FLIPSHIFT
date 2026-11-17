import { findProtectedAttributes, mentionsProtectedAttribute } from "./compliance";
import { BUSINESSES, CITIES, ROLES, TITLE_ADJECTIVES, type CityEntry, type RoleEntry } from "./lexicon";
import type {
  Compensation,
  CompensationModel,
  Currency,
  EmploymentType,
  Notice,
  PayPeriod,
  VacancyPatch,
  WorkFormat,
} from "./schema";
import { NUMBER_WORD_SOURCE, capitalize, cleanPhrase, normalize, parseCount, splitList, unique, word } from "./text";

/**
 * Встроенный движок разбора запроса работодателя.
 * Детерминированный, бесплатный, работает и на сервере, и в браузере.
 * Возвращает только те поля, которые удалось распознать.
 */

export interface ParseOptions {
  /** В черновике уже есть должность — не подменяем её догадкой. */
  hasTitle?: boolean;
  /** Сообщение — ответ на вопрос о деньгах: число без валюты тоже считается суммой. */
  assumeMoney?: boolean;
}

export interface ParseResult {
  patch: VacancyPatch;
  notices: Notice[];
}

export const OPEN_COMPENSATION_NOTE = "Готовы обсуждать разные варианты оплаты";

const L = "а-яa-z0-9";

// ---------------------------------------------------------------- должность

const TRIGGER = word(
  [
    "нуж(?:ен|на|ны|но)",
    "требу(?:ет|ют)ся",
    "ищ(?:у|ем|ет|ут)",
    "наним(?:аю|аем)",
    "нанять",
    "найти",
    "набираем",
    "подб(?:ираем|ерите|ерем|ираю)",
    "подобрать",
    "в поиск(?:е|ах)",
    "ваканси[яию]",
    "на должность",
    "на позицию",
  ].join("|"),
  "g",
);

const ACCUSATIVE_TRIGGER = /^(?:ищ|наним|нанять|найти|набираем|подб|подобрать|в поиск)/;

const TAIL_STOP = new RegExp(
  `^(?:в|во|для|от|до|за|из|у|к|при|без|или|либо|зп|з/п|срочно|желательно|обязательно|можно|только|кто|чтобы|если|будет|` +
    `зарплат[${L}]*|оклад[${L}]*|оплат[${L}]*|доход[${L}]*|график[${L}]*|опыт[${L}]*|` +
    `нуж(?:ен|на|ны|но)|требу[${L}]+|ищ(?:у|ем|ет|ут)|котор[${L}]+|долж[${L}]+|готов(?:ы|а|о)?|` +
    `удален[${L}]*|дистанционн[${L}]*|гибрид[${L}]*|офис[${L}]*|сейчас|сегодня|` +
    `умеющ[${L}]*|знающ[${L}]*|работать|работающ[${L}]*|человек[${L}]*|мужчин[${L}]*|женщин[${L}]*|девуш[${L}]*|парн[${L}]*)$`,
);

const NON_ROLE = new RegExp(
  `^(?:опыт|знани|умени|навык|график|зарплат|оклад|человек|люд|сотрудник|работник|персонал|помощь|` +
    `самостоятельн|поиск|кто|кадр|команд|хорош|опытн|ответственн|нов|срочно|еще|ещё|тоже|также|в|на|по|для|с|` +
    `девуш|женщин|мужчин|парн|парен|юнош|молод)[${L}-]*$`,
);

/** «Нужен человек на склад» — обращение без должности, а не обязанность. */
const GENERIC_PERSON = new RegExp(`^(?:человек|люд|сотрудник|работник|персонал|кто|кадр|девуш|женщин|мужчин|парн|парен)[${L}-]*$`);

interface RoleMatch {
  entry: RoleEntry;
  start: number;
  end: number;
}

const ROLE_PATTERNS = ROLES.map((entry) => ({ entry, pattern: word(entry.forms, "g") }));
const ADJECTIVE_PATTERNS = TITLE_ADJECTIVES.map(
  ([forms, title]) => [new RegExp(`(?<![${L}])(${forms})\\s+$`), title] as const,
);

function findRoleMatches(norm: string): RoleMatch[] {
  const found: RoleMatch[] = [];
  for (const { entry, pattern } of ROLE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of norm.matchAll(pattern)) {
      found.push({ entry, start: match.index, end: match.index + match[0].length });
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: RoleMatch[] = [];
  for (const match of found) {
    const last = kept[kept.length - 1];
    if (last && match.start < last.end) continue; // вложенное совпадение («бухгалтер» внутри «главный бухгалтер»)
    kept.push(match);
  }
  return kept;
}

interface Token {
  text: string;
  start: number;
  end: number;
  /** Перед словом или сразу после него стоит знак препинания — граница фразы. */
  breakBefore: boolean;
  breakAfter: boolean;
}

function tokenize(norm: string, from: number, limit = 14): Token[] {
  const tokens: Token[] = [];
  const pattern = /\S+/g;
  pattern.lastIndex = from;
  let match: RegExpExecArray | null;
  while (tokens.length < limit && (match = pattern.exec(norm))) {
    const raw = match[0];
    const lead = raw.match(/^[("«„'—–-]+/)?.[0].length ?? 0;
    const trail = raw.match(/[,.;:!?)»"“']+$/)?.[0].length ?? 0;
    const text = raw.slice(lead, raw.length - trail);
    tokens.push({
      text,
      start: match.index + lead,
      end: match.index + raw.length - trail,
      breakBefore: lead > 0 && /[(—–-]/.test(raw.slice(0, lead)),
      breakAfter: trail > 0,
    });
    if (!text) break;
  }
  return tokens;
}

function isRoleHead(token: string): boolean {
  return ROLE_PATTERNS.some(({ pattern }) => {
    pattern.lastIndex = 0;
    const match = pattern.exec(token);
    return !!match && match.index === 0;
  });
}

/** Продолжение названия после главного слова: «по активным продажам мебели». */
function readTail(norm: string, from: number, maxWords: number): number {
  const tokens = tokenize(norm, from);
  let end = from;
  let taken = 0;

  for (let i = 0; i < tokens.length && taken < maxWords; i++) {
    const token = tokens[i]!;
    const next = tokens[i + 1];
    const previous = tokens[i - 1];
    if (!token.text || token.breakBefore) break;
    if (/^\d/.test(token.text)) break;

    if (token.text === "и") {
      if (taken === 0 || !next || token.breakAfter || isRoleHead(next.text) || TAIL_STOP.test(next.text)) break;
    } else if (token.text === "на") {
      if (!next || !/^(?:заказ|дом|дому|выезд|час)/.test(next.text)) break;
    } else if (token.text === "с" || token.text === "со") {
      if (!previous || !/^(?:работе|работы|работа|взаимодействию|связям|связи)$/.test(previous.text) || taken === 0) break;
    } else if (TAIL_STOP.test(token.text)) {
      break;
    }

    end = token.end;
    taken++;
    if (token.breakAfter) break;
  }

  // Название не должно заканчиваться союзом или предлогом.
  const tail = norm.slice(from, end).replace(/\s+(?:и|на|с|со|по)$/, "");
  return from + tail.length;
}

function toNominative(noun: string, accusative: boolean, count: number | null): string {
  const plural = count !== null && count >= 2;
  if (!accusative && !plural) return noun;
  if (/[^аеиоуыэюя]ов$/.test(noun) && noun.length > 4) return noun.slice(0, -2);
  if (/ей$/.test(noun) && noun.length > 4) return `${noun.slice(0, -2)}ь`;
  if (/[^аеиоуыэюя]я$/.test(noun)) return `${noun.slice(0, -1)}ь`;
  if (/[бвгджзклмнпрстфхцчшщ]а$/.test(noun) && noun.length > 4) return noun.slice(0, -1);
  return noun;
}

interface TitleResult {
  title: string;
  start: number;
  end: number;
  role: RoleEntry | null;
  count: number | null;
}

const COUNT_BEFORE = new RegExp(
  `(?:^|[^${L}/])(\\d{1,3}|${NUMBER_WORD_SOURCE})\\s+(?:[${L}-]+(?:ых|их|ые|ие|ого|его|ый|ий)\\s+)?$`,
);

function countBefore(norm: string, at: number): number | null {
  const match = norm.slice(0, at).match(COUNT_BEFORE);
  return match ? parseCount(match[1]!) : null;
}

function findTitle(text: string, norm: string, allowFallback: boolean): TitleResult | null {
  const triggers = [...norm.matchAll(TRIGGER)].map((m) => ({ start: m.index, end: m.index + m[0].length, text: m[0] }));
  const roles = findRoleMatches(norm);

  // Должность сразу после «нужен / ищем» надёжнее, чем первое упоминание в тексте.
  const afterTrigger = roles.find((role) =>
    triggers.some((t) => t.end <= role.start && norm.slice(t.end, role.start).trim().split(/\s+/).filter(Boolean).length <= 3),
  );
  const role = afterTrigger ?? roles[0];

  if (role) {
    let start = role.start;
    let head = role.entry.title;

    // Составные названия: «SMM-менеджер», «Python разработчик».
    const compound = text.slice(0, start).match(/([A-Za-zА-Яа-яЁё0-9+#.]{1,20})-$/);
    const latin = text.slice(0, start).match(/((?:[A-Za-z][A-Za-z0-9+#.]{0,19}\s+){1,3})$/);
    if (compound) {
      start -= compound[0].length;
      head = `${compound[1]}-${head.charAt(0).toLowerCase()}${head.slice(1)}`;
    } else if (latin) {
      start -= latin[0].length;
      head = `${latin[1]!.trim()} ${head.charAt(0).toLowerCase()}${head.slice(1)}`;
    } else {
      for (const [pattern, adjective] of ADJECTIVE_PATTERNS) {
        const match = norm.slice(0, start).match(pattern);
        if (match) {
          start -= match[0].length;
          head = `${adjective} ${head.charAt(0).toLowerCase()}${head.slice(1)}`;
          break;
        }
      }
    }

    const end = readTail(norm, role.end, 9);
    const tail = cleanPhrase(text.slice(role.end, end));
    const title = capitalize(tail ? `${head} ${tail}` : head);
    return { title: title.slice(0, 160), start, end, role: role.entry, count: countBefore(norm, start) };
  }

  if (!allowFallback) return null;

  for (const trigger of triggers) {
    let from = trigger.end;
    let count: number | null = null;
    const countMatch = norm.slice(from).match(new RegExp(`^\\s+(\\d{1,3}|${NUMBER_WORD_SOURCE})(?![${L}/])`));
    if (countMatch) {
      count = parseCount(countMatch[1]!);
      from += countMatch[0].length;
    }
    const first = tokenize(norm, from, 1)[0];
    if (!first?.text || first.breakBefore || NON_ROLE.test(first.text) || /^\d/.test(first.text)) continue;
    if (norm.slice(trigger.end, first.start).includes(":")) continue;

    const end = first.breakAfter ? first.end : readTail(norm, first.end, 5);
    const head = toNominative(first.text, ACCUSATIVE_TRIGGER.test(trigger.text), count);
    const tail = cleanPhrase(text.slice(first.end, end));
    const title = capitalize(tail ? `${head} ${tail}` : head);
    if (title.length < 3) continue;
    return { title: title.slice(0, 160), start: first.start, end, role: null, count };
  }

  return null;
}

// -------------------------------------------------------------------- город

const CITY_PATTERNS = CITIES.map((entry) => ({ entry, pattern: word(entry.forms) }));

function findCity(text: string, norm: string): { name: string; entry: CityEntry | null } | null {
  let best: { name: string; entry: CityEntry; index: number } | null = null;
  for (const { entry, pattern } of CITY_PATTERNS) {
    const match = norm.match(pattern);
    if (match?.index !== undefined && (!best || match.index < best.index)) {
      best = { name: entry.name, entry, index: match.index };
    }
  }
  if (best) return { name: best.name, entry: best.entry };

  const explicit = text.match(/(?:город[еау]?|г\.)\s*([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)/);
  return explicit ? { name: explicit[1]!, entry: null } : null;
}

// ------------------------------------------------------------------- деньги

const NUM = String.raw`(?<![\d/.,])(?:\d{1,3}(?:[ .]\d{3})+|\d+(?:[.,]\d+)?)(?![\d/])`;
const MULT = `\\s*(?:тыс(?:яч[аи]?)?\\.?|млн\\.?|миллион(?:а|ов)?)(?![${L}])|[кk](?![${L}])`;
const CUR = String.raw`тенге|тг\.?|₸|kzt|рубл(?:ей|я|ь)|руб\.?|₽|rub|\$|usd|доллар(?:ов|а)?|евро|€|eur`;
const MONEY = new RegExp(
  `(?:(от|до)\\s*)?(${NUM})(${MULT})?(?:\\s*(?:-|–|—|до)\\s*(${NUM})(${MULT})?)?\\s*(${CUR})?`,
  "g",
);
const MONEY_KEYWORD = new RegExp(
  `(?:зарплат[${L}]*|зп|з/п|оклад[${L}]*|оплат[${L}]*|доход[${L}]*|ставк[${L}]*|плат(?:им|ить|ят)|плачу|вознагражден[${L}]*)` +
    `\\s*[:—–-]?\\s*(?:составляет\\s*|будет\\s*|примерно\\s*|около\\s*)?(?:от\\s*|до\\s*)?$`,
);

function toNumber(raw: string): number {
  const compact = raw.replace(/\s/g, "");
  if (/^\d{1,3}(?:\.\d{3})+$/.test(compact)) return Number(compact.replace(/\./g, ""));
  return Number(compact.replace(",", "."));
}

function multiplier(raw: string | undefined): number {
  if (!raw) return 1;
  const value = raw.trim();
  if (/^(?:млн|миллион)/.test(value)) return 1_000_000;
  return 1_000; // тыс, тысяч, к, k
}

function currencyOf(raw: string | undefined): Currency | null {
  if (!raw) return null;
  if (/^(?:тенге|тг|₸|kzt)/.test(raw)) return "KZT";
  if (/^(?:руб|₽|rub)/.test(raw)) return "RUB";
  if (/^(?:\$|usd|доллар)/.test(raw)) return "USD";
  return "EUR";
}

interface Money {
  amountFrom: number | null;
  amountTo: number | null;
  currency: Currency | null;
  period: PayPeriod | null;
}

export function findMoney(norm: string, assumeMoney = false): Money | null {
  MONEY.lastIndex = 0;
  for (const match of norm.matchAll(MONEY)) {
    const [whole, prefix, firstRaw, firstMult, secondRaw, secondMult, currencyRaw] = match;
    if (!firstRaw) continue;
    const before = norm.slice(0, match.index);
    const after = norm.slice(match.index + whole.length);

    if (/^\s*(?:%|процент|лет|год|человек|сотрудник|час(?:ов|а)?\s+в|дн(?:я|ей)\s+в)/.test(after)) continue;

    const hasContext = !!currencyRaw || !!firstMult || !!secondMult || MONEY_KEYWORD.test(before) || assumeMoney;
    if (!hasContext) continue;

    let first = toNumber(firstRaw) * multiplier(firstMult);
    let second = secondRaw ? toNumber(secondRaw) * multiplier(secondMult) : null;
    // «от 250 до 350 тысяч» — множитель относится к обеим границам.
    if (second !== null && !firstMult && secondMult && first < 1000) first *= multiplier(secondMult);
    if (!Number.isFinite(first) || first <= 0) continue;
    if (second !== null && (!Number.isFinite(second) || second <= first)) second = null;

    first = Math.round(first);
    const money: Money = { amountFrom: first, amountTo: first, currency: currencyOf(currencyRaw), period: null };
    if (second !== null) money.amountTo = Math.round(second);
    else if (prefix === "от") money.amountTo = null;
    else if (prefix === "до") money.amountFrom = null;

    const periodMatch = after.match(/^\s*(?:в|за|\/|на)\s*(час|смен|день|сутки|месяц|мес)/);
    if (periodMatch) {
      const unit = periodMatch[1]!;
      money.period = unit === "час" ? "hour" : unit === "смен" ? "shift" : unit === "день" || unit === "сутки" ? "day" : "month";
    } else if (/(?:за|в)\s+смену\s*[:—–-]?\s*$/.test(before)) {
      money.period = "shift";
    } else if (/(?:за|в)\s+час\s*[:—–-]?\s*$/.test(before)) {
      money.period = "hour";
    }
    return money;
  }
  return null;
}

function findCompensation(norm: string, assumeMoney: boolean): Partial<Compensation> | null {
  const money = findMoney(norm, assumeMoney);
  const out: Partial<Compensation> = {};
  const models: CompensationModel[] = [];

  const hasAmount = !!money;
  const percent = /%|процент|комисси/.test(norm);
  const bonus = /бонус|преми[яюией]|kpi/.test(norm);
  const fixed = /оклад|фикс/.test(norm);

  if (/только\s+(?:процент|%)|сдельн|за\s+сделк|без\s+оклада/.test(norm)) models.push("commission");
  else if ((percent || bonus) && (fixed || hasAmount)) models.push("fixed_plus_bonus");
  else if (percent) models.push("commission");
  else if (hasAmount || (fixed && !percent)) models.push("fixed");
  if (/по\s+договоренности|договорн|обсужда[ею]|по\s+(?:итогам|результатам)\s+собеседования/.test(norm)) models.push("negotiable");

  if (money) {
    out.amountFrom = money.amountFrom;
    out.amountTo = money.amountTo;
    if (money.currency) out.currency = money.currency;
    if (money.period) out.period = money.period;
  }
  // «оклад» без суммы и без процентов — слишком мало, чтобы выбрать схему.
  if (models.length && !(models.length === 1 && models[0] === "fixed" && !hasAmount)) out.models = unique(models) as CompensationModel[];

  const percentNote = norm.match(/\d{1,2}(?:[.,]\d)?\s*%(?:\s+от\s+[а-я]+)?/);
  const open = new RegExp(
    `(?:разн[${L}]+|различн[${L}]+|люб[${L}]+|нескольк[${L}]+|гибк[${L}]+)\\s+(?:вариант|схем|форм|систем|услови)[${L}]*\\s+оплат|вариант[${L}]*\\s+оплат`,
  ).test(norm);
  if (percentNote) out.note = percentNote[0].replace(/\s+%/, "%");
  else if (open) out.note = OPEN_COMPENSATION_NOTE;

  return Object.keys(out).length ? out : null;
}

// ------------------------------------------------------- график и занятость

function findSchedule(norm: string): string | null {
  const parts: string[] = [];
  const ratio = norm.match(/(?<![\d/])([1-7])\s*\/\s*([1-7])(?![\d/])/);
  const through = norm.match(new RegExp(`(?<![${L}])(\\d|сутки|${NUMBER_WORD_SOURCE})\\s+через\\s+(\\d|${NUMBER_WORD_SOURCE})(?![${L}])`));

  if (ratio) parts.push(`${ratio[1]}/${ratio[2]}`);
  else if (through) {
    const on = through[1] === "сутки" ? 1 : parseCount(through[1]!);
    const off = parseCount(through[2]!);
    if (on && off) parts.push(`${on}/${off}`);
  } else if (/пятидневк/.test(norm)) parts.push("5/2");
  else if (/сменн[а-я]+\s+график|посменн|по\s+сменам/.test(norm)) parts.push("Сменный");
  else if (/гибк[а-я]+\s+график|свободн[а-я]+\s+график/.test(norm)) parts.push("Гибкий");
  else if (/вахт/.test(norm)) parts.push("Вахта");
  else if (/по\s+выходным|в\s+выходные/.test(norm)) parts.push("По выходным");

  const hours = norm.match(/(?<![а-яa-z])с\s*(\d{1,2})(?::(\d{2}))?\s*(?:до|-|–|—)\s*(\d{1,2})(?::(\d{2}))?(?!\s*(?:тыс|лет|год|%))/);
  if (hours && Number(hours[1]) <= 24 && Number(hours[3]) <= 24) {
    parts.push(`${Number(hours[1])}:${hours[2] ?? "00"}–${Number(hours[3])}:${hours[4] ?? "00"}`);
  }

  return parts.length ? parts.join(", ") : null;
}

function findEmployment(norm: string, schedule: string | null): EmploymentType | null {
  if (/стажер|стажировк/.test(norm)) return "internship";
  if (/подработк|частичн[а-я]+\s+занятост|неполн[а-я]+\s+(?:день|занятост|рабоч)|part[- ]?time|полставки|пол\s+ставки/.test(norm)) return "part_time";
  if (/проектн[а-я]+\s+(?:работ|занятост)|фриланс|разов[а-я]+\s+работ|на\s+проект(?![а-я])/.test(norm)) return "project";
  if (/полн[а-я]+\s+занятост|полн[а-я]+\s+(?:рабочий\s+)?день|full[- ]?time|на\s+постоянн/.test(norm)) return "full_time";
  if (schedule && /^(?:5\/2|6\/1)/.test(schedule)) return "full_time";
  return null;
}

function findWorkFormat(norm: string, role: RoleEntry | null): WorkFormat | null {
  if (/гибрид/.test(norm)) return "hybrid";
  if (/удаленн|удаленк|дистанционн|remote|из\s+дома/.test(norm)) return "remote";
  if (/в\s+офис|офисн|на\s+месте|на\s+территории\s+работодателя/.test(norm)) return "onsite";
  return role?.onsite ? "onsite" : null;
}

// --------------------------------------------------------------------- опыт

function findExperience(norm: string): { required: boolean; minYears: number | null } | null {
  if (
    new RegExp(
      `без\\s+опыта|опыт[${L}]*\\s*(?:работы\\s*)?[:—–-]?\\s*(?:не\\s?обязател|не\\s?нуж|не\\s?требу|не\\s?важ|нет(?![${L}]))|` +
        `обучим|научим|обучаем|обучение\\s+(?:с\\s+нуля|за\\s+счет)`,
    ).test(norm)
  ) {
    return { required: false, minYears: null };
  }

  const years = norm.match(
    new RegExp(
      `(?:опыт[${L}]*|стаж[${L}]*)[^.;\\n]{0,30}?(?:от|не\\s+менее|более|минимум)?\\s*(\\d{1,2}|${NUMBER_WORD_SOURCE}|года|полугода)\\s*\\+?\\s*(?:год|лет|года)?(?![${L}])`,
    ),
  );
  if (years) {
    const raw = years[1]!;
    const value = raw === "года" ? 1 : raw === "полугода" ? 0 : parseCount(raw);
    if (value !== null && value <= 40) return { required: true, minYears: value > 0 ? value : null };
  }

  if (new RegExp(`с\\s+опытом|опыт[${L}]*\\s+(?:работы\\s+)?(?:обязател|нуж|требу|важ)|опытн`).test(norm)) {
    return { required: true, minYears: null };
  }
  return null;
}

// ----------------------------------------------------------- ИИ-интервью

function findAiInterview(norm: string): boolean | null {
  const mention = norm.match(
    /(?:ии|ai|аи)[- ]?(?:интервью|собеседовани[ея])|интервью\s+с\s+(?:ии|ai)|предварительн[а-я]+\s+(?:(?:ии|ai)[- ]?)?(?:интервью|собеседовани[ея])/,
  );
  if (!mention || mention.index === undefined) return null;
  const clauseStart = Math.max(norm.lastIndexOf(".", mention.index), norm.lastIndexOf(",", mention.index)) + 1;
  const clauseEnd = (() => {
    const next = norm.slice(mention.index).search(/[.,;\n]/);
    return next === -1 ? norm.length : mention.index + next;
  })();
  const clause = norm.slice(clauseStart, clauseEnd);
  return !/(?<![а-я])(?:без|не\s+нуж|не\s+надо|не\s+проводить|отключ|выключ|не\s+требу|нет)/.test(clause);
}

// ------------------------------------------------------------------ списки

const STRUCTURED_ITEM = new RegExp(
  `зарплат|оклад|(?<![${L}])зп(?![${L}])|график|\\d\\s*/\\s*\\d|(?<![${L}])опыт|тенге|₸|ии-интервью|ai-интервью`,
);
const REQUIREMENT_ITEM = /^(?:знани|умени|навык|владени|наличи|образовани|грамотн|ответственн|пунктуальн|коммуникабельн|стрессоустойчив|готовност|желани|права|водительск|медкнижк|санкнижк|личн[а-я]+\s+автомобил)/;

const LIST_LABELS = {
  responsibilities: "обязанност[а-я]*|задачи|функционал|функции|что\\s+(?:нужно\\s+)?делать|чем\\s+предстоит\\s+заниматься",
  requirements: "требовани[а-я]*|ожидани[а-я]*|от\\s+кандидата|ключевые\\s+навыки|навыки",
  conditions: "услови[а-я]*|мы\\s+предлагаем|предлагаем",
} as const;

function labelledList(text: string, norm: string, label: string): string[] {
  const pattern = new RegExp(`(?<![${L}])(?:${label})(?![${L}])\\s*(?::|—|–|-|включают|входит|входят)\\s*`, "g");
  const items: string[] = [];
  for (const match of norm.matchAll(pattern)) {
    const from = match.index + match[0].length;
    const rest = norm.slice(from);
    const stop = rest.search(/[.!?\n]/);
    items.push(...splitList(text.slice(from, stop === -1 ? text.length : from + stop)));
  }
  return items;
}

/** «…, знание 1С обязательно» — требование внутри перечисления условий. */
function inlineRequirements(text: string, norm: string): string[] {
  const items: string[] = [];
  for (const match of norm.matchAll(/[^,.;!?\n]+/g)) {
    const clause = match[0].trim();
    if (!/^(?:знани|умени|владени|наличи)/.test(clause)) continue;
    const start = match.index + match[0].indexOf(clause);
    const raw = text.slice(start, start + clause.length).replace(/\s+(?:обязательн[а-яё]*|желательн[а-яё]*|приветствуется)$/i, "");
    items.push(capitalize(cleanPhrase(raw)));
  }
  return items;
}

function keepItem(item: string): boolean {
  const norm = normalize(item);
  return item.length <= 240 && !STRUCTURED_ITEM.test(norm) && !mentionsProtectedAttribute(item);
}

/** «Требуется самостоятельный поиск клиентов, переговоры» — предложение-перечисление без метки. */
function looseLists(text: string, norm: string, titleSpan: [number, number] | null) {
  const responsibilities: string[] = [];
  const requirements: string[] = [];
  const sentence = /[^.!?\n]+/g;
  for (const match of norm.matchAll(sentence)) {
    const start = match.index;
    const end = start + match[0].length;
    if (titleSpan && titleSpan[0] < end && titleSpan[1] > start) continue;
    const lead = match[0].match(/^\s*(?:также\s+|еще\s+)?(?:нуж(?:ен|на|но|ны)|требу(?:ет|ют)ся|необходим[а-я]*|важн[а-я]+)\s+/);
    if (!lead) continue;
    for (const item of splitList(text.slice(start + lead[0].length, end))) {
      const itemNorm = normalize(item);
      if (GENERIC_PERSON.test(itemNorm.split(/\s+/)[0] ?? "")) continue;
      (REQUIREMENT_ITEM.test(itemNorm) ? requirements : responsibilities).push(item);
    }
  }
  return { responsibilities, requirements };
}

// -------------------------------------------------------------------- вход

export function parseEmployerMessage(text: string, options: ParseOptions = {}): ParseResult {
  const norm = normalize(text);
  const patch: VacancyPatch = {};

  const title = findTitle(text, norm, !options.hasTitle);
  if (title) {
    patch.title = title.title;
    if (title.count) patch.headcount = title.count;
  }

  const people = norm.match(
    new RegExp(`(?<![${L}/])(\\d{1,3}|${NUMBER_WORD_SOURCE})\\s+(?:человек|сотрудник|специалист|работник|ваканси|позици)[${L}]*`),
  );
  if (people && !patch.headcount) {
    const count = parseCount(people[1]!);
    if (count) patch.headcount = count;
  }

  const city = findCity(text, norm);
  if (city) patch.city = city.name;

  for (const [forms, label] of BUSINESSES) {
    if (word(forms).test(norm)) {
      patch.business = label;
      break;
    }
  }

  const compensation = findCompensation(norm, !!options.assumeMoney);
  if (compensation) {
    if (compensation.amountFrom !== undefined && !compensation.currency && city?.entry?.country === "RU") {
      compensation.currency = "RUB";
    }
    patch.compensation = compensation;
  }

  const schedule = findSchedule(norm);
  if (schedule) patch.schedule = schedule;

  const employment = findEmployment(norm, schedule);
  if (employment) patch.employmentType = employment;

  const workFormat = findWorkFormat(norm, title?.role ?? null);
  if (workFormat) patch.workFormat = workFormat;

  const experience = findExperience(norm);
  if (experience) {
    patch.experienceRequired = experience.required;
    patch.experienceMinYears = experience.minYears;
  }

  const aiInterview = findAiInterview(norm);
  if (aiInterview !== null) patch.aiInterview = aiInterview;

  const loose = options.hasTitle || title ? looseLists(text, norm, title ? [title.start, title.end] : null) : null;
  const responsibilities = unique([
    ...labelledList(text, norm, LIST_LABELS.responsibilities),
    ...(loose?.responsibilities ?? []),
  ]).filter(keepItem);
  const requirements = unique([
    ...labelledList(text, norm, LIST_LABELS.requirements),
    ...(loose?.requirements ?? []),
    ...inlineRequirements(text, norm),
  ]).filter(keepItem);
  const conditions = unique(labelledList(text, norm, LIST_LABELS.conditions)).filter(keepItem);

  if (responsibilities.length) patch.responsibilities = responsibilities.slice(0, 20);
  if (requirements.length) patch.requirements = requirements.slice(0, 20);
  if (conditions.length) patch.conditions = conditions.slice(0, 20);

  return { patch, notices: findProtectedAttributes(text) };
}

export function roleByTitle(title: string | null): RoleEntry | null {
  if (!title) return null;
  const norm = normalize(title);
  return findRoleMatches(norm)[0]?.entry ?? null;
}

/** Должность связана с продажами — уместно обсуждать «оклад + %». */
export function isSalesRole(title: string | null): boolean {
  if (!title) return false;
  return /продаж|продав|sales|торгов|сбыт/.test(normalize(title)) || !!roleByTitle(title)?.sales;
}
