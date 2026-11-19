"use client";

import Link from "next/link";
import { useState } from "react";
import { verdictLabels } from "@/domain/candidate/match";
import { weightedShare, weightsFor } from "@/domain/challenge/engine";
import type { Challenge, ChallengeWeights } from "@/domain/challenge/schema";
import { TEMPLATES, suggestTemplate } from "@/domain/challenge/templates";
import type { Candidate, Criterion } from "@/domain/candidate/schema";
import { formatNumber, currencySymbols, plural } from "@/domain/vacancy/format";

const MARK: Record<Criterion["status"], { label: string; className: string }> = {
  met: { label: "Подтверждено", className: "text-ok" },
  partial: { label: "Частично", className: "text-gold-deep" },
  missing: { label: "Не найдено", className: "text-danger" },
  unknown: { label: "Уточнить", className: "text-muted" },
};

export function candidateName(candidate: Candidate, index: number): string {
  return candidate.facts?.name ?? `Кандидат ${index + 1}`;
}

/** Имена для всех кандидатов вакансии. Безымянные нумеруются внутри своего режима — как в списке кандидатов. */
export function candidateNames(candidates: Candidate[]): Record<string, string> {
  const counters: Record<string, number> = {};
  return Object.fromEntries(
    candidates.map((candidate) => {
      const index = counters[candidate.mode] ?? 0;
      counters[candidate.mode] = index + 1;
      return [candidate.id, candidateName(candidate, index)];
    }),
  );
}

function Facts({ candidate }: { candidate: Candidate }) {
  const facts = candidate.facts;
  if (!facts) return null;
  const rows: Array<[string, string]> = [];
  if (facts.headline) rows.push(["В резюме", facts.headline]);
  if (facts.experienceYears !== null) {
    rows.push(["Стаж", `${String(facts.experienceYears).replace(".", ",")} ${plural(Math.floor(facts.experienceYears), ["год", "года", "лет"])}`]);
  }
  if (facts.city) rows.push(["Город", facts.relocation ? `${facts.city}, готов к переезду` : facts.city]);
  if (facts.salaryExpectation) {
    rows.push(["Ожидания", `${formatNumber(facts.salaryExpectation.amount)} ${currencySymbols[facts.salaryExpectation.currency]}`]);
  }
  if (facts.positions.length) rows.push(["Должности", facts.positions.slice(0, 4).join("; ")]);
  if (rows.length === 0) return null;
  return (
    <dl className="mt-4 grid gap-x-4 gap-y-1.5 text-[0.9375rem] sm:grid-cols-[7rem_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="mb-1 min-w-0 break-words leading-relaxed sm:mb-0">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface Props {
  sessionId: string;
  vacancyTitle: string | null;
  candidate: Candidate;
  index: number;
  stale: boolean;
  challenges: Challenge[];
  weights: ChallengeWeights;
  inCompare: boolean;
  compareFull: boolean;
  onToggleCompare: () => void;
  onShowHistory: () => void;
  onRemove: () => void;
  onRetry: () => void;
}

function ChallengeSummary({ sessionId, challenges, weights }: { sessionId: string; challenges: Challenge[]; weights: ChallengeWeights }) {
  const latest = [...challenges].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!latest) return null;
  const href = `/vacancies/${sessionId}/hiring/challenge/${latest.id}`;
  const share = latest.report ? weightedShare(latest.report, weightsFor(latest.templateId, weights)) : null;
  const status =
    latest.status === "setup"
      ? "ожидает согласия кандидата"
      : latest.status === "in_progress"
        ? `идёт, отвечено ${latest.turns.filter((t) => t.answer !== null).length} из ${latest.stepCount}`
        : `${latest.status === "stopped" ? "остановлена досрочно" : "завершена"}${share === null ? "" : `, навыки проявлены на ${share}%`}`;
  return (
    <p className="mt-4 rounded-field bg-paper px-4 py-3 text-[0.9375rem] leading-relaxed" data-testid="challenge-summary">
      <span className="font-medium">Проверка навыков:</span> {TEMPLATES[latest.templateId].title.toLowerCase()} — {status}.{" "}
      <Link href={href} className="underline underline-offset-4 hover:text-ink">
        {latest.report ? "Открыть отчёт" : "Продолжить"}
      </Link>
    </p>
  );
}

export function CandidateCard({ sessionId, vacancyTitle, candidate, index, stale, challenges, weights, inCompare, compareFull, onToggleCompare, onShowHistory, onRemove, onRetry }: Props) {
  const [confirming, setConfirming] = useState(false);
  const { analysis, source } = candidate;
  const name = candidateName(candidate, index);
  const demo = candidate.mode === "demo";

  return (
    <li className="rounded-card border border-line bg-surface p-5 sm:p-6" data-testid="candidate-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-medium leading-snug">
            {name}
            {demo ? <span className="ml-2 whitespace-nowrap rounded-full bg-gold-wash px-2 py-0.5 text-xs font-medium text-gold-deep">Демо, вымышлен</span> : null}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Источник: {source.label}
            {source.fileName ? `, файл ${source.fileName}` : ""}
            {source.url ? (
              <>
                {" — "}
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-ink">
                  открыть оригинал
                </a>
              </>
            ) : null}
          </p>
        </div>
        {analysis ? (
          <p className="shrink-0 text-right">
            <span className="block text-2xl font-light leading-none tracking-[-0.02em]">{analysis.verdict === "insufficient" ? "—" : `${analysis.score}%`}</span>
            <span className="mt-1 block text-xs font-medium text-ink-soft">{verdictLabels[analysis.verdict]}</span>
          </p>
        ) : null}
      </div>

      {candidate.error ? (
        <div role="alert" className="mt-4 rounded-field border border-danger/30 bg-danger-wash px-4 py-3">
          <p className="leading-relaxed">{candidate.error}</p>
          <button type="button" className="btn btn-quiet mt-3" onClick={onRetry}>
            Повторить анализ
          </button>
        </div>
      ) : !analysis ? (
        <p className="mt-4 animate-pulse text-muted" role="status">
          Анализирую резюме…
        </p>
      ) : (
        <>
          <p className="mt-4 leading-relaxed text-ink">{analysis.summary}</p>
          {stale ? (
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-gold-deep">Оценка сделана по прежним условиям вакансии.</p>
          ) : null}
          <Facts candidate={candidate} />

          <details className="group mt-4">
            <summary className="inline-flex min-h-11 list-none items-center text-[0.9375rem] font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Показать разбор по критериям и вопросы</span>
              <span className="hidden group-open:inline">Скрыть разбор</span>
            </summary>

            <ul className="mt-3 divide-y divide-line border-y border-line">
              {analysis.criteria.map((criterion) => (
                <li key={criterion.id} className="py-3.5">
                  <p className="flex items-start justify-between gap-3">
                    <span className="min-w-0 leading-snug">{criterion.label}</span>
                    <span className={`shrink-0 text-sm font-medium ${MARK[criterion.status].className}`}>{MARK[criterion.status].label}</span>
                  </p>
                  {criterion.evidence ? (
                    <blockquote className="mt-1.5 border-l-2 border-gold pl-3 text-[0.9375rem] leading-relaxed text-ink-soft">{criterion.evidence}</blockquote>
                  ) : null}
                  {criterion.comment ? <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted">{criterion.comment}</p> : null}
                </li>
              ))}
            </ul>

            {analysis.questions.length > 0 ? (
              <section className="mt-5">
                <h4 className="text-[0.9375rem] font-medium text-ink-soft">Вопросы этому кандидату</h4>
                <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 leading-relaxed marker:text-gold-deep">
                  {analysis.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ol>
              </section>
            ) : null}

            <p className="mt-4 text-sm leading-relaxed text-muted">
              {analysis.engine === "llm" ? "Оценка уточнена языковой моделью; цитаты проверены по тексту резюме." : "Оценка сделана встроенным разбором по совпадению формулировок."}{" "}
              Возраст, пол, семейное положение и другие личные признаки не учитываются.
            </p>
          </details>
        </>
      )}

      <ChallengeSummary sessionId={sessionId} challenges={challenges} weights={weights} />

      {analysis ? (
        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
          <Link href={`/vacancies/${sessionId}/hiring/candidate/${candidate.id}/challenge`} className="btn btn-quiet">
            {TEMPLATES[suggestTemplate(vacancyTitle)].action}
          </Link>
          <button
            type="button"
            className="btn btn-quiet"
            aria-pressed={inCompare}
            disabled={!inCompare && compareFull}
            title={!inCompare && compareFull ? "В сравнении уже три кандидата" : undefined}
            onClick={onToggleCompare}
          >
            {inCompare ? "Убрать из сравнения" : "Добавить к сравнению"}
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4">
        <button type="button" className="btn-text text-sm" onClick={onShowHistory}>
          История действий
        </button>
        {confirming ? (
          <>
            <button type="button" className="btn btn-quiet text-danger" onClick={onRemove}>
              Удалить резюме
            </button>
            <button type="button" className="btn-text text-sm" onClick={() => setConfirming(false)}>
              Отмена
            </button>
          </>
        ) : (
          <button type="button" className="btn-text text-sm" aria-label={`Удалить: ${name}`} onClick={() => setConfirming(true)}>
            Удалить
          </button>
        )}
      </div>
    </li>
  );
}
