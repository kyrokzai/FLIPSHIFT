import type {
  Compensation,
  CompensationModel,
  Currency,
  EmploymentType,
  PayPeriod,
  VacancyDraft,
  VacancyPatch,
  WorkFormat,
} from "./schema";

export const compensationModelLabels: Record<CompensationModel, string> = {
  fixed: "Фиксированный оклад",
  fixed_plus_bonus: "Оклад + % от результата",
  commission: "Сдельная оплата, % от результата",
  negotiable: "По договорённости",
};

export const employmentLabels: Record<EmploymentType, string> = {
  full_time: "Полная занятость",
  part_time: "Частичная занятость",
  project: "Проектная работа",
  internship: "Стажировка",
};

export const workFormatLabels: Record<WorkFormat, string> = {
  onsite: "На месте работодателя",
  hybrid: "Гибридный формат",
  remote: "Удалённо",
};

export const currencySymbols: Record<Currency, string> = { KZT: "₸", RUB: "₽", USD: "$", EUR: "€" };

export const periodLabels: Record<PayPeriod, string> = {
  month: "в месяц",
  shift: "за смену",
  day: "в день",
  hour: "в час",
};

/** 300000 → «300 000» с неразрывными пробелами. */
export function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function plural(count: number, forms: [one: string, few: string, many: string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export function formatHeadcount(count: number): string {
  return `${count} ${plural(count, ["человек", "человека", "человек"])}`;
}

export function formatAmount(compensation: Pick<Compensation, "amountFrom" | "amountTo" | "currency" | "period">): string | null {
  const { amountFrom, amountTo, currency, period } = compensation;
  const symbol = currencySymbols[currency];
  const suffix = ` ${symbol} ${periodLabels[period]}`;
  if (amountFrom !== null && amountTo !== null) {
    return amountFrom === amountTo
      ? `${formatNumber(amountFrom)}${suffix}`
      : `${formatNumber(amountFrom)} – ${formatNumber(amountTo)}${suffix}`;
  }
  if (amountFrom !== null) return `от ${formatNumber(amountFrom)}${suffix}`;
  if (amountTo !== null) return `до ${formatNumber(amountTo)}${suffix}`;
  return null;
}

/** Строки блока «Оплата»: сумма, схемы, пояснение. */
export function compensationLines(compensation: Compensation): string[] {
  const lines: string[] = [];
  const amount = formatAmount(compensation);
  const models = compensation.models.filter((model) => !(model === "fixed" && amount && compensation.models.length === 1));
  if (amount) lines.push(amount);
  if (models.length === 1) lines.push(compensationModelLabels[models[0]!]);
  else if (models.length > 1) lines.push(`Варианты: ${models.map((m) => compensationModelLabels[m].toLowerCase()).join("; ")}`);
  if (compensation.note) lines.push(compensation.note);
  return lines;
}

export function formatExperience(draft: Pick<VacancyDraft, "experienceRequired" | "experienceMinYears">): string | null {
  if (draft.experienceRequired === null) return null;
  if (!draft.experienceRequired) return "Не обязателен";
  if (draft.experienceMinYears) {
    return `От ${draft.experienceMinYears} ${plural(draft.experienceMinYears, ["года", "лет", "лет"])}`;
  }
  return "Обязателен";
}

export function formatAiInterview(value: boolean | null): string | null {
  if (value === null) return null;
  return value ? "Включено, с согласия кандидата" : "Не проводится";
}

export interface RecognizedChip {
  key: string;
  label: string;
}

/** Что агент распознал в сообщении — короткие подписи для строки «понял из запроса». */
export function describePatch(patch: VacancyPatch): RecognizedChip[] {
  const chips: RecognizedChip[] = [];
  if (patch.title) chips.push({ key: "title", label: patch.title });
  if (patch.headcount && patch.headcount > 1) chips.push({ key: "headcount", label: formatHeadcount(patch.headcount) });
  if (patch.city) chips.push({ key: "city", label: patch.city });
  if (patch.business) chips.push({ key: "business", label: patch.business });

  const c = patch.compensation;
  if (c) {
    const amount =
      c.amountFrom !== undefined || c.amountTo !== undefined
        ? formatAmount({
            amountFrom: c.amountFrom ?? null,
            amountTo: c.amountTo ?? null,
            currency: c.currency ?? "KZT",
            period: c.period ?? "month",
          })
        : null;
    if (amount) chips.push({ key: "amount", label: amount });
    for (const model of c.models ?? []) {
      if (model === "fixed" && amount) continue;
      chips.push({ key: `model-${model}`, label: compensationModelLabels[model] });
    }
    if (c.note) chips.push({ key: "note", label: c.note });
  }

  if (patch.schedule) chips.push({ key: "schedule", label: `График ${patch.schedule}` });
  if (patch.employmentType) chips.push({ key: "employment", label: employmentLabels[patch.employmentType] });
  if (patch.workFormat && patch.workFormat !== "onsite") chips.push({ key: "format", label: workFormatLabels[patch.workFormat] });
  if (patch.experienceRequired !== undefined && patch.experienceRequired !== null) {
    const label = formatExperience({
      experienceRequired: patch.experienceRequired,
      experienceMinYears: patch.experienceMinYears ?? null,
    });
    if (label) chips.push({ key: "experience", label: `Опыт: ${label.toLowerCase()}` });
  }
  if (patch.responsibilities?.length) {
    const n = patch.responsibilities.length;
    chips.push({ key: "responsibilities", label: `${n} ${plural(n, ["обязанность", "обязанности", "обязанностей"])}` });
  }
  if (patch.requirements?.length) {
    const n = patch.requirements.length;
    chips.push({ key: "requirements", label: `${n} ${plural(n, ["требование", "требования", "требований"])}` });
  }
  if (patch.aiInterview !== undefined && patch.aiInterview !== null) {
    chips.push({ key: "ai", label: patch.aiInterview ? "ИИ-интервью включено" : "Без ИИ-интервью" });
  }
  return chips;
}

/** Текст вакансии для публикации: можно скопировать и разместить вручную. */
export function renderVacancyText(draft: VacancyDraft): string {
  const lines: string[] = [];
  const head = [draft.title ?? "Вакансия", draft.city, draft.business].filter(Boolean).join(", ");
  lines.push(head);
  if (draft.headcount > 1) lines.push(`Требуется: ${formatHeadcount(draft.headcount).replace(/ /g, " ")}`);
  lines.push("");

  const facts: string[] = [];
  const pay = compensationLines(draft.compensation);
  if (pay.length) facts.push(`Оплата: ${pay.join(". ")}`);
  if (draft.schedule) facts.push(`График: ${draft.schedule}`);
  if (draft.employmentType) facts.push(`Занятость: ${employmentLabels[draft.employmentType].toLowerCase()}`);
  if (draft.workFormat) facts.push(`Формат: ${workFormatLabels[draft.workFormat].toLowerCase()}`);
  const experience = formatExperience(draft);
  if (experience) facts.push(`Опыт: ${experience.toLowerCase()}`);
  lines.push(...facts);

  const section = (title: string, items: string[]) => {
    if (!items.length) return;
    lines.push("", `${title}:`, ...items.map((item) => `— ${item}`));
  };
  section("Обязанности", draft.responsibilities);
  section("Требования", draft.requirements);
  section("Условия", draft.conditions);

  if (draft.aiInterview) {
    lines.push("", "Первый этап — короткое предварительное ИИ-интервью. Оно проводится только с вашего согласия.");
  }
  return lines.join("\n").replace(/ /g, " ").trim();
}
