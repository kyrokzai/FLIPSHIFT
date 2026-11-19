"use client";

import { useId, useState } from "react";
import { actorLabels, eventGroups, eventTypeLabels, statusLabels, type ActivityEvent } from "@/domain/activity/events";
import type { Mode } from "@/domain/candidate/schema";

const timeFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const STATUS_TONE: Record<ActivityEvent["status"], string> = {
  success: "text-ok",
  error: "text-danger",
  needs_permission: "text-gold-deep",
};

interface Props {
  events: ActivityEvent[];
  /** Имена кандидатов и названия вакансий берутся при показе — в журнале их нет. */
  candidateNames: Record<string, string>;
  vacancyTitles?: Record<string, string>;
  /** Если задан — фильтр по вакансии скрыт. */
  fixedMode?: Mode;
  candidateFilter?: string | null;
  onClearCandidate?: () => void;
}

export function ActivityFeed({ events, candidateNames, vacancyTitles, fixedMode, candidateFilter = null, onClearCandidate }: Props) {
  const uid = useId();
  const [group, setGroup] = useState("all");
  const [mode, setMode] = useState<"all" | Mode>(fixedMode ?? "all");
  const [vacancy, setVacancy] = useState("all");

  // Новые сверху; при совпадении времени — в обратном порядке записи.
  const filtered = events
    .map((event, order) => ({ event, order }))
    .sort((a, b) => b.event.at - a.event.at || b.order - a.order)
    .map(({ event }) => event)
    .filter((event) => group === "all" || eventGroups[group]!.types.includes(event.type))
    .filter((event) => mode === "all" || event.mode === mode)
    .filter((event) => vacancy === "all" || event.vacancyId === vacancy)
    .filter((event) => !candidateFilter || event.candidateId === candidateFilter);

  return (
    <section aria-label="Журнал действий">
      <p className="max-w-[64ch] rounded-field bg-paper px-4 py-3 text-[0.9375rem] leading-relaxed text-ink-soft">
        Журнал хранится только в этом браузере и видит только действия, сделанные на этом устройстве. Это не централизованный аудит: он появится
        вместе с аккаунтами и серверным хранилищем. Тексты резюме, ответы кандидатов и контакты в журнал не записываются.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {vacancyTitles ? (
          <div>
            <label className="label" htmlFor={`${uid}-vacancy`}>Вакансия</label>
            <select id={`${uid}-vacancy`} className="field" value={vacancy} onChange={(e) => setVacancy(e.target.value)}>
              <option value="all">Все вакансии</option>
              {Object.entries(vacancyTitles).map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label className="label" htmlFor={`${uid}-group`}>Тип событий</label>
          <select id={`${uid}-group`} className="field" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="all">Все</option>
            {Object.entries(eventGroups).map(([id, item]) => (
              <option key={id} value={id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        {fixedMode ? null : (
          <div>
            <label className="label" htmlFor={`${uid}-mode`}>Режим</label>
            <select id={`${uid}-mode`} className="field" value={mode} onChange={(e) => setMode(e.target.value as "all" | Mode)}>
              <option value="all">DEMO и LIVE</option>
              <option value="live">Только LIVE</option>
              <option value="demo">Только DEMO</option>
            </select>
          </div>
        )}
      </div>

      {candidateFilter ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 text-[0.9375rem]">
          <span>
            Показаны действия по кандидату: <span className="font-medium">{candidateNames[candidateFilter] ?? "удалённый кандидат"}</span>
          </span>
          {onClearCandidate ? (
            <button type="button" className="btn-text text-sm" onClick={onClearCandidate}>
              Показать все
            </button>
          ) : null}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="mt-6 leading-relaxed text-muted">Событий нет. Они появляются, когда вы или агент выполняете действия.</p>
      ) : (
        <ol className="mt-5 divide-y divide-line border-y border-line" aria-label="События">
          {filtered.map((event) => (
            <li key={event.id} className="py-3.5" data-testid="activity-event" data-type={event.type}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium leading-snug">
                  {eventTypeLabels[event.type]}
                  {event.mode === "demo" ? <span className="ml-2 rounded-full bg-gold-wash px-2 py-0.5 text-xs font-medium text-gold-deep">DEMO</span> : null}
                </p>
                <span className={`shrink-0 text-sm font-medium ${STATUS_TONE[event.status]}`}>{statusLabels[event.status]}</span>
              </div>
              <p className="mt-1 leading-relaxed text-ink-soft">{event.result}</p>
              <p className="mt-1 text-sm text-muted">
                {timeFormat.format(event.at)} · {actorLabels[event.actor]}
                {event.candidateId ? ` · ${candidateNames[event.candidateId] ?? "удалённый кандидат"}` : ""}
                {vacancyTitles ? ` · ${vacancyTitles[event.vacancyId] ?? "вакансия"}` : ""}
                {event.source ? ` · источник: ${event.source}` : ""}
                {event.errorCode ? ` · код ошибки: ${event.errorCode}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
