import { z } from "zod";
import { ModeSchema } from "@/domain/candidate/schema";

/**
 * Skill Challenge — практическая проверка навыков на рабочей ситуации.
 * Один движок для всех профессий: шаблон задаёт ситуации и критерии,
 * движок ведёт диалог и строит объяснимый отчёт.
 *
 * Проверка ничего не решает за работодателя и никого не отклоняет.
 */

export const templateIds = ["sales", "barista", "support", "accountant", "logistics", "custom"] as const;
export const TemplateIdSchema = z.enum(templateIds);
export type TemplateId = z.infer<typeof TemplateIdSchema>;

export const difficulties = ["easy", "standard", "hard"] as const;
export const DifficultySchema = z.enum(difficulties);
export type Difficulty = z.infer<typeof DifficultySchema>;

/**
 * scripted — реплики собеседника заранее написаны и не зависят от ответов.
 * llm — реплики генерирует подключённая языковая модель.
 */
export const EngineSchema = z.enum(["scripted", "llm"]);
export type ChallengeEngine = z.infer<typeof EngineSchema>;

export const MIN_STEPS = 3;
export const MAX_STEPS = 7;
export const MAX_ANSWER_CHARS = 2000;

/** Кто вносит ответы: сам кандидат на устройстве работодателя или работодатель с его слов. */
export const AnswerAuthorSchema = z.enum(["candidate", "employer_transcribed", "demo"]);
export type AnswerAuthor = z.infer<typeof AnswerAuthorSchema>;

export const ConsentSchema = z.object({
  /** Версия текста согласия — чтобы знать, на что именно согласился кандидат. */
  version: z.string().max(20),
  at: z.number(),
  author: AnswerAuthorSchema,
});
export type Consent = z.infer<typeof ConsentSchema>;

export const TurnSchema = z.object({
  situationId: z.string().max(40),
  /** Реплика собеседника. */
  prompt: z.string().max(1200),
  promptSource: EngineSchema,
  answer: z.string().max(MAX_ANSWER_CHARS).nullable(),
  answeredAt: z.number().nullable(),
});
export type Turn = z.infer<typeof TurnSchema>;

/** not_assessed — в пройденных шагах не было ситуации, где навык мог проявиться. */
export const levels = ["demonstrated", "partial", "not_observed", "not_assessed"] as const;
export const LevelSchema = z.enum(levels);
export type Level = z.infer<typeof LevelSchema>;

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const CriterionResultSchema = z.object({
  criterionId: z.string().max(40),
  label: z.string().max(120),
  level: LevelSchema,
  /** Наблюдаемые факты: что именно было в ответах. Без оценок личности. */
  facts: z.array(z.string().max(300)).max(6),
  /** Дословная выдержка из ответа кандидата. */
  excerpt: z.string().max(400).nullable(),
  /** Номер шага, из ответа на который взята выдержка. */
  excerptStep: z.number().int().min(1).nullable(),
  explanation: z.string().max(500),
  confidence: ConfidenceSchema,
  toVerify: z.string().max(400),
});
export type CriterionResult = z.infer<typeof CriterionResultSchema>;

export const ReportSchema = z.object({
  results: z.array(CriterionResultSchema).max(12),
  answeredSteps: z.number().int().min(0),
  totalSteps: z.number().int().min(0),
  /** Сколько слов в ответах — от этого зависит уверенность выводов. */
  wordCount: z.number().int().min(0),
  engine: z.enum(["rules", "llm"]),
  createdAt: z.number(),
});
export type ChallengeReport = z.infer<typeof ReportSchema>;

export const challengeStatuses = ["setup", "in_progress", "completed", "stopped"] as const;
export const ChallengeStatusSchema = z.enum(challengeStatuses);
export type ChallengeStatus = z.infer<typeof ChallengeStatusSchema>;

export const CustomSituationSchema = z.object({
  id: z.string().max(40),
  title: z.string().trim().min(2).max(80),
  prompt: z.string().trim().min(10).max(1000),
});
export type CustomSituation = z.infer<typeof CustomSituationSchema>;

export const ChallengeSchema = z.object({
  id: z.string(),
  candidateId: z.string(),
  /** Режим кандидата. DEMO и LIVE не смешиваются. */
  mode: ModeSchema,
  templateId: TemplateIdSchema,
  difficulty: DifficultySchema,
  engine: EngineSchema,
  stepCount: z.number().int().min(MIN_STEPS).max(MAX_STEPS),
  /** Ситуации работодателя — только для шаблона custom. */
  customSituations: z.array(CustomSituationSchema).max(MAX_STEPS).default([]),
  status: ChallengeStatusSchema,
  consent: ConsentSchema.nullable(),
  turns: z.array(TurnSchema).max(MAX_STEPS),
  report: ReportSchema.nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

/** Веса критериев: 0 — не учитывать, 3 — очень важно. Одни для всех кандидатов вакансии. */
export const WeightSchema = z.number().int().min(0).max(3);
export const WeightsSchema = z.record(z.string(), z.record(z.string(), WeightSchema));
export type ChallengeWeights = z.infer<typeof WeightsSchema>;

export const CONSENT_VERSION = "2026-11-19";
