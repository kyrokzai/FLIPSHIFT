import { isSalesRole, roleByTitle } from "@/domain/vacancy/parse";
import type { VacancyDraft } from "@/domain/vacancy/schema";
import { normalize, unique } from "@/domain/vacancy/text";

/**
 * Sourcer Agent, шаг 1: поисковые запросы по вакансии.
 * Запросы составляются кодом из условий вакансии и подходят для поиска
 * резюме на площадках, которые работодатель открывает под своей учётной записью.
 */

export interface SearchQuery {
  id: string;
  label: string;
  /** Зачем этот запрос — чтобы работодатель понимал, что он расширяет или сужает. */
  purpose: string;
  /** Простая строка: подходит для любого поиска. */
  text: string;
  /** Запрос с операторами AND / OR и кавычками (язык запросов hh.kz). */
  boolean: string | null;
}

export interface SearchPlan {
  titles: string[];
  domain: string[];
  skills: string[];
  city: string | null;
  queries: SearchQuery[];
}

/** Как ещё называют эту должность в резюме. */
const TITLE_SYNONYMS: Array<[test: RegExp, titles: string[]]> = [
  [/продаж|sales|сбыт/, ["менеджер по продажам", "менеджер по активным продажам", "sales manager", "менеджер по работе с клиентами", "менеджер по развитию бизнеса", "торговый представитель"]],
  [/барист/, ["бариста", "бармен-бариста"]],
  [/продав/, ["продавец-консультант", "продавец", "продавец-кассир"]],
  [/официант/, ["официант", "хостес"]],
  [/бухгалтер/, ["бухгалтер", "главный бухгалтер", "бухгалтер на участок"]],
  [/администратор/, ["администратор", "администратор ресепшн", "офис-менеджер"]],
  [/курьер/, ["курьер", "водитель-курьер"]],
  [/повар/, ["повар", "повар-универсал", "су-шеф"]],
];

/** Отраслевые слова: как отрасль называют в резюме. */
const DOMAIN_WORDS: Array<[test: RegExp, words: string[]]> = [
  [/мебел/, ["мебель", "кухни", "интерьер"]],
  [/кофе|барист/, ["кофейня", "кофе"]],
  [/строит|стройматериал/, ["строительство", "стройматериалы"]],
  [/одежд/, ["одежда", "fashion"]],
  [/ресторан|кафе/, ["ресторан", "кафе", "HoReCa"]],
  [/недвижим/, ["недвижимость", "новостройки"]],
  [/авто/, ["автомобили", "автосалон"]],
];

const SKILL_WORDS: Array<[test: RegExp, words: string[]]> = [
  [/b2b|корпоратив/, ["B2B", "корпоративные продажи"]],
  [/поиск|привлеч|активн|холодн/, ["холодные звонки", "поиск клиентов"]],
  [/переговор/, ["переговоры"]],
  [/сделк|договор/, ["заключение договоров"]],
  [/crm|битрикс|amocrm/, ["CRM"]],
  [/касс/, ["работа с кассой"]],
  [/1с|1c/, ["1С"]],
];

const quote = (value: string) => (/\s/.test(value) ? `"${value}"` : value);
const anyOf = (values: string[]) => (values.length > 1 ? `(${values.map(quote).join(" OR ")})` : quote(values[0] ?? ""));

function collect(table: Array<[RegExp, string[]]>, haystack: string): string[] {
  return unique(table.filter(([test]) => test.test(haystack)).flatMap(([, words]) => words));
}

export function buildSearchPlan(draft: VacancyDraft): SearchPlan {
  const title = draft.title ?? "";
  const titleNorm = normalize(title);
  const context = normalize([title, draft.business ?? "", ...draft.responsibilities, ...draft.requirements].join(" "));

  const base = roleByTitle(draft.title)?.title.toLowerCase() ?? titleNorm.split(/\s+/).slice(0, 3).join(" ");
  const synonyms = TITLE_SYNONYMS.find(([test]) => test.test(titleNorm))?.[1] ?? [];
  const titles = unique([isSalesRole(title) ? "" : base, ...synonyms].filter(Boolean)).slice(0, 6);
  if (titles.length === 0 && base) titles.push(base);

  const domain = collect(DOMAIN_WORDS, context).slice(0, 4);
  const skills = collect(SKILL_WORDS, context).slice(0, 5);

  // Точный запрос — должность так, как она названа в вакансии.
  const exact = titleNorm.split(/\s+/).slice(0, 7).join(" ");

  const queries: SearchQuery[] = [];
  if (exact) {
    queries.push({
      id: "exact",
      label: "Точный запрос",
      purpose: "Кандидаты, у которых должность названа так же, как в вакансии.",
      text: exact,
      boolean: null,
    });
  }
  if (titles.length > 0) {
    queries.push({
      id: "titles",
      label: domain.length ? "Смежные названия должности в вашей отрасли" : "Смежные названия должности",
      purpose: "Одна и та же работа в резюме называется по-разному — запрос охватывает все варианты.",
      text: [titles[0], domain[0]].filter(Boolean).join(" "),
      boolean: domain.length ? `${anyOf(titles)} AND ${anyOf(domain)}` : anyOf(titles),
    });
  }
  if (skills.length > 0 && titles.length > 0) {
    queries.push({
      id: "skills",
      label: "По ключевым навыкам",
      purpose: "Кандидаты из других отраслей с нужными навыками: отраслевое слово убрано намеренно.",
      text: [titles[0], ...skills.slice(0, 2)].join(" "),
      boolean: `${anyOf(titles.slice(0, 3))} AND ${anyOf(skills)}`,
    });
  }

  return { titles, domain, skills, city: draft.city, queries };
}
