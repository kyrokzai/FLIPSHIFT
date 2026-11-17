"use client";

import { useState } from "react";
import {
  compensationLines,
  employmentLabels,
  formatAiInterview,
  formatExperience,
  formatHeadcount,
  renderVacancyText,
  workFormatLabels,
} from "@/domain/vacancy/format";
import { missingForConfirmation } from "@/domain/vacancy/questions";
import type { VacancyDraft } from "@/domain/vacancy/schema";

interface Props {
  draft: VacancyDraft;
  status: "draft" | "confirmed";
  busy: boolean;
  onEdit: () => void;
  onConfirm: () => void;
  onReopen: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-4 py-3 sm:grid-cols-[10rem_1fr]">
      <dt className="text-[0.9375rem] text-muted">{label}</dt>
      <dd className="min-w-0 leading-relaxed text-ink">
        {children ?? <span className="text-muted">Не указано</span>}
      </dd>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-7">
      <h3 className="text-[0.9375rem] font-medium text-ink-soft">{title}</h3>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="relative pl-5 leading-relaxed before:absolute before:left-0 before:top-[0.7em] before:h-px before:w-2.5 before:bg-gold">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function VacancyCard({ draft, status, busy, onEdit, onConfirm, onReopen }: Props) {
  const [copied, setCopied] = useState(false);
  const missing = missingForConfirmation(draft);
  const confirmed = status === "confirmed";
  const pay = compensationLines(draft.compensation);

  async function copy() {
    try {
      await navigator.clipboard.writeText(renderVacancyText(draft));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article aria-label="Вакансия" className="rounded-card border border-line bg-surface p-6 shadow-lift sm:p-9">
      <p className={`text-sm font-medium ${confirmed ? "text-ok" : "text-gold-deep"}`}>
        {confirmed ? "Вакансия подтверждена" : "Черновик вакансии"}
      </p>
      <h2 className="mt-2 text-[1.75rem] font-light leading-[1.15] tracking-[-0.02em] sm:text-4xl">
        {draft.title ?? <span className="text-muted">Должность не указана</span>}
      </h2>

      <dl className="mt-6 divide-y divide-line border-y border-line">
        <Row label="Город">{draft.city ?? (draft.workFormat === "remote" ? "Удалённая работа" : null)}</Row>
        {draft.business ? <Row label="Компания">{draft.business}</Row> : null}
        <Row label="Нужно">{formatHeadcount(draft.headcount)}</Row>
        <Row label="Оплата">
          {pay.length > 0 ? (
            <span className="flex flex-col gap-0.5">
              {pay.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          ) : null}
        </Row>
        <Row label="График">{draft.schedule}</Row>
        <Row label="Занятость">{draft.employmentType ? employmentLabels[draft.employmentType] : null}</Row>
        <Row label="Формат">{draft.workFormat ? workFormatLabels[draft.workFormat] : null}</Row>
        <Row label="Опыт">{formatExperience(draft)}</Row>
        <Row label="ИИ-интервью">{formatAiInterview(draft.aiInterview)}</Row>
      </dl>

      <List title="Обязанности" items={draft.responsibilities} />
      <List title="Требования" items={draft.requirements} />
      <List title="Условия" items={draft.conditions} />

      {confirmed ? (
        <div className="mt-8 rounded-field bg-paper px-4 py-4 sm:px-5">
          <p className="leading-relaxed text-ink-soft">
            Следующий шаг — поиск кандидатов. Он запускается из кабинета работодателя: вход и сохранение вакансий
            в аккаунте появятся на следующем этапе разработки. Пока текст вакансии можно скопировать и разместить
            самостоятельно.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" className="btn btn-primary" onClick={copy}>
              {copied ? "Текст скопирован" : "Скопировать текст вакансии"}
            </button>
            <button type="button" className="btn-text text-[0.9375rem]" onClick={onReopen}>
              Вернуть в черновик
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          {missing.length > 0 ? (
            <p className="mb-3 text-[0.9375rem] leading-relaxed text-muted">
              Чтобы подтвердить вакансию, укажите: {missing.join(", ")}.
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="button" className="btn btn-primary" disabled={busy || missing.length > 0} onClick={onConfirm}>
              Подтвердить вакансию
            </button>
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={onEdit}>
              Изменить условия
            </button>
            <button type="button" className="btn btn-quiet" onClick={copy}>
              {copied ? "Текст скопирован" : "Скопировать текст"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
