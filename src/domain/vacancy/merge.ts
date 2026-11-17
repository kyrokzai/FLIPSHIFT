import { withoutProtected } from "./compliance";
import { OPEN_COMPENSATION_NOTE } from "./parse";
import type { CompensationModel, VacancyDraft, VacancyPatch } from "./schema";
import { VacancyDraftSchema, compensationModels } from "./schema";
import { unique } from "./text";

export interface MergeOptions {
  /** append — новые пункты списков добавляются к существующим; replace — заменяют их. */
  lists?: "append" | "replace";
  /** union — выбранные схемы оплаты дополняют уже выбранные (множественный выбор). */
  models?: "union" | "replace";
}

function orderModels(models: CompensationModel[]): CompensationModel[] {
  return compensationModels.filter((model) => models.includes(model));
}

/** Применяет частичное изменение к вакансии и возвращает новый, проверенный объект. */
export function applyPatch(draft: VacancyDraft, patch: VacancyPatch, options: MergeOptions = {}): VacancyDraft {
  const lists = options.lists ?? "replace";
  const next: VacancyDraft = structuredClone(draft);

  const scalarKeys = [
    "title",
    "headcount",
    "city",
    "business",
    "employmentType",
    "workFormat",
    "schedule",
    "experienceRequired",
    "experienceMinYears",
    "aiInterview",
  ] as const;
  for (const key of scalarKeys) {
    const value = patch[key];
    if (value !== undefined) (next as Record<string, unknown>)[key] = value;
  }

  for (const key of ["responsibilities", "requirements", "conditions"] as const) {
    const value = patch[key];
    if (value === undefined) continue;
    const merged = lists === "append" ? [...next[key], ...value] : value;
    next[key] = unique(withoutProtected(merged)).slice(0, 20);
  }

  if (patch.compensation) {
    const { models, ...rest } = patch.compensation;
    Object.assign(next.compensation, Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)));
    if (models) {
      next.compensation.models = orderModels(
        options.models === "union" ? [...next.compensation.models, ...models] : models,
      );
    }
    // Варианты оплаты выбраны — пометка «готовы обсуждать» своё отработала.
    if (next.compensation.models.length > 0 && rest.note === undefined && next.compensation.note === OPEN_COMPENSATION_NOTE) {
      next.compensation.note = null;
    }
    const { amountFrom, amountTo } = next.compensation;
    if (amountFrom !== null && amountTo !== null && amountTo < amountFrom) next.compensation.amountTo = amountFrom;
  }

  if (next.experienceRequired === false) next.experienceMinYears = null;
  if (next.title) next.title = next.title.trim() || null;
  if (next.city) next.city = next.city.trim() || null;

  return VacancyDraftSchema.parse(next);
}

/** Названия полей, которые изменились — для короткого ответа агента. */
export function changedFields(before: VacancyDraft, after: VacancyDraft): string[] {
  const labels: Array<[label: string, pick: (d: VacancyDraft) => unknown]> = [
    ["должность", (d) => d.title],
    ["количество сотрудников", (d) => d.headcount],
    ["город", (d) => d.city],
    ["тип бизнеса", (d) => d.business],
    ["оплата", (d) => d.compensation],
    ["график", (d) => d.schedule],
    ["занятость", (d) => d.employmentType],
    ["формат работы", (d) => d.workFormat],
    ["опыт", (d) => [d.experienceRequired, d.experienceMinYears]],
    ["обязанности", (d) => d.responsibilities],
    ["требования", (d) => d.requirements],
    ["условия", (d) => d.conditions],
    ["ИИ-интервью", (d) => d.aiInterview],
  ];
  return labels
    .filter(([, pick]) => JSON.stringify(pick(before)) !== JSON.stringify(pick(after)))
    .map(([label]) => label);
}
