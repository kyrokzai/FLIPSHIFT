import { OPEN_COMPENSATION_NOTE, findMoney, isSalesRole, parseEmployerMessage, roleByTitle } from "./parse";
import type { CompensationModel, Question, QuestionId, VacancyDraft, VacancyPatch } from "./schema";
import { NUMBER_WORD_SOURCE, capitalize, cleanPhrase, normalize, parseCount, splitList } from "./text";

/**
 * Уточняющие вопросы вычисляются из самой вакансии — без обращения к модели.
 * Один и тот же код работает на сервере и в браузере, поэтому ответ
 * кнопкой не требует сетевого запроса.
 */

const SALES_DUTIES = [
  "Самостоятельный поиск и привлечение клиентов",
  "Проведение переговоров и презентаций",
  "Заключение сделок и сопровождение клиентов",
  "Выполнение плана продаж",
  "Ведение клиентской базы в CRM",
];

function hasAmount(draft: VacancyDraft): boolean {
  return draft.compensation.amountFrom !== null || draft.compensation.amountTo !== null;
}

export function computeQuestions(draft: VacancyDraft, skipped: readonly QuestionId[] = []): Question[] {
  const questions: Question[] = [];
  const { compensation } = draft;
  const models = compensation.models;

  if (!draft.title) {
    questions.push({
      id: "title",
      text: "На какую должность вы ищете сотрудника?",
      hint: null,
      mode: "text",
      options: [],
      placeholder: "Например: бариста, менеджер по продажам",
      skipLabel: null,
    });
  }

  if (!draft.city && draft.workFormat !== "remote") {
    questions.push({
      id: "city",
      text: "В каком городе работа?",
      hint: null,
      mode: "choice",
      options: [
        { label: "Астана", patch: { city: "Астана" } },
        { label: "Алматы", patch: { city: "Алматы" } },
        { label: "Шымкент", patch: { city: "Шымкент" } },
        { label: "Удалённо", patch: { workFormat: "remote" } },
      ],
      placeholder: "Или напишите другой город",
      skipLabel: null,
    });
  }

  const openToOptions = isSalesRole(draft.title) || compensation.note === OPEN_COMPENSATION_NOTE;
  if (models.length === 0 && !hasAmount(draft) && openToOptions) {
    const option = (label: string, model: CompensationModel) => ({ label, patch: { compensation: { models: [model] } } });
    questions.push({
      id: "compensation_models",
      text: "Какие варианты оплаты готовы рассмотреть?",
      hint: "Можно выбрать несколько — кандидаты увидят все варианты.",
      mode: "multi",
      options: [
        option("Оклад + % от продаж", "fixed_plus_bonus"),
        option("Только % от продаж", "commission"),
        option("Фиксированный оклад", "fixed"),
        option("По договорённости", "negotiable"),
      ],
      placeholder: "Или опишите свою схему оплаты",
      skipLabel: "Решу позже",
    });
  }

  const amountMakesSense = !models.includes("negotiable") && !(models.length === 1 && models[0] === "commission");
  if (!hasAmount(draft) && amountMakesSense) {
    const withFixedPart = models.includes("fixed") || models.includes("fixed_plus_bonus");
    questions.push({
      id: "compensation_amount",
      text: withFixedPart ? "Какой оклад указать в вакансии?" : "Какую зарплату указать в вакансии?",
      hint: models.length ? "Сумма помогает кандидатам быстрее откликнуться. Можно указать вилку." : null,
      mode: "choice",
      options: models.length ? [] : [{ label: "По договорённости", patch: { compensation: { models: ["negotiable"] } } }],
      placeholder: "Например: 300 000 или от 250 до 350 тысяч",
      skipLabel: models.length ? "Не указывать" : null,
    });
  }

  if (!draft.schedule) {
    questions.push({
      id: "schedule",
      text: "Какой график работы?",
      hint: null,
      mode: "choice",
      options: [
        { label: "5/2", patch: { schedule: "5/2", employmentType: draft.employmentType ?? "full_time" } },
        { label: "2/2", patch: { schedule: "2/2" } },
        { label: "6/1", patch: { schedule: "6/1", employmentType: draft.employmentType ?? "full_time" } },
        { label: "Гибкий", patch: { schedule: "Гибкий" } },
      ],
      placeholder: "Или опишите график своими словами",
      skipLabel: null,
    });
  }

  if (draft.experienceRequired === null) {
    questions.push({
      id: "experience",
      text: "Нужен ли опыт работы?",
      hint: null,
      mode: "choice",
      options: [
        { label: "Не обязателен", patch: { experienceRequired: false, experienceMinYears: null } },
        { label: "От 1 года", patch: { experienceRequired: true, experienceMinYears: 1 } },
        { label: "От 3 лет", patch: { experienceRequired: true, experienceMinYears: 3 } },
      ],
      placeholder: "Или уточните требования к опыту",
      skipLabel: null,
    });
  }

  if (draft.responsibilities.length === 0) {
    const duties = roleByTitle(draft.title)?.duties ?? (isSalesRole(draft.title) ? SALES_DUTIES : undefined);
    questions.push({
      id: "responsibilities",
      text: "Чем будет заниматься сотрудник?",
      hint: "Перечислите обязанности через запятую.",
      mode: "choice",
      options: duties ? [{ label: "Подставить типовые обязанности", patch: { responsibilities: duties } }] : [],
      placeholder: "Например: приём заказов, работа с кассой",
      skipLabel: "Пропустить",
    });
  }

  if (draft.aiInterview === null) {
    questions.push({
      id: "ai_interview",
      text: "Проводить предварительное ИИ-интервью с кандидатами?",
      hint: "Интервью проходит только с согласия кандидата. Решение о найме всегда принимаете вы.",
      mode: "choice",
      options: [
        { label: "Включить", patch: { aiInterview: true } },
        { label: "Не нужно", patch: { aiInterview: false } },
      ],
      placeholder: "Или напишите пожелания к интервью",
      skipLabel: null,
    });
  }

  return questions.filter((question) => !skipped.includes(question.id));
}

/** Вакансию можно подтвердить, когда понятно, кого и где ищем. */
export function missingForConfirmation(draft: VacancyDraft): string[] {
  const missing: string[] = [];
  if (!draft.title) missing.push("должность");
  if (!draft.city && draft.workFormat !== "remote") missing.push("город");
  return missing;
}

const YES = /(?<![а-я])(?:да|ага|угу|включ|нужн|провод|хочу|конечно|давай|ок|окей)/;
const NO = /(?<![а-я])(?:нет|не\s|без|выключ|отключ|не$)/;
const EDIT_VERB = /^(?:измени|поменя|исправ|убери|удали|добав|сдела|постав|замени|укажи|обнови)/;

/** Поля общего разбора, которые относятся к вопросу. Остальное в ответе игнорируется. */
const RELATED: Record<QuestionId, ReadonlyArray<keyof VacancyPatch>> = {
  title: ["title", "headcount", "city", "business", "compensation", "schedule", "employmentType", "workFormat", "experienceRequired", "experienceMinYears", "aiInterview", "responsibilities", "requirements", "conditions"],
  city: ["city", "workFormat"],
  compensation_models: ["compensation"],
  compensation_amount: ["compensation"],
  schedule: ["schedule", "employmentType"],
  experience: ["experienceRequired", "experienceMinYears", "requirements"],
  responsibilities: [],
  ai_interview: ["aiInterview"],
};

function generalParse(draft: VacancyDraft, questionId: QuestionId, text: string): VacancyPatch {
  return parseEmployerMessage(text, {
    hasTitle: questionId !== "title" && !!draft.title,
    assumeMoney: questionId === "compensation_amount",
  }).patch;
}

/**
 * Пока задан вопрос, работодатель может написать и не ответ, а правку:
 * «измени зарплату на 350 тысяч». Такое сообщение обрабатывается как обычное.
 */
export function isAnswerTo(draft: VacancyDraft, questionId: QuestionId, answer: string): boolean {
  const norm = normalize(cleanPhrase(answer));
  if (EDIT_VERB.test(norm)) return false;
  if (questionId === "responsibilities" || questionId === "title") return true;
  const found = Object.keys(generalParse(draft, questionId, answer)) as Array<keyof VacancyPatch>;
  if (found.length === 0) return true;
  return found.some((key) => RELATED[questionId].includes(key));
}

/**
 * Свободный ответ на конкретный вопрос: меняет только то поле, о котором спросили.
 */
export function interpretAnswer(draft: VacancyDraft, questionId: QuestionId, answer: string): VacancyPatch {
  const text = cleanPhrase(answer);
  const norm = normalize(text);
  const general = generalParse(draft, questionId, text);
  const patch: VacancyPatch = Object.fromEntries(
    Object.entries(general).filter(([key]) => RELATED[questionId].includes(key as keyof VacancyPatch)),
  );

  switch (questionId) {
    case "title":
      if (!patch.title) patch.title = capitalize(text).slice(0, 160);
      break;

    case "city":
      if (!patch.city && !patch.workFormat) patch.city = capitalize(text.replace(/^(?:в|город|г\.)\s+/i, "")).slice(0, 160);
      break;

    case "compensation_models":
      if (!patch.compensation?.models?.length) {
        patch.compensation = { ...patch.compensation, note: capitalize(text).slice(0, 160) };
      }
      break;

    case "compensation_amount": {
      const money = findMoney(norm, true);
      if (money) {
        patch.compensation = {
          ...patch.compensation,
          amountFrom: money.amountFrom,
          amountTo: money.amountTo,
          ...(money.currency ? { currency: money.currency } : {}),
          ...(money.period ? { period: money.period } : {}),
          // Сумма не отменяет уже выбранные варианты оплаты.
          models: draft.compensation.models.length
            ? draft.compensation.models
            : patch.compensation?.models?.length
              ? patch.compensation.models
              : ["fixed"],
        };
      } else if (!patch.compensation?.models?.length) {
        patch.compensation = { ...patch.compensation, note: capitalize(text).slice(0, 160) };
      }
      break;
    }

    case "schedule":
      if (!patch.schedule) patch.schedule = capitalize(text).slice(0, 160);
      break;

    case "experience":
      if (patch.experienceRequired === undefined) {
        const years = norm.match(new RegExp(`(?<![а-яa-z0-9])(\\d{1,2}|${NUMBER_WORD_SOURCE}|года)(?![а-яa-z0-9])`));
        const value = years ? (years[1] === "года" ? 1 : parseCount(years[1]!)) : null;
        if (value !== null && value <= 40) {
          patch.experienceRequired = true;
          patch.experienceMinYears = value > 0 ? value : null;
        } else if (NO.test(norm)) {
          patch.experienceRequired = false;
          patch.experienceMinYears = null;
        } else {
          patch.experienceRequired = true;
          if (!YES.test(norm) || text.length > 12) patch.requirements = [...draft.requirements, capitalize(text)];
        }
      }
      break;

    case "responsibilities": {
      const items = splitList(text.replace(/^(?:обязанности|задачи)\s*[:—–-]\s*/i, ""));
      if (items.length) patch.responsibilities = items;
      break;
    }

    case "ai_interview":
      if (patch.aiInterview === undefined) {
        if (NO.test(norm)) patch.aiInterview = false;
        else if (YES.test(norm)) patch.aiInterview = true;
      }
      break;
  }

  return patch;
}
