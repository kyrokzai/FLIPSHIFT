import { IntakeComposer } from "@/components/intake-composer";

const STEPS = [
  { title: "Вы описываете задачу", text: "Обычным текстом, без анкет и обязательных полей.", live: true },
  { title: "Агент уточняет недостающее", text: "Зарплата, график, опыт — только то, чего не хватает.", live: true },
  { title: "Вы подтверждаете вакансию", text: "Любое условие можно изменить до запуска поиска.", live: true },
  { title: "Агент собирает кандидатов", text: "Импорт резюме и разрешённые интеграции с источниками.", live: false },
  { title: "Предварительное ИИ-интервью", text: "Проводится только с согласия кандидата.", live: false },
  { title: "Шорт-лист с объяснением", text: "Почему кандидат подходит и что стоит уточнить на встрече.", live: false },
];

const RULES = [
  {
    title: "Решение принимаете вы",
    text: "ИИ готовит вакансию, анализ и рекомендации. Нанимать или нет — всегда решает работодатель.",
  },
  {
    title: "Отбор по навыкам",
    text: "Пол, возраст, национальность, семейное положение и другие личные признаки в отборе не участвуют.",
  },
  {
    title: "Интервью с согласия",
    text: "Кандидат заранее знает, что с ним говорит ИИ, и сам решает, участвовать ли.",
  },
  {
    title: "Только разрешённые источники",
    text: "Без обхода ограничений площадок и правил доступа к персональным данным.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-5 pb-16 pt-12 sm:pb-24 sm:pt-20">
        <h1 className="max-w-[16ch] text-[2.375rem] font-light leading-[1.04] tracking-[-0.025em] text-ink sm:text-6xl lg:text-[4.5rem]">
          Опишите, кого вы ищете
        </h1>
        <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-soft sm:mt-6 sm:text-xl">
          Talent Agent превратит запрос в готовую вакансию, уточнит недостающее и подготовит подбор кандидатов.
        </p>
        <div className="mt-9 max-w-4xl sm:mt-12">
          <IntakeComposer />
        </div>
        <p className="mt-6 max-w-[60ch] text-sm leading-relaxed text-muted">
          Черновик вакансии создаётся без регистрации и хранится только в вашем браузере.
        </p>
      </section>

      <section aria-labelledby="steps-title" className="border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
          <h2 id="steps-title" className="text-2xl font-normal tracking-[-0.01em] sm:text-3xl">
            Как проходит подбор
          </h2>
          <ol className="mt-9 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="border-t border-line pt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-gold-deep">{index + 1}</span>
                  <span className={`text-xs font-medium ${step.live ? "text-ok" : "text-muted"}`}>
                    {step.live ? "Работает" : "В разработке"}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-medium leading-snug">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="rules-title" className="border-t border-line">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:py-20 lg:grid-cols-[1fr_2fr]">
          <h2 id="rules-title" className="max-w-[14ch] text-2xl font-normal tracking-[-0.01em] sm:text-3xl">
            Правила, по которым работает платформа
          </h2>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {RULES.map((rule) => (
              <div key={rule.title}>
                <dt className="text-lg font-medium">{rule.title}</dt>
                <dd className="mt-2 leading-relaxed text-ink-soft">{rule.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
