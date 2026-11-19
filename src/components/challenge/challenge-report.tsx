"use client";

import { confidenceLabels, levelLabels, weightedShare, weightsFor } from "@/domain/challenge/engine";
import type { Challenge, ChallengeWeights, Level } from "@/domain/challenge/schema";
import { TEMPLATES } from "@/domain/challenge/templates";
import { setChallengeWeight } from "@/lib/challenge-actions";

const LEVEL_TONE: Record<Level, string> = {
  demonstrated: "text-ok",
  partial: "text-gold-deep",
  not_observed: "text-danger",
  not_assessed: "text-muted",
};

const WEIGHT_LABELS = ["Не учитывать", "Низкий", "Средний", "Высокий"];

export function ChallengeReportView({
  sessionId,
  challenge,
  weights,
  editableWeights = true,
}: {
  sessionId: string;
  challenge: Challenge;
  weights: ChallengeWeights;
  editableWeights?: boolean;
}) {
  const report = challenge.report;
  if (!report) return null;
  const template = TEMPLATES[challenge.templateId];
  const current = weightsFor(challenge.templateId, weights);
  const share = weightedShare(report, current);
  const demo = challenge.mode === "demo";

  return (
    <section aria-label="Отчёт о проверке" className="flex flex-col gap-5">
      <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
        <p className={`text-sm font-medium ${demo ? "text-gold-deep" : "text-ink-soft"}`}>
          {demo ? "Демо: вымышленный кандидат и вымышленные ответы" : challenge.status === "stopped" ? "Остановлено досрочно" : "Проверка завершена"}
        </p>
        <h2 className="mt-1 text-2xl font-normal tracking-[-0.01em]">{template.title}</h2>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Отвечено ситуаций: {report.answeredSteps} из {report.totalSteps}.{" "}
          {share === null ? "Оценивать нечего: ответов нет или все веса равны нулю." : `Навыки проявлены с учётом ваших весов на ${share}%.`}
        </p>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
          Оценка встроенная: она ищет в ответах признаки навыка — вопросы, доводы, этапы, следующий шаг — и не понимает смысла, поэтому уверенность
          выводов низкая или средняя. Это материал для разговора, а не решение: проверка не отклоняет кандидата.
        </p>
      </div>

      <ul className="flex flex-col gap-3" aria-label="Критерии">
        {report.results.map((result) => (
          <li key={result.criterionId} className="rounded-card border border-line bg-surface p-5" data-testid={`criterion-${result.criterionId}`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-medium leading-snug">{result.label}</h3>
              <span className={`shrink-0 text-sm font-medium ${LEVEL_TONE[result.level]}`}>{levelLabels[result.level]}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{confidenceLabels[result.confidence]}</p>

            <h4 className="mt-3 text-[0.9375rem] font-medium text-ink-soft">Наблюдаемые факты</h4>
            <ul className="mt-1 flex flex-col gap-1 text-[0.9375rem] leading-relaxed">
              {result.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>

            {result.excerpt ? (
              <blockquote className="mt-3 border-l-2 border-gold pl-3 leading-relaxed text-ink-soft">
                «{result.excerpt}»
                <span className="mt-0.5 block text-sm text-muted">Ответ на шаг {result.excerptStep}</span>
              </blockquote>
            ) : null}

            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">{result.explanation}</p>
            <p className="mt-2 text-[0.9375rem] leading-relaxed">
              <span className="font-medium">Проверить дополнительно: </span>
              {result.toVerify}
            </p>

            {editableWeights ? (
              <label className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9375rem]">
                <span className="text-muted">Вес критерия</span>
                <select
                  className="field w-auto min-w-40"
                  value={current[result.criterionId] ?? 0}
                  onChange={(event) => setChallengeWeight(sessionId, challenge.templateId, result.criterionId, Number(event.target.value))}
                  aria-label={`Вес: ${result.label}`}
                >
                  {WEIGHT_LABELS.map((label, value) => (
                    <option key={label} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </li>
        ))}
      </ul>

      {editableWeights ? (
        <p className="text-sm leading-relaxed text-muted">Веса общие для всех кандидатов этой вакансии — так проверки остаются сравнимыми.</p>
      ) : null}
    </section>
  );
}
