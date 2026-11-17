import type { Criterion } from "@/domain/candidate/schema";
import { compensationModelLabels } from "@/domain/vacancy/format";
import { isSalesRole } from "@/domain/vacancy/parse";
import type { VacancyDraft } from "@/domain/vacancy/schema";
import { unique } from "@/domain/vacancy/text";

/**
 * Вопросы для предварительного интервью. Строятся из условий вакансии
 * и из того, что не подтвердилось в резюме. Вопросов о возрасте, семье,
 * происхождении, здоровье и других личных признаках здесь нет и быть не должно.
 */

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

const SALES_BANK = [
  "Как вы обычно находите новых клиентов? Опишите последние три канала, которые дали результат.",
  "Расскажите о самой крупной сделке, которую вы довели до оплаты: кто был клиентом, сколько длился цикл, что было самым трудным?",
  "Какой у вас был план продаж на последнем месте работы и как вы его выполняли?",
  "Клиент говорит: «дорого, у конкурентов дешевле». Что вы отвечаете?",
];

/** Общие вопросы по вакансии — одинаковые для всех кандидатов. */
export function buildVacancyQuestions(draft: VacancyDraft): string[] {
  const questions: string[] = [];
  const title = draft.title ? lower(draft.title) : "эта работа";

  questions.push(`Что вас привлекает в вакансии «${draft.title ?? "без названия"}» и чем вы занимались на последнем месте работы?`);

  for (const duty of draft.responsibilities.slice(0, 5)) {
    questions.push(`Расскажите о вашем опыте: ${lower(duty)}. Приведите конкретный пример и результат.`);
  }
  if (isSalesRole(draft.title)) questions.push(...SALES_BANK);
  for (const requirement of draft.requirements.slice(0, 4)) {
    questions.push(`В вакансии есть требование: ${lower(requirement)}. Как вы ему соответствуете?`);
  }

  const { models } = draft.compensation;
  if (models.length > 1) {
    questions.push(`Мы рассматриваем несколько схем оплаты: ${models.map((m) => compensationModelLabels[m].toLowerCase()).join("; ")}. Какая вам ближе и почему?`);
  } else if (models.includes("commission") || models.includes("fixed_plus_bonus")) {
    questions.push("Часть дохода зависит от результата. Как вы к этому относитесь и какой доход считаете для себя целевым?");
  }
  if (draft.schedule) questions.push(`График работы — ${draft.schedule}. Подходит ли он вам?`);
  if (draft.city && draft.workFormat !== "remote") questions.push(`Работа в городе ${draft.city}. Удобно ли вам добираться, нужен ли переезд?`);
  questions.push(`Когда вы готовы приступить к работе и что для вас важно в ${title === "эта работа" ? "новой работе" : "новой работе на этой должности"}?`);

  return unique(questions).slice(0, 14);
}

/** Вопросы конкретному кандидату — по пробелам и неясностям его резюме. */
export function buildCandidateQuestions(draft: VacancyDraft, criteria: Criterion[]): string[] {
  const questions: string[] = [];

  for (const criterion of criteria) {
    if (criterion.status === "met") continue;
    switch (criterion.kind) {
      case "role":
        questions.push(`В резюме не видно прямого опыта по профилю «${draft.title}». Какие ваши прошлые задачи ближе всего к этой работе?`);
        break;
      case "responsibility":
      case "requirement":
        questions.push(
          criterion.status === "partial"
            ? `В резюме лишь частично подтверждается: «${lower(criterion.label)}». Расскажите подробнее, что именно вы делали.`
            : `В резюме не нашлось подтверждения: «${lower(criterion.label)}». Был ли у вас такой опыт? Приведите пример.`,
        );
        break;
      case "experience":
        questions.push(
          criterion.status === "unknown"
            ? "Сколько лет вы работаете по этому профилю и где именно?"
            : `${criterion.comment ?? ""} Вакансия предполагает больше. За счёт чего вы быстро выйдете на нужный уровень?`.trim(),
        );
        break;
      case "city":
        questions.push(
          criterion.status === "unknown"
            ? `В каком городе вы живёте и готовы ли работать в городе ${draft.city}?`
            : `${criterion.comment ?? ""} Готовы ли вы работать в городе ${draft.city}?`.trim(),
        );
        break;
      case "salary":
        questions.push(
          criterion.status === "unknown"
            ? "Какие у вас ожидания по доходу?"
            : `${criterion.comment ?? ""} В вакансии сумма ниже. Что для вас важнее суммы и при каких условиях вы готовы обсуждать?`.trim(),
        );
        break;
    }
  }

  // Сильную сторону тоже стоит проверить цифрами.
  const strongest = criteria.find((c) => c.status === "met" && c.evidence && c.kind !== "role");
  if (strongest) {
    questions.push(`В резюме указано: «${strongest.evidence}». Какой был результат в цифрах и какова ваша личная роль?`);
  }

  return unique(questions).slice(0, 10).map((q) => q.slice(0, 500));
}
