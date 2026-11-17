import type { SearchPlan } from "@/domain/sourcing/queries";
import { buildSearchLinks } from "@/domain/sourcing/sources";
import type { VacancyDraft } from "@/domain/vacancy/schema";
import { CopyButton } from "./copy-button";

export function QueriesSection({ plan, draft }: { plan: SearchPlan; draft: VacancyDraft }) {
  if (plan.queries.length === 0) {
    return <p className="mt-4 leading-relaxed text-muted">Укажите в вакансии должность — агент составит запросы.</p>;
  }
  return (
    <ol className="mt-5 flex flex-col gap-5">
      {plan.queries.map((query) => {
        const text = query.boolean ?? query.text;
        return (
          <li key={query.id} className="rounded-card border border-line bg-surface p-5 sm:p-6">
            <h3 className="text-lg font-medium leading-snug">{query.label}</h3>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">{query.purpose}</p>
            <p className="mt-3 break-words rounded-field bg-paper px-3.5 py-3 leading-relaxed text-ink" data-testid={`query-${query.id}`}>
              {text}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {buildSearchLinks(query, draft).map((link) => (
                <a key={link.source} href={link.url} target="_blank" rel="noopener noreferrer" className="btn btn-quiet" title={link.note}>
                  {link.label}
                </a>
              ))}
              <CopyButton text={text} label="Скопировать запрос" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
