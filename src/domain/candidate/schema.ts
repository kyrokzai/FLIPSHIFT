import { z } from "zod";
import { CurrencySchema, VacancyDraftSchema } from "@/domain/vacancy/schema";

/**
 * Кандидат, его резюме и оценка соответствия вакансии.
 * DEMO и LIVE — разные наборы: кандидат всегда принадлежит одному режиму.
 */

export const ModeSchema = z.enum(["demo", "live"]);
export type Mode = z.infer<typeof ModeSchema>;

export const MAX_RESUME_CHARS = 30_000;

export const CandidateSourceSchema = z.object({
  /** file / text — резюме добавил работодатель; demo — синтетический кандидат; connector — получен через подключённый источник. */
  kind: z.enum(["file", "text", "demo", "connector"]),
  /** Название источника для показа: «hh.kz», «Enbek.kz», «Резюме из почты». */
  label: z.string().trim().max(80),
  /** Ссылка на оригинальный профиль, если работодатель её указал или источник её отдаёт. */
  url: z.url().max(600).nullable(),
  fileName: z.string().max(200).nullable(),
});
export type CandidateSource = z.infer<typeof CandidateSourceSchema>;

export const ResumeFactsSchema = z.object({
  name: z.string().max(120).nullable(),
  /** Желаемая должность или заголовок резюме. */
  headline: z.string().max(200).nullable(),
  city: z.string().max(120).nullable(),
  relocation: z.boolean(),
  experienceYears: z.number().min(0).max(60).nullable(),
  positions: z.array(z.string().max(200)).max(8),
  skills: z.array(z.string().max(80)).max(24),
  salaryExpectation: z.object({ amount: z.number().int().positive(), currency: CurrencySchema }).nullable(),
});
export type ResumeFacts = z.infer<typeof ResumeFactsSchema>;

export const criterionKinds = ["role", "responsibility", "requirement", "experience", "city", "salary"] as const;
export const criterionStatuses = ["met", "partial", "missing", "unknown"] as const;

export const CriterionSchema = z.object({
  id: z.string().max(40),
  kind: z.enum(criterionKinds),
  label: z.string().max(260),
  status: z.enum(criterionStatuses),
  /** Дословная выдержка из резюме, подтверждающая оценку. */
  evidence: z.string().max(400).nullable(),
  comment: z.string().max(400).nullable(),
  weight: z.number().min(0).max(100),
});
export type Criterion = z.infer<typeof CriterionSchema>;

export const verdicts = ["strong", "partial", "weak", "insufficient"] as const;
export type Verdict = (typeof verdicts)[number];

export const AnalysisSchema = z.object({
  /** 0–100: доля подтверждённых критериев с учётом весов. */
  score: z.number().int().min(0).max(100),
  /** Какая доля критериев вообще поддаётся оценке по этому резюме. */
  coverage: z.number().min(0).max(1),
  verdict: z.enum(verdicts),
  summary: z.string().max(900),
  criteria: z.array(CriterionSchema).max(60),
  strengths: z.array(z.string().max(400)).max(12),
  gaps: z.array(z.string().max(400)).max(12),
  toClarify: z.array(z.string().max(400)).max(12),
  questions: z.array(z.string().max(500)).max(14),
  engine: z.enum(["rules", "llm"]),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

export const CandidateSchema = z.object({
  id: z.string(),
  mode: ModeSchema,
  addedAt: z.number(),
  source: CandidateSourceSchema,
  resumeText: z.string().max(MAX_RESUME_CHARS),
  facts: ResumeFactsSchema.nullable(),
  analysis: AnalysisSchema.nullable(),
  /** Отпечаток вакансии, по которой сделана оценка: если вакансия изменилась, оценку нужно пересчитать. */
  vacancyKey: z.string().nullable(),
  error: z.string().max(300).nullable(),
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const AnalyzeRequestSchema = z.object({
  vacancy: VacancyDraftSchema,
  resumeText: z.string().trim().min(40, "В резюме слишком мало текста для анализа").max(MAX_RESUME_CHARS),
  name: z.string().trim().max(120).nullable().optional(),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const AnalyzeResponseSchema = z.object({
  facts: ResumeFactsSchema,
  analysis: AnalysisSchema,
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

export const ExtractResponseSchema = z.object({
  text: z.string(),
  format: z.enum(["pdf", "docx", "txt"]),
  truncated: z.boolean(),
});
export type ExtractResponse = z.infer<typeof ExtractResponseSchema>;

/** Порог шорт-листа — рекомендация платформы, а не решение о найме. */
export const SHORTLIST_THRESHOLD = 60;
export const SHORTLIST_SIZE = 5;
