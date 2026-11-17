"use client";

import { useId, useState } from "react";
import {
  compensationModelLabels,
  currencySymbols,
  employmentLabels,
  periodLabels,
  workFormatLabels,
} from "@/domain/vacancy/format";
import { applyPatch } from "@/domain/vacancy/merge";
import {
  compensationModels,
  currencies,
  employmentTypes,
  payPeriods,
  workFormats,
  type CompensationModel,
  type Currency,
  type EmploymentType,
  type PayPeriod,
  type VacancyDraft,
  type WorkFormat,
} from "@/domain/vacancy/schema";

interface Props {
  draft: VacancyDraft;
  onSave: (draft: VacancyDraft) => void;
  onCancel: () => void;
}

type ExperienceChoice = "unknown" | "none" | "required";
type InterviewChoice = "unknown" | "on" | "off";

const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.replace(/^[\s—–-]+/, "").trim())
    .filter(Boolean);

const digits = (value: string) => {
  const number = Number(value.replace(/[^\d]/g, ""));
  return number > 0 ? number : null;
};

export function VacancyEditor({ draft, onSave, onCancel }: Props) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const [title, setTitle] = useState(draft.title ?? "");
  const [headcount, setHeadcount] = useState(String(draft.headcount));
  const [city, setCity] = useState(draft.city ?? "");
  const [business, setBusiness] = useState(draft.business ?? "");
  const [models, setModels] = useState<CompensationModel[]>(draft.compensation.models);
  const [amountFrom, setAmountFrom] = useState(draft.compensation.amountFrom?.toString() ?? "");
  const [amountTo, setAmountTo] = useState(
    draft.compensation.amountTo !== null && draft.compensation.amountTo !== draft.compensation.amountFrom
      ? draft.compensation.amountTo.toString()
      : "",
  );
  const [currency, setCurrency] = useState<Currency>(draft.compensation.currency);
  const [period, setPeriod] = useState<PayPeriod>(draft.compensation.period);
  const [note, setNote] = useState(draft.compensation.note ?? "");
  const [schedule, setSchedule] = useState(draft.schedule ?? "");
  const [employment, setEmployment] = useState<EmploymentType | "">(draft.employmentType ?? "");
  const [format, setFormat] = useState<WorkFormat | "">(draft.workFormat ?? "");
  const [experience, setExperience] = useState<ExperienceChoice>(
    draft.experienceRequired === null ? "unknown" : draft.experienceRequired ? "required" : "none",
  );
  const [years, setYears] = useState(draft.experienceMinYears?.toString() ?? "");
  const [interview, setInterview] = useState<InterviewChoice>(
    draft.aiInterview === null ? "unknown" : draft.aiInterview ? "on" : "off",
  );
  const [responsibilities, setResponsibilities] = useState(draft.responsibilities.join("\n"));
  const [requirements, setRequirements] = useState(draft.requirements.join("\n"));
  const [conditions, setConditions] = useState(draft.conditions.join("\n"));
  const [error, setError] = useState<string | null>(null);

  function save() {
    const from = digits(amountFrom);
    const to = digits(amountTo);
    if (from !== null && to !== null && to < from) {
      setError("Верхняя граница оплаты меньше нижней. Исправьте суммы.");
      return;
    }
    const openEnded = draft.compensation.amountFrom !== null && draft.compensation.amountTo === null;
    try {
      const next = applyPatch(draft, {
        title: title.trim() || null,
        headcount: Math.min(500, Math.max(1, Number(headcount) || 1)),
        city: city.trim() || null,
        business: business.trim() || null,
        schedule: schedule.trim() || null,
        employmentType: employment || null,
        workFormat: format || null,
        experienceRequired: experience === "unknown" ? null : experience === "required",
        experienceMinYears: experience === "required" ? (digits(years) ?? null) : null,
        aiInterview: interview === "unknown" ? null : interview === "on",
        responsibilities: lines(responsibilities),
        requirements: lines(requirements),
        conditions: lines(conditions),
        compensation: {
          models,
          // Одна заполненная сумма — точная оплата; две — вилка. «От 500 000» остаётся открытой границей.
          amountFrom: from,
          amountTo: to ?? (openEnded && from === draft.compensation.amountFrom ? null : from),
          currency,
          period,
          note: note.trim() || null,
        },
      });
      onSave(next);
    } catch {
      setError("Не получилось сохранить: одно из полей слишком длинное. Сократите текст и повторите.");
    }
  }

  return (
    <form
      aria-label="Изменение вакансии"
      className="rounded-card border border-line bg-surface p-6 shadow-lift sm:p-9"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <h2 className="text-2xl font-light tracking-[-0.015em] sm:text-3xl">Условия вакансии</h2>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor={id("title")}>Должность</label>
          <input id={id("title")} className="field" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={id("city")}>Город</label>
          <input id={id("city")} className="field" value={city} maxLength={160} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={id("headcount")}>Сколько человек нужно</label>
          <input
            id={id("headcount")}
            className="field"
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            value={headcount}
            onChange={(e) => setHeadcount(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={id("business")}>Компания или тип бизнеса</label>
          <input id={id("business")} className="field" value={business} maxLength={160} onChange={(e) => setBusiness(e.target.value)} />
        </div>
      </div>

      <fieldset className="mt-8">
        <legend className="text-lg font-medium">Оплата</legend>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Варианты оплаты">
          {compensationModels.map((model) => {
            const active = models.includes(model);
            return (
              <button
                key={model}
                type="button"
                className="chip"
                aria-pressed={active}
                onClick={() => setModels((current) => (active ? current.filter((m) => m !== model) : [...current, model]))}
              >
                {compensationModelLabels[model]}
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor={id("from")}>Сумма от</label>
            <input id={id("from")} className="field" inputMode="numeric" value={amountFrom} onChange={(e) => setAmountFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor={id("to")}>Сумма до</label>
            <input id={id("to")} className="field" inputMode="numeric" value={amountTo} placeholder="Если вилка" onChange={(e) => setAmountTo(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor={id("currency")}>Валюта</label>
            <select id={id("currency")} className="field" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code} {currencySymbols[code]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={id("period")}>Период</label>
            <select id={id("period")} className="field" value={period} onChange={(e) => setPeriod(e.target.value as PayPeriod)}>
              {payPeriods.map((value) => (
                <option key={value} value={value}>
                  {periodLabels[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <label className="label" htmlFor={id("note")}>Проценты, бонусы, KPI</label>
            <input id={id("note")} className="field" value={note} maxLength={160} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-8">
        <legend className="text-lg font-medium">Формат работы</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor={id("schedule")}>График</label>
            <input id={id("schedule")} className="field" value={schedule} maxLength={160} placeholder="Например, 5/2" onChange={(e) => setSchedule(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor={id("employment")}>Занятость</label>
            <select id={id("employment")} className="field" value={employment} onChange={(e) => setEmployment(e.target.value as EmploymentType | "")}>
              <option value="">Не указано</option>
              {employmentTypes.map((value) => (
                <option key={value} value={value}>
                  {employmentLabels[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={id("format")}>Где работать</label>
            <select id={id("format")} className="field" value={format} onChange={(e) => setFormat(e.target.value as WorkFormat | "")}>
              <option value="">Не указано</option>
              {workFormats.map((value) => (
                <option key={value} value={value}>
                  {workFormatLabels[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={id("experience")}>Опыт работы</label>
            <select id={id("experience")} className="field" value={experience} onChange={(e) => setExperience(e.target.value as ExperienceChoice)}>
              <option value="unknown">Не указано</option>
              <option value="none">Не обязателен</option>
              <option value="required">Обязателен</option>
            </select>
          </div>
          {experience === "required" ? (
            <div>
              <label className="label" htmlFor={id("years")}>Опыт от, лет</label>
              <input id={id("years")} className="field" inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} />
            </div>
          ) : null}
          <div>
            <label className="label" htmlFor={id("interview")}>Предварительное ИИ-интервью</label>
            <select id={id("interview")} className="field" value={interview} onChange={(e) => setInterview(e.target.value as InterviewChoice)}>
              <option value="unknown">Не указано</option>
              <option value="on">Включено, с согласия кандидата</option>
              <option value="off">Не проводится</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-8">
        <legend className="text-lg font-medium">Описание</legend>
        <p className="mt-1 text-[0.9375rem] text-muted">Каждый пункт — с новой строки.</p>
        <div className="mt-3 grid gap-4">
          <div>
            <label className="label" htmlFor={id("responsibilities")}>Обязанности</label>
            <textarea id={id("responsibilities")} className="field leading-relaxed" rows={4} value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor={id("requirements")}>Требования</label>
            <textarea id={id("requirements")} className="field leading-relaxed" rows={3} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor={id("conditions")}>Условия</label>
            <textarea id={id("conditions")} className="field leading-relaxed" rows={3} value={conditions} onChange={(e) => setConditions(e.target.value)} />
          </div>
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="mt-6 rounded-field border border-danger/30 bg-danger-wash px-4 py-3 leading-relaxed text-ink">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <button type="submit" className="btn btn-primary">
          Сохранить изменения
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          Отменить
        </button>
      </div>
    </form>
  );
}
