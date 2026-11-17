import { normalize } from "@/domain/vacancy/text";

/**
 * Сопоставление формулировок вакансии и резюме: основы слов и группы
 * близких понятий. Работает для любых профессий; группы понятий лишь
 * повышают точность там, где слова в вакансии и резюме различаются.
 */

const STOP = new Set(
  "и в во на по с со для от до к ко из за о об у при а но или либо не же ли как что это также так то the of and for with in at to a an".split(" "),
);

/** Слова без самостоятельного смысла для оценки: «работа с…», «знание…», «опыт…». */
const GENERIC = /^(?:работ|готов|самостоятельн|различн|друг|наш|ваш|свое|свои|умен|знан|навык|опыт|налич|владен|уверенн|хорош|отличн|желательн|обязательн|приветству|сфер|област|компани|веден|участ|обеспечен|осуществлен|выполнен|проведен|рабоч|мест)/;

const ENDINGS = [
  "иями", "ями", "ами", "ией", "иях", "ием", "ого", "его", "ому", "ему", "ыми", "ими", "ов", "ев", "ей", "ий", "ый", "ой",
  "ая", "яя", "ое", "ее", "ые", "ие", "ам", "ям", "ом", "ем", "ах", "ях", "ую", "юю", "ию", "ия", "ии", "ть",
  "а", "я", "ы", "и", "о", "е", "у", "ю", "ь",
];

export function stem(token: string): string {
  if (!/[а-я]/.test(token) || token.length <= 4) return token;
  for (const ending of ENDINGS) {
    if (token.endsWith(ending) && token.length - ending.length >= 4) return token.slice(0, -ending.length);
  }
  return token;
}

export function tokenize(text: string): string[] {
  return normalize(text).match(/[а-яa-z0-9][а-яa-z0-9+#]*/g) ?? [];
}

export interface KeyTerm {
  /** Основа слова — по ней идёт поиск. */
  stem: string;
  /** Слово, как оно написано в вакансии, — для пояснений работодателю. */
  word: string;
}

/** Значимые слова формулировки. */
export function keyTermPairs(phrase: string): KeyTerm[] {
  const terms: KeyTerm[] = [];
  for (const token of tokenize(phrase)) {
    if (STOP.has(token) || (token.length < 3 && !/\d/.test(token))) continue;
    const base = stem(token);
    if (GENERIC.test(base) || terms.some((term) => term.stem === base)) continue;
    terms.push({ stem: base, word: token });
  }
  return terms;
}

export function keyTerms(phrase: string): string[] {
  return keyTermPairs(phrase).map((term) => term.stem);
}

const NEGATION = /не\s+занимал|нет\s+опыта|без\s+опыта|опыта\s+[^.]{0,40}\s+нет(?![а-я])|не\s+работал|не\s+имею\s+опыта|не\s+было|не\s+приходилось|опыт\s+[^.]{0,40}\s+небольшой|не\s+владею|не\s+знаком/;

/** Кандидат сам пишет, что такого опыта нет: такая строка не подтверждает, а опровергает критерий. */
export function isNegated(unit: string): boolean {
  return NEGATION.test(normalize(unit));
}

/**
 * Группы близких понятий. Однословный элемент сравнивается с началом слова,
 * элемент из нескольких слов ищется как подстрока.
 */
const CONCEPTS: string[][] = [
  ["продаж", "продав", "sales", "сбыт", "реализац"],
  ["клиент", "заказчик", "покупател", "контрагент"],
  ["поиск", "привлечен", "холодн", "лидоген", "наработк", "расширен клиентск", "новых клиент"],
  ["активн", "холодн", "привлечен", "поиск клиент"],
  ["b2b", "корпоративн", "юридическ", "оптов", "тендер", "дилер", "бизнес-клиент"],
  ["b2c", "розниц", "частн", "физическ"],
  ["переговор", "презентац", "встреч"],
  ["сделк", "сделок", "договор", "контракт"],
  ["заключен", "подписан", "оформлен", "закрыт"],
  ["мебел", "кухн", "интерьер", "шкаф", "корпусн", "мягк мебел"],
  ["заказ", "индивидуальн", "проект"],
  ["менеджер", "manager", "специалист", "представител"],
  ["кофе", "эспрессо", "латте", "капучино", "напитк"],
  ["приготовлен", "готовк", "варк"],
  ["гост", "посетител", "клиент", "обслуживан", "сервис"],
  ["касс", "pos", "r-keeper", "iiko", "расчет", "оплат"],
  ["чистот", "уборк", "санитар", "порядок", "порядк"],
  ["crm", "битрикс", "amocrm", "bitrix"],
  ["1с", "1c"],
  ["план", "kpi", "показател"],
  ["консультирован", "консультац", "помощь в выбор"],
  ["доставк", "курьер", "развоз"],
  ["склад", "товар", "приемк", "отгрузк", "инвентаризац"],
  ["бухгалтер", "учет", "отчетност", "налог"],
  ["английск", "english"],
  ["водительск", "категори b", "категории в", "права"],
];

function expansions(term: string): string[] {
  const out = new Set<string>([term]);
  for (const group of CONCEPTS) {
    const belongs = group.some((member) => !member.includes(" ") && (term.startsWith(member) || member.startsWith(term)));
    if (belongs) for (const member of group) out.add(member);
  }
  return [...out];
}

export interface TextIndex {
  norm: string;
  stems: Set<string>;
}

export function indexText(text: string): TextIndex {
  const norm = normalize(text).replace(/\s+/g, " ");
  return { norm, stems: new Set(tokenize(norm).map(stem)) };
}

function hasSingle(index: TextIndex, value: string): boolean {
  if (index.stems.has(value)) return true;
  if (value.length < 3) return false;
  for (const candidate of index.stems) if (candidate.startsWith(value)) return true;
  return false;
}

/** Есть ли в тексте это понятие — само слово или близкое по смыслу. */
export function hasTerm(index: TextIndex, term: string): boolean {
  return expansions(term).some((value) => (value.includes(" ") ? index.norm.includes(value) : hasSingle(index, value)));
}

/** Сколько значимых слов формулировки подтверждается текстом. */
export function matchTerms(index: TextIndex, terms: string[]): { matched: string[]; missed: string[] } {
  const matched: string[] = [];
  const missed: string[] = [];
  for (const term of terms) (hasTerm(index, term) ? matched : missed).push(term);
  return { matched, missed };
}

/** Строки и предложения резюме — единицы для поиска подтверждающих выдержек. */
export function splitUnits(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?;])\s+(?=[A-ZА-ЯЁ—-])/))
    .map((unit) => unit.replace(/\s+/g, " ").replace(/^[—–•·●▪■*-]+\s*/, "").trim())
    .filter((unit) => unit.length >= 8);
}

/** Выдержка из резюме, в которой встречается больше всего слов формулировки. */
export function bestEvidence(units: string[], terms: string[]): string | null {
  let best: { unit: string; hits: number } | null = null;
  for (const unit of units) {
    const hits = matchTerms(indexText(unit), terms).matched.length;
    if (hits > 0 && (!best || hits > best.hits || (hits === best.hits && unit.length < best.unit.length))) {
      best = { unit, hits };
    }
  }
  if (!best) return null;
  return best.unit.length > 240 ? `${best.unit.slice(0, 237).trimEnd()}…` : best.unit;
}
