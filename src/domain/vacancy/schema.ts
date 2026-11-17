import { z } from "zod";

/**
 * Структурированная вакансия — единый контракт между интерфейсом,
 * агентами и (с этапа H3) базой данных.
 */

export const compensationModels = ["fixed", "fixed_plus_bonus", "commission", "negotiable"] as const;
export const CompensationModelSchema = z.enum(compensationModels);
export type CompensationModel = z.infer<typeof CompensationModelSchema>;

export const currencies = ["KZT", "RUB", "USD", "EUR"] as const;
export const CurrencySchema = z.enum(currencies);
export type Currency = z.infer<typeof CurrencySchema>;

export const payPeriods = ["month", "shift", "day", "hour"] as const;
export const PayPeriodSchema = z.enum(payPeriods);
export type PayPeriod = z.infer<typeof PayPeriodSchema>;

export const employmentTypes = ["full_time", "part_time", "project", "internship"] as const;
export const EmploymentTypeSchema = z.enum(employmentTypes);
export type EmploymentType = z.infer<typeof EmploymentTypeSchema>;

export const workFormats = ["onsite", "hybrid", "remote"] as const;
export const WorkFormatSchema = z.enum(workFormats);
export type WorkFormat = z.infer<typeof WorkFormatSchema>;

const shortText = z.string().trim().max(160);
const listItem = z.string().trim().min(1).max(240);
const list = z.array(listItem).max(20);

export const CompensationSchema = z.object({
  /** Допустимые схемы оплаты. Несколько значений — работодатель готов обсуждать варианты. */
  models: z.array(CompensationModelSchema).max(4),
  amountFrom: z.number().int().positive().max(1_000_000_000).nullable(),
  amountTo: z.number().int().positive().max(1_000_000_000).nullable(),
  currency: CurrencySchema,
  period: PayPeriodSchema,
  /** Пояснение: проценты, бонусы, KPI. */
  note: shortText.nullable(),
});
export type Compensation = z.infer<typeof CompensationSchema>;

export const VacancyDraftSchema = z.object({
  title: shortText.nullable(),
  headcount: z.number().int().min(1).max(500),
  city: shortText.nullable(),
  /** Тип бизнеса работодателя: «Кофейня», «Мебельная компания». */
  business: shortText.nullable(),
  employmentType: EmploymentTypeSchema.nullable(),
  workFormat: WorkFormatSchema.nullable(),
  schedule: shortText.nullable(),
  compensation: CompensationSchema,
  /** null — не уточнено; false — опыт не обязателен. */
  experienceRequired: z.boolean().nullable(),
  experienceMinYears: z.number().int().min(0).max(40).nullable(),
  responsibilities: list,
  requirements: list,
  conditions: list,
  /** Предварительное ИИ-интервью. Проводится только с согласия кандидата. */
  aiInterview: z.boolean().nullable(),
});
export type VacancyDraft = z.infer<typeof VacancyDraftSchema>;

export function emptyDraft(): VacancyDraft {
  return {
    title: null,
    headcount: 1,
    city: null,
    business: null,
    employmentType: null,
    workFormat: null,
    schedule: null,
    compensation: {
      models: [],
      amountFrom: null,
      amountTo: null,
      currency: "KZT",
      period: "month",
      note: null,
    },
    experienceRequired: null,
    experienceMinYears: null,
    responsibilities: [],
    requirements: [],
    conditions: [],
    aiInterview: null,
  };
}

/** Частичное изменение вакансии: ответ на вопрос или результат разбора сообщения. */
export const VacancyPatchSchema = VacancyDraftSchema.omit({ compensation: true })
  .partial()
  .extend({ compensation: CompensationSchema.partial().optional() });
export type VacancyPatch = z.infer<typeof VacancyPatchSchema>;

/** Защищённые признаки, которые нельзя использовать при отборе. */
export const protectedAttributes = [
  "age",
  "gender",
  "ethnicity",
  "religion",
  "family",
  "appearance",
  "health",
] as const;
export const ProtectedAttributeSchema = z.enum(protectedAttributes);
export type ProtectedAttribute = z.infer<typeof ProtectedAttributeSchema>;

export const NoticeSchema = z.object({
  kind: z.literal("protected_attribute"),
  attribute: ProtectedAttributeSchema,
  excerpt: z.string().max(120),
  message: z.string().max(400),
});
export type Notice = z.infer<typeof NoticeSchema>;

export const questionIds = [
  "title",
  "city",
  "compensation_models",
  "compensation_amount",
  "schedule",
  "experience",
  "responsibilities",
  "ai_interview",
] as const;
export const QuestionIdSchema = z.enum(questionIds);
export type QuestionId = z.infer<typeof QuestionIdSchema>;

export const QuestionOptionSchema = z.object({
  label: z.string(),
  patch: VacancyPatchSchema,
});
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

export const QuestionSchema = z.object({
  id: QuestionIdSchema,
  text: z.string(),
  hint: z.string().nullable(),
  /** choice — один вариант; multi — несколько; свободный ответ доступен всегда. */
  mode: z.enum(["choice", "multi", "text"]),
  options: z.array(QuestionOptionSchema),
  placeholder: z.string(),
  skipLabel: z.string().nullable(),
});
export type Question = z.infer<typeof QuestionSchema>;

export const engines = ["rules", "llm"] as const;
export type Engine = (typeof engines)[number];

/** Запрос к Orchestrator Agent: свободный текст или ответ на конкретный вопрос. */
export const IntakeRequestSchema = z.object({
  message: z.string().trim().min(2, "Опишите, кого вы ищете").max(2000, "Сообщение длиннее 2000 символов"),
  draft: VacancyDraftSchema.nullable().optional(),
  questionId: QuestionIdSchema.nullable().optional(),
  skipped: z.array(QuestionIdSchema).max(questionIds.length).optional(),
});
export type IntakeRequest = z.infer<typeof IntakeRequestSchema>;

export const IntakeResponseSchema = z.object({
  draft: VacancyDraftSchema,
  reply: z.string(),
  notices: z.array(NoticeSchema),
  questions: z.array(QuestionSchema),
  engine: z.enum(engines),
});
export type IntakeResponse = z.infer<typeof IntakeResponseSchema>;
