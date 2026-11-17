import type { VacancyDraft } from "@/domain/vacancy/schema";
import type { SearchQuery } from "./queries";

/**
 * Реестр источников кандидатов. Для каждого источника записано, что с ним
 * можно делать законно и что для этого нужно. Сведения проверены по
 * официальным документам площадок 17.11.2026; ссылки — в docs/SOURCING.md.
 *
 * Платформа не собирает страницы площадок автоматически и не обходит
 * их ограничения: там, где нет разрешённого API, работодатель ищет сам
 * под своей учётной записью, а агент готовит запросы и анализирует резюме.
 */

export const accessClasses = ["free", "employer_account", "api", "paid", "prohibited"] as const;
export type AccessClass = (typeof accessClasses)[number];

export const accessClassLabels: Record<AccessClass, string> = {
  free: "Доступно сейчас без платного подключения",
  employer_account: "Требуется аккаунт работодателя",
  api: "Требуется OAuth / API",
  paid: "Требуется платный доступ",
  prohibited: "Недоступно или запрещено",
};

export type SourceStatus = "success" | "needs_access" | "not_connected" | "prohibited";

export const sourceStatusLabels: Record<SourceStatus, string> = {
  success: "Доступно",
  needs_access: "Требуется доступ",
  not_connected: "Не подключено",
  prohibited: "Запрещено",
};

export interface SourceCapability {
  id: string;
  /** Название площадки — показывается рядом с кандидатом как источник. */
  source: string;
  title: string;
  access: AccessClass;
  status: SourceStatus;
  summary: string;
  /** Что нужно сделать, чтобы возможность заработала. */
  needs: string | null;
}

export const SOURCE_CAPABILITIES: SourceCapability[] = [
  {
    id: "import",
    source: "Ваши резюме",
    title: "Импорт резюме: PDF, DOCX, текст",
    access: "free",
    status: "success",
    summary: "Резюме из почты, мессенджеров, откликов и с любых площадок. Полный анализ, сравнение с вакансией и вопросы для интервью.",
    needs: null,
  },
  {
    id: "assisted",
    source: "Поиск с помощью агента",
    title: "Готовые запросы и переход к поиску на площадке",
    access: "free",
    status: "success",
    summary: "Агент составляет точные запросы и открывает поиск резюме на площадке. Вы ищете под своей учётной записью и добавляете подходящие резюме сюда.",
    needs: null,
  },
  {
    id: "hh-web",
    source: "hh.kz",
    title: "Поиск и просмотр резюме на сайте hh.kz",
    access: "employer_account",
    status: "needs_access",
    summary: "Работодатель может искать и читать резюме на сайте без покупки базы — без контактов и с дневными лимитами просмотров.",
    needs: "Вход на hh.kz под учётной записью работодателя. Регистрация компании на hh.kz бесплатна.",
  },
  {
    id: "hh-responses",
    source: "hh.kz",
    title: "Отклики на ваши вакансии через API HeadHunter",
    access: "api",
    status: "not_connected",
    summary: "Автоматическая загрузка резюме тех, кто откликнулся на вакансию компании. Контакты откликнувшихся доступны без оплаты базы резюме.",
    needs: "Аккаунт работодателя на hh.kz и регистрация приложения на dev.hh.kz. HeadHunter проверяет заявку до 15 рабочих дней.",
  },
  {
    id: "hh-search",
    source: "hh.kz",
    title: "Автоматический поиск по базе резюме через API HeadHunter",
    access: "api",
    status: "not_connected",
    summary: "Поиск резюме методом API от имени работодателя. Анонимный доступ к резюме в API закрыт.",
    needs: "То же приложение и авторизация работодателя. Нужен ли платный доступ на hh.kz, HeadHunter показывает для конкретной компании — проверяется после подключения.",
  },
  {
    id: "hh-contacts",
    source: "hh.kz",
    title: "Контакты кандидатов из базы резюме и приглашения",
    access: "paid",
    status: "needs_access",
    summary: "Чтобы связаться с кандидатом, найденным в базе, нужен оплаченный доступ к базе резюме или к контактам.",
    needs: "Покупка услуги в личном кабинете работодателя на hh.kz. Платформа сама ничего не покупает.",
  },
  {
    id: "scraping",
    source: "hh.kz, LinkedIn и другие площадки",
    title: "Автоматический сбор страниц резюме в обход API",
    access: "prohibited",
    status: "prohibited",
    summary: "Правила hh.kz прямо запрещают парсинг и массовую выгрузку базы резюме; LinkedIn запрещает автоматический сбор профилей. Платформа этого не делает.",
    needs: null,
  },
];

/** Идентификаторы регионов hh для ссылки на поиск. Для остальных городов регион выбирается на самой площадке. */
const HH_AREAS: Record<string, number> = { Астана: 159, Алматы: 160 };

export interface SearchLink {
  source: string;
  label: string;
  url: string;
  /** Что увидит работодатель и что ему понадобится. */
  note: string;
}

/** Ссылки на поиск резюме на самих площадках — открываются в браузере работодателя. */
export function buildSearchLinks(query: SearchQuery, draft: VacancyDraft): SearchLink[] {
  const text = query.boolean ?? query.text;
  const links: SearchLink[] = [];

  const hh = new URLSearchParams({ text });
  const area = draft.city ? HH_AREAS[draft.city] : undefined;
  if (area) hh.set("area", String(area));
  links.push({
    source: "hh.kz",
    label: "Искать на hh.kz",
    url: `https://hh.kz/search/resume?${hh.toString()}`,
    note: "Нужен вход работодателя. Резюме видны без контактов.",
  });

  const people = [query.text, draft.city].filter(Boolean).join(" ");
  links.push({
    source: "LinkedIn",
    label: "Искать в LinkedIn",
    url: `https://www.linkedin.com/search/results/people/?${new URLSearchParams({ keywords: people }).toString()}`,
    note: "Обычный поиск людей в вашем аккаунте LinkedIn.",
  });

  return links;
}
