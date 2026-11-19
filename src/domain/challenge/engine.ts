import { CONSENT_VERSION, MAX_STEPS, MIN_STEPS, type Challenge, type ChallengeReport, type ChallengeWeights, type Confidence, type CriterionResult, type CustomSituation, type Difficulty, type Level, type Turn } from "./schema";
import { TEMPLATES, type ChallengeTemplate, type Marker, type Situation, type TemplateCriterion } from "./templates";

/**
 * Движок Skill Challenge: выбор ситуаций, ход диалога по сценарию и
 * объяснимая оценка по наблюдаемым признакам в ответах.
 *
 * Встроенная оценка ищет в тексте признаки навыка — вопросы, аргументы,
 * этапы, следующий шаг. Она не понимает смысл ответа, поэтому уверенность
 * её выводов не бывает высокой, и отчёт говорит об этом прямо.
 */

export function situationsFor(templateId: Challenge["templateId"], custom: CustomSituation[]): Situation[] {
  if (templateId === "custom") {
    return custom.map((item) => ({ id: item.id, title: item.title, objection: false, prompts: { easy: item.prompt, standard: item.prompt, hard: item.prompt } }));
  }
  return TEMPLATES[templateId].situations;
}

export function maxStepsFor(templateId: Challenge["templateId"], custom: CustomSituation[]): number {
  return Math.min(MAX_STEPS, situationsFor(templateId, custom).length);
}

/** N ситуаций из шаблона: первая и последняя всегда, остальные — равномерно. */
export function pickSituations(all: Situation[], count: number): Situation[] {
  const n = Math.max(1, Math.min(count, all.length));
  if (n >= all.length) return all;
  if (n === 1) return [all[0]!];
  const indexes = new Set<number>();
  for (let i = 0; i < n; i++) indexes.add(Math.round((i * (all.length - 1)) / (n - 1)));
  return [...indexes].sort((a, b) => a - b).map((i) => all[i]!);
}

export function plannedSituations(challenge: Pick<Challenge, "templateId" | "customSituations" | "stepCount">): Situation[] {
  return pickSituations(situationsFor(challenge.templateId, challenge.customSituations), challenge.stepCount);
}

export function scriptedPrompt(situation: Situation, difficulty: Difficulty): string {
  return situation.prompts[difficulty];
}

export function createTurn(situation: Situation, difficulty: Difficulty, prompt?: string): Turn {
  return {
    situationId: situation.id,
    prompt: (prompt ?? scriptedPrompt(situation, difficulty)).slice(0, 1200),
    promptSource: prompt ? "llm" : "scripted",
    answer: null,
    answeredAt: null,
  };
}

/** Следующая ситуация или null, если сценарий пройден. */
export function nextSituation(challenge: Challenge): Situation | null {
  return plannedSituations(challenge)[challenge.turns.length] ?? null;
}

export function validateSetup(input: { templateId: Challenge["templateId"]; stepCount: number; customSituations: CustomSituation[] }): string | null {
  const available = situationsFor(input.templateId, input.customSituations).length;
  if (input.templateId === "custom" && available < MIN_STEPS) return `Добавьте хотя бы ${MIN_STEPS} ситуации для своего сценария.`;
  if (input.stepCount < MIN_STEPS || input.stepCount > MAX_STEPS) return `Количество шагов — от ${MIN_STEPS} до ${MAX_STEPS}.`;
  if (input.stepCount > available) return `В этом сценарии ${available} ситуаций — выберите не больше ${available} шагов.`;
  return null;
}

export { CONSENT_VERSION };

// ------------------------------------------------------------------ оценка

interface Answer {
  step: number;
  text: string;
  situation: Situation | undefined;
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

const clip = (text: string) => (text.length > 240 ? `${text.slice(0, 237).trimEnd()}…` : text);
const stepsText = (steps: number[]) => {
  const unique = [...new Set(steps)].sort((a, b) => a - b);
  return unique.length === 1 ? `шаг ${unique[0]}` : `шаги ${unique.join(", ")}`;
};
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function findMarkers(answers: Answer[], markers: Marker[]) {
  const found = new Map<string, number[]>();
  for (const answer of answers) {
    for (const marker of markers) {
      if (marker.pattern.test(answer.text)) found.set(marker.label, [...(found.get(marker.label) ?? []), answer.step]);
    }
  }
  return found;
}

/** Предложение ответа, в котором больше всего признаков. */
function bestSentence(answers: Answer[], markers: Marker[]): { text: string; step: number } | null {
  let best: { text: string; step: number; hits: number } | null = null;
  for (const answer of answers) {
    for (const sentence of sentences(answer.text)) {
      const hits = markers.filter((marker) => marker.pattern.test(sentence)).length;
      if (hits > 0 && (!best || hits > best.hits)) best = { text: sentence, step: answer.step, hits };
    }
  }
  return best ? { text: clip(best.text), step: best.step } : null;
}

function confidenceFor(level: Level, totalWords: number, evidenceSteps: number): Confidence {
  // Встроенная оценка ищет признаки в тексте и не понимает смысла — высокой уверенности у неё не бывает.
  if (totalWords < 60) return "low";
  if (level === "demonstrated") return evidenceSteps >= 2 ? "medium" : "low";
  if (level === "not_observed") return totalWords >= 120 ? "medium" : "low";
  return "low";
}

function evaluateCriterion(criterion: TemplateCriterion, answers: Answer[], totalWords: number): CriterionResult {
  const base = { criterionId: criterion.id, label: criterion.label };
  const describe = lowerFirst(criterion.description.replace(/\.$/, ""));
  const finish = (level: Level, facts: string[], excerpt: { text: string; step: number } | null, explanation: string, evidenceSteps: number): CriterionResult => ({
    ...base,
    level,
    facts: facts.slice(0, 6),
    excerpt: excerpt?.text ?? null,
    excerptStep: excerpt?.step ?? null,
    explanation,
    confidence: level === "not_assessed" ? "low" : confidenceFor(level, totalWords, evidenceSteps),
    toVerify: level === "demonstrated" ? criterion.verifyIfShown : criterion.verifyIfMissing,
  });

  if (answers.length === 0) return finish("not_assessed", ["Ответов нет."], null, "Кандидат не ответил ни на одну ситуацию.", 0);

  switch (criterion.kind) {
    case "questions": {
      const asked: Array<{ text: string; step: number }> = [];
      for (const answer of answers) {
        for (const sentence of sentences(answer.text)) {
          if (sentence.endsWith("?") && (!criterion.topic || criterion.topic.test(sentence))) asked.push({ text: sentence, step: answer.step });
        }
      }
      const steps = asked.map((item) => item.step);
      const level: Level = asked.length >= criterion.target ? "demonstrated" : asked.length > 0 ? "partial" : "not_observed";
      const facts = asked.length
        ? [`Задано вопросов${criterion.topic ? " о задаче собеседника" : ""}: ${asked.length} (${stepsText(steps)}).`, ...asked.slice(1, 3).map((item) => `Ещё вопрос: «${clip(item.text)}»`)]
        : [`Вопросов${criterion.topic ? " о задаче собеседника" : ""} в ответах нет.`];
      const explanation =
        level === "not_observed"
          ? `В ответах нет вопросов собеседнику. Навык — ${describe} — в этом тексте не проявился; это не значит, что его нет.`
          : `Ориентир — не меньше ${criterion.target} вопросов. Встроенная оценка считает вопросы, но не оценивает, насколько они удачны.`;
      return finish(level, facts, asked[0] ? { text: clip(asked[0].text), step: asked[0].step } : null, explanation, new Set(steps).size);
    }

    case "markers": {
      const found = findMarkers(answers, criterion.markers);
      const level: Level = found.size >= criterion.target ? "demonstrated" : found.size > 0 ? "partial" : "not_observed";
      const facts = found.size
        ? [...found].map(([label, steps]) => `Упомянуто: ${label} (${stepsText(steps)}).`)
        : ["Признаков этого навыка в ответах нет."];
      const steps = [...found.values()].flat();
      const explanation =
        level === "not_observed"
          ? `Не найдено признаков: ${describe}. Навык в этом тексте не проявился; это не значит, что его нет.`
          : `Найдено признаков: ${found.size}, ориентир — ${criterion.target}. Проверяется наличие доводов в тексте, а не их убедительность.`;
      return finish(level, facts, bestSentence(answers, criterion.markers), explanation, new Set(steps).size);
    }

    case "objection": {
      const objectionAnswers = answers.filter((answer) => answer.situation?.objection);
      if (objectionAnswers.length === 0) {
        return finish("not_assessed", ["В пройденных шагах не было возражений собеседника."], null, "Оценить нельзя: ситуаций с возражением в пройденных шагах не было.", 0);
      }
      let handled = 0;
      let touched = 0;
      const facts: string[] = [];
      for (const answer of objectionAnswers) {
        const ack = criterion.acknowledge.filter((marker) => marker.pattern.test(answer.text)).map((marker) => marker.label);
        const resolve = criterion.resolve.filter((marker) => marker.pattern.test(answer.text)).map((marker) => marker.label);
        if (ack.length && resolve.length) handled++;
        if (ack.length || resolve.length) touched++;
        const parts = [ack.length ? ack.join(", ") : "суть возражения не признана", resolve.length ? resolve.join(", ") : "выход не предложен"];
        facts.push(`Шаг ${answer.step} — «${answer.situation?.title ?? "возражение"}»: ${parts.join("; ")}.`);
      }
      const level: Level = handled >= Math.ceil(objectionAnswers.length / 2) ? "demonstrated" : touched > 0 ? "partial" : "not_observed";
      const explanation = `Ответов на возражения: ${objectionAnswers.length}. С признанием сути и предложенным выходом: ${handled}. Оценка видит структуру ответа, но не его убедительность.`;
      return finish(level, facts, bestSentence(objectionAnswers, [...criterion.acknowledge, ...criterion.resolve]), explanation, handled);
    }

    case "next_step": {
      const last = answers[answers.length - 1]!;
      const inLast = criterion.markers.filter((marker) => marker.pattern.test(last.text)).map((marker) => marker.label);
      const found = findMarkers(answers, criterion.markers);
      const level: Level = inLast.length ? "demonstrated" : found.size ? "partial" : "not_observed";
      const facts = inLast.length
        ? [`В последнем ответе (шаг ${last.step}) предложено: ${inLast.join(", ")}.`]
        : found.size
          ? [...found].map(([label, steps]) => `Упомянуто: ${label} (${stepsText(steps)}), но не в завершении разговора.`)
          : ["Конкретного следующего шага в ответах нет."];
      const explanation =
        level === "demonstrated"
          ? "Разговор завершён конкретным действием. Насколько шаг реалистичен, встроенная оценка не проверяет."
          : level === "partial"
            ? "Следующий шаг упоминается по ходу разговора, но в завершении его нет."
            : "Кандидат не предложил, что произойдёт после разговора.";
      return finish(level, facts, bestSentence(inLast.length ? [last] : answers, criterion.markers), explanation, found.size);
    }
  }
}

export function answersOf(challenge: Challenge): Answer[] {
  const planned = plannedSituations(challenge);
  return challenge.turns.flatMap((turn, index) =>
    turn.answer?.trim()
      ? [{ step: index + 1, text: turn.answer.trim(), situation: planned.find((item) => item.id === turn.situationId) }]
      : [],
  );
}

export function evaluateChallenge(challenge: Challenge, now = Date.now()): ChallengeReport {
  const template: ChallengeTemplate = TEMPLATES[challenge.templateId];
  const answers = answersOf(challenge);
  const wordCount = answers.reduce((sum, answer) => sum + (answer.text.match(/[\p{L}\d]+/gu)?.length ?? 0), 0);
  return {
    results: template.criteria.map((criterion) => evaluateCriterion(criterion, answers, wordCount)),
    answeredSteps: answers.length,
    totalSteps: challenge.stepCount,
    wordCount,
    engine: "rules",
    createdAt: now,
  };
}

// ------------------------------------------------------------------ веса

export function weightsFor(templateId: Challenge["templateId"], weights: ChallengeWeights): Record<string, number> {
  const custom = weights[templateId] ?? {};
  return Object.fromEntries(TEMPLATES[templateId].criteria.map((criterion) => [criterion.id, custom[criterion.id] ?? criterion.defaultWeight]));
}

const LEVEL_VALUE: Record<Level, number | null> = { demonstrated: 1, partial: 0.5, not_observed: 0, not_assessed: null };

/**
 * Взвешенная доля проявленных навыков. null — оценивать нечего.
 * Это сводка для работодателя, а не балл кандидата: решения по ней не принимаются.
 */
export function weightedShare(report: ChallengeReport, weights: Record<string, number>): number | null {
  let total = 0;
  let value = 0;
  for (const result of report.results) {
    const level = LEVEL_VALUE[result.level];
    const weight = weights[result.criterionId] ?? 0;
    if (level === null || weight === 0) continue;
    total += weight;
    value += weight * level;
  }
  return total === 0 ? null : Math.round((value / total) * 100);
}

export const levelLabels: Record<Level, string> = {
  demonstrated: "Проявлено",
  partial: "Частично",
  not_observed: "Не проявлено",
  not_assessed: "Не оценивалось",
};

export const confidenceLabels: Record<Confidence, string> = {
  low: "Низкая уверенность",
  medium: "Средняя уверенность",
  high: "Высокая уверенность",
};
