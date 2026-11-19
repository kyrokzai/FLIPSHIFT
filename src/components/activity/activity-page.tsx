"use client";

import { candidateNames } from "@/components/hiring/candidate-card";
import { useHydrated, useSessions } from "@/lib/sessions";
import { ActivityFeed } from "./activity-feed";

export function ActivityPage() {
  const hydrated = useHydrated();
  const sessions = useSessions();
  const events = sessions.flatMap((session) => session.events);
  const names = Object.assign({}, ...sessions.map((session) => candidateNames(session.candidates))) as Record<string, string>;
  const titles = Object.fromEntries(sessions.map((session) => [session.id, session.draft?.title ?? "Вакансия без названия"]));

  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <h1 className="text-3xl font-light tracking-[-0.02em] sm:text-4xl">Журнал действий</h1>
      <div className="mt-6">{hydrated ? <ActivityFeed events={events} candidateNames={names} vacancyTitles={titles} /> : <p className="text-muted">Загружаю журнал…</p>}</div>
    </section>
  );
}
