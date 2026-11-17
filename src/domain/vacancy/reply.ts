import { formatHeadcount, plural } from "./format";
import { changedFields } from "./merge";
import type { VacancyDraft } from "./schema";

function summarize(draft: VacancyDraft): string {
  return [draft.title ? `«${draft.title}»` : null, draft.headcount > 1 ? formatHeadcount(draft.headcount) : null, draft.city]
    .filter(Boolean)
    .join(", ");
}

/**
 * Короткий ответ агента о том, что изменилось в вакансии. Собирается из
 * самих данных — модель на формулировку не тратится.
 */
export function buildReply(before: VacancyDraft | null, after: VacancyDraft, openQuestions: number): string {
  const tail =
    openQuestions > 0
      ? `Осталось уточнить ${openQuestions} ${plural(openQuestions, ["пункт", "пункта", "пунктов"])}.`
      : "Основные условия заполнены. Проверьте вакансию и подтвердите её.";

  if (!before) {
    const summary = summarize(after);
    return summary ? `Собрал черновик вакансии: ${summary}. ${tail}` : `Начал черновик вакансии. ${tail}`;
  }

  const changed = changedFields(before, after);
  if (changed.length === 0) {
    return "Не нашёл в сообщении новых условий. Ответьте на вопрос ниже или измените вакансию вручную.";
  }
  return `Записал: ${changed.join(", ")}. ${tail}`;
}
