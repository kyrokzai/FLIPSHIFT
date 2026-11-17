import type { Candidate, Mode } from "@/domain/candidate/schema";
import { rankCandidates, vacancyKey } from "@/domain/candidate/match";
import { plural } from "@/domain/vacancy/format";
import type { VacancyDraft } from "@/domain/vacancy/schema";
import type { SearchPlan } from "@/domain/sourcing/queries";

/** Состояния шага подбора — те же слова видит работодатель. */
export type StepStatus = "success" | "error" | "needs_access" | "not_connected" | "waiting" | "running";

export const stepStatusLabels: Record<StepStatus, string> = {
  success: "Успешно",
  error: "Ошибка",
  needs_access: "Требуется доступ",
  not_connected: "Не подключено",
  waiting: "Ожидает",
  running: "Выполняется",
};

export interface HiringStep {
  id: "vacancy" | "queries" | "sources" | "resumes" | "analysis" | "shortlist" | "interview";
  title: string;
  status: StepStatus;
  detail: string;
}

const people = (n: number) => `${n} ${plural(n, ["кандидат", "кандидата", "кандидатов"])}`;

/** Ход подбора: каждый шаг честно показывает, что сделано, а что упирается во внешний доступ. */
export function computeSteps(input: {
  draft: VacancyDraft;
  confirmed: boolean;
  mode: Mode;
  candidates: Candidate[];
  plan: SearchPlan;
}): HiringStep[] {
  const { draft, confirmed, mode, plan } = input;
  const candidates = input.candidates.filter((candidate) => candidate.mode === mode);
  const key = vacancyKey(draft);
  const analysed = candidates.filter((c) => c.analysis);
  const failed = candidates.filter((c) => c.error);
  const running = candidates.filter((c) => !c.analysis && !c.error);
  const stale = analysed.filter((c) => c.vacancyKey !== key);
  const { shortlist } = rankCandidates(candidates);
  const demo = mode === "demo";

  return [
    {
      id: "vacancy",
      title: "Вакансия",
      status: confirmed ? "success" : "waiting",
      detail: confirmed ? "Условия подтверждены работодателем." : "Вакансия ещё не подтверждена — условия могут измениться.",
    },
    {
      id: "queries",
      title: "Поисковые запросы",
      status: plan.queries.length ? "success" : "waiting",
      detail: plan.queries.length
        ? `Составлено ${plan.queries.length} ${plural(plan.queries.length, ["запрос", "запроса", "запросов"])} по условиям вакансии.`
        : "Укажите должность, чтобы агент составил запросы.",
    },
    {
      id: "sources",
      title: demo ? "Источник кандидатов" : "Автоматический поиск по источникам",
      status: demo ? (candidates.length ? "success" : "waiting") : "needs_access",
      detail: demo
        ? candidates.length
          ? "Демонстрационный набор загружен. Это вымышленные кандидаты."
          : "Загрузите демонстрационный набор вымышленных кандидатов."
        : "Площадки не разрешают автоматический сбор резюме, а их API требуют учётной записи работодателя. Доступны поиск с помощью агента и импорт резюме.",
    },
    {
      id: "resumes",
      title: demo ? "Резюме" : "Импорт резюме",
      status: candidates.length ? "success" : "waiting",
      detail: candidates.length ? `Добавлено: ${people(candidates.length)}.` : demo ? "Резюме появятся вместе с демонстрационным набором." : "Добавьте резюме файлом или текстом.",
    },
    {
      id: "analysis",
      title: "Анализ и сравнение с вакансией",
      status: running.length ? "running" : failed.length ? "error" : analysed.length ? "success" : "waiting",
      detail: running.length
        ? `Анализирую: ${people(running.length)}.`
        : failed.length
          ? `Не удалось проанализировать: ${people(failed.length)}. Проанализировано: ${analysed.length}.`
          : analysed.length
            ? stale.length
              ? `Проанализировано: ${people(analysed.length)}. Вакансия изменилась — оценки нужно пересчитать.`
              : `Проанализировано: ${people(analysed.length)}.`
            : "Начнётся, как только появится первое резюме.",
    },
    {
      id: "shortlist",
      title: "Шорт-лист",
      status: analysed.length ? "success" : "waiting",
      detail: analysed.length
        ? shortlist.length
          ? `В шорт-листе ${people(shortlist.length)} из ${analysed.length}.`
          : `Никто из ${analysed.length} не прошёл порог соответствия. Причины указаны у каждого кандидата.`
        : "Появится после анализа резюме.",
    },
    {
      id: "interview",
      title: "Вопросы для интервью",
      status: draft.title ? "success" : "waiting",
      detail: draft.title
        ? "Общие вопросы по вакансии готовы. Личные вопросы — в карточке каждого кандидата."
        : "Появятся, когда будет указана должность.",
    },
  ];
}
