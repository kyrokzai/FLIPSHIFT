import { SOURCE_CAPABILITIES, accessClassLabels, accessClasses, sourceStatusLabels } from "@/domain/sourcing/sources";
import { StatusBadge } from "./status-badge";

export function SourcesSection() {
  return (
    <div className="mt-5 flex flex-col gap-7">
      {accessClasses.map((access) => {
        const items = SOURCE_CAPABILITIES.filter((item) => item.access === access);
        if (items.length === 0) return null;
        return (
          <section key={access} aria-label={accessClassLabels[access]}>
            <h3 className="text-[0.9375rem] font-medium text-ink-soft">{accessClassLabels[access]}</h3>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {items.map((item) => (
                <li key={item.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium leading-snug">
                      {item.title}
                      <span className="block text-sm font-normal text-muted">{item.source}</span>
                    </p>
                    <StatusBadge status={item.status} label={sourceStatusLabels[item.status]} />
                  </div>
                  <p className="mt-2 leading-relaxed text-ink-soft">{item.summary}</p>
                  {item.needs ? <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted">Что нужно: {item.needs}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
