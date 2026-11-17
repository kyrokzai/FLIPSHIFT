"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteSession, useHydrated, useSessions } from "@/lib/sessions";

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function VacancyList() {
  const hydrated = useHydrated();
  const sessions = useSessions();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (!hydrated) {
    return <p className="mt-8 text-muted">Загружаю вакансии…</p>;
  }

  if (sessions.length === 0) {
    return (
      <div className="mt-8">
        <p className="max-w-[52ch] text-lg leading-relaxed text-ink-soft">
          Здесь появятся вакансии, которые вы соберёте. Начните с описания: кого ищете, где и на каких условиях.
        </p>
        <Link href="/" className="btn btn-primary mt-6">
          Описать вакансию
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="mt-4 max-w-[60ch] leading-relaxed text-muted">
        Вакансии хранятся только в этом браузере. Вход в аккаунт и сохранение для команды появятся на следующем этапе
        разработки.
      </p>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {sessions.map((session) => {
          const title = session.draft?.title ?? "Вакансия без названия";
          const facts = [session.draft?.city, session.draft?.business].filter(Boolean).join(", ");
          return (
            <li key={session.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
              <Link href={`/vacancies/${session.id}`} className="group min-w-0 flex-1 rounded-md">
                <span className="block truncate text-lg font-medium group-hover:underline group-hover:underline-offset-4">
                  {title}
                </span>
                <span className="mt-1 block text-sm text-muted">
                  {session.status === "confirmed" ? "Подтверждена" : "Черновик"}
                  {facts ? `, ${facts}` : ""} — изменена {dateFormat.format(session.updatedAt)}
                </span>
              </Link>
              {confirmingId === session.id ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-quiet text-danger"
                    onClick={() => {
                      deleteSession(session.id);
                      setConfirmingId(null);
                    }}
                  >
                    Удалить вакансию
                  </button>
                  <button type="button" className="btn-text text-sm" onClick={() => setConfirmingId(null)}>
                    Отмена
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn-text self-start text-sm sm:self-auto"
                  aria-label={`Удалить вакансию «${title}»`}
                  onClick={() => setConfirmingId(session.id)}
                >
                  Удалить
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <Link href="/" className="btn btn-quiet mt-8">
        Описать ещё одну вакансию
      </Link>
    </>
  );
}
