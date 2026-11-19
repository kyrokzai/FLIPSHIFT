import { z } from "zod";
import { ModeSchema } from "@/domain/candidate/schema";

/**
 * Журнал действий агента. Событие пишется только после того, как действие
 * фактически выполнено или фактически завершилось ошибкой.
 *
 * В событие не попадают тексты резюме, ответы кандидатов, контакты и
 * секреты: только тип действия, идентификаторы и короткий итог.
 */

export const eventTypes = [
  "vacancy_created",
  "vacancy_confirmed",
  "queries_generated",
  "source_opened",
  "source_unavailable",
  "resume_imported",
  "resume_import_failed",
  "resume_analyzed",
  "resume_analysis_failed",
  "shortlist_updated",
  "demo_loaded",
  "challenge_started",
  "challenge_completed",
  "challenge_stopped",
  "comparison_updated",
  "candidate_removed",
] as const;
export const EventTypeSchema = z.enum(eventTypes);
export type EventType = z.infer<typeof EventTypeSchema>;

export const ActorSchema = z.enum(["agent", "employer", "system"]);
export type Actor = z.infer<typeof ActorSchema>;

export const EventStatusSchema = z.enum(["success", "error", "needs_permission"]);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const ActivityEventSchema = z.object({
  id: z.string().max(80),
  /** Ключ защиты от повторной записи одного и того же факта. */
  key: z.string().max(200),
  at: z.number(),
  type: EventTypeSchema,
  actor: ActorSchema,
  vacancyId: z.string().max(80),
  candidateId: z.string().max(80).nullable(),
  mode: ModeSchema,
  status: EventStatusSchema,
  result: z.string().max(300),
  source: z.string().max(80).nullable(),
  errorCode: z.string().max(60).nullable(),
});
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

export const MAX_EVENTS_PER_VACANCY = 300;

export const eventTypeLabels: Record<EventType, string> = {
  vacancy_created: "Создана вакансия",
  vacancy_confirmed: "Вакансия подтверждена",
  queries_generated: "Сформированы поисковые запросы",
  source_opened: "Работодатель открыл внешний источник",
  source_unavailable: "Автоматический поиск недоступен",
  resume_imported: "Импортировано резюме",
  resume_import_failed: "Резюме не импортировано",
  resume_analyzed: "Выполнен анализ резюме",
  resume_analysis_failed: "Анализ резюме не выполнен",
  shortlist_updated: "Обновлён шорт-лист",
  demo_loaded: "Загружены демонстрационные кандидаты",
  challenge_started: "Запущено практическое задание",
  challenge_completed: "Практическое задание завершено",
  challenge_stopped: "Практическое задание остановлено досрочно",
  comparison_updated: "Изменён список сравнения",
  candidate_removed: "Кандидат удалён",
};

/** Группы для фильтра журнала. */
export const eventGroups: Record<string, { label: string; types: EventType[] }> = {
  vacancy: { label: "Вакансия", types: ["vacancy_created", "vacancy_confirmed"] },
  search: { label: "Поиск", types: ["queries_generated", "source_opened", "source_unavailable"] },
  candidates: { label: "Кандидаты", types: ["resume_imported", "resume_import_failed", "resume_analyzed", "resume_analysis_failed", "shortlist_updated", "demo_loaded", "candidate_removed"] },
  checks: { label: "Проверки и сравнение", types: ["challenge_started", "challenge_completed", "challenge_stopped", "comparison_updated"] },
};

export const actorLabels: Record<Actor, string> = { agent: "Агент", employer: "Работодатель", system: "Система" };

export const statusLabels: Record<EventStatus, string> = {
  success: "Выполнено",
  error: "Ошибка",
  needs_permission: "Требуется разрешение",
};

const SCRUB: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[почта скрыта]"],
  [/(?:\+?\d[\s()-]*){10,13}/g, "[телефон скрыт]"],
  [/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, "[ключ скрыт]"],
  [/[A-Za-z0-9_-]{32,}/g, "[скрыто]"],
];

/** Чистит текст события: никаких контактов, ключей и длинных токенов. */
export function sanitizeEventText(text: string, max = 300): string {
  let out = text.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of SCRUB) out = out.replace(pattern, replacement);
  return out.length > max ? `${out.slice(0, max - 1)}…` : out;
}

export interface NewEvent {
  key: string;
  type: EventType;
  actor: Actor;
  vacancyId: string;
  candidateId?: string | null;
  mode: z.infer<typeof ModeSchema>;
  status?: EventStatus;
  result: string;
  source?: string | null;
  errorCode?: string | null;
}

/**
 * Добавляет событие, если события с таким ключом ещё нет.
 * Возвращает новый журнал (или тот же объект, если событие — повтор).
 */
export function appendEvent(log: ActivityEvent[], input: NewEvent, id: string, at: number): ActivityEvent[] {
  if (log.some((event) => event.key === input.key)) return log;
  const event: ActivityEvent = ActivityEventSchema.parse({
    id,
    key: input.key.slice(0, 200),
    at,
    type: input.type,
    actor: input.actor,
    vacancyId: input.vacancyId,
    candidateId: input.candidateId ?? null,
    mode: input.mode,
    status: input.status ?? "success",
    result: sanitizeEventText(input.result),
    source: input.source ? sanitizeEventText(input.source, 80) : null,
    errorCode: input.errorCode ? input.errorCode.replace(/[^\w.-]/g, "").slice(0, 60) || null : null,
  });
  const next = [...log, event];
  return next.length > MAX_EVENTS_PER_VACANCY ? next.slice(next.length - MAX_EVENTS_PER_VACANCY) : next;
}
