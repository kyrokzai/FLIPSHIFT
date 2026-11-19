import { expect, test, type Page } from "@playwright/test";
import { card, expectNoHorizontalScroll, startVacancy } from "./helpers";

const FURNITURE =
  "Мебельная компания в Астане ищет менеджера по активным продажам готовой мебели и мебели на заказ. Требуется самостоятельный поиск клиентов, B2B-продажи, переговоры и заключение сделок. Зарплата от 300 до 500 тысяч, график 5/2";

const cards = (page: Page) => page.getByTestId("candidate-card");
const tab = (page: Page, name: string | RegExp) => page.getByRole("tab", { name }).click();
const cardOf = (page: Page, name: string) => cards(page).filter({ has: page.getByRole("heading", { level: 3, name: new RegExp(name) }) });

async function openHiring(page: Page) {
  await startVacancy(page, FURNITURE);
  await expect(card(page).getByRole("heading", { level: 2 })).toContainText("Менеджер по активным продажам");
  await page.getByRole("button", { name: "Подтвердить вакансию" }).click();
  await page.getByRole("link", { name: "Перейти к подбору" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Подбор");
}

async function loadDemo(page: Page) {
  await page.getByRole("radio", { name: "DEMO" }).click();
  await tab(page, /Кандидаты/);
  await page.getByRole("button", { name: "Загрузить демонстрационных кандидатов" }).click();
  await expect(cards(page)).toHaveCount(6);
  await expect(page.getByText("Анализирую резюме…")).toHaveCount(0);
}

async function answerAll(page: Page, demo: boolean, answers: string[] = []) {
  for (let i = 0; ; i++) {
    const field = page.getByLabel(/^Ответ кандидата/);
    if (!(await field.isVisible().catch(() => false))) break;
    if (demo) await page.getByRole("button", { name: "Подставить вымышленный ответ" }).click();
    else await field.fill(answers[i] ?? "Уточню у клиента сроки и бюджет?");
    await page.getByRole("button", { name: "Отправить ответ" }).click();
    await expect(page.getByTestId("answer")).toHaveCount(i + 1);
  }
}

test.describe("P0: Skill Challenge, сравнение, журнал", () => {
  test("DEMO: проверка навыков продаж с отчётом по критериям", async ({ page }) => {
    await openHiring(page);
    await loadDemo(page);

    await cardOf(page, "Айдар К.").getByRole("link", { name: "Проверить навыки продаж" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Проверка навыков");
    await expect(page.getByText("Демо, вымышлен").first()).toBeVisible();
    await expect(page.getByLabel("Сценарий", { exact: true })).toHaveValue("sales");
    await expect(page.getByText("Это не ИИ-собеседник.")).toBeVisible();
    await expect(page.getByRole("radio", { name: /^ИИ-собеседник/ })).toBeDisabled();
    await page.getByLabel("Количество ситуаций").selectOption("5");
    await page.getByRole("button", { name: "Продолжить" }).click();

    await expect(page.getByText("Кандидат вымышлен, согласие не требуется")).toBeVisible();
    await page.getByRole("button", { name: "Начать проверку" }).click();
    await expect(page.getByText(/80 посадочных мест/)).toBeVisible();
    await expect(page.getByText(/реплика по сценарию/).first()).toBeVisible();

    await answerAll(page, true);
    const report = page.getByRole("region", { name: "Отчёт о проверке" });
    await expect(report).toContainText("Демо: вымышленный кандидат и вымышленные ответы");
    await expect(report).toContainText("Отвечено ситуаций: 5 из 5");
    for (const id of ["needs", "clarifying", "value", "objections", "process", "next_step"]) {
      const criterion = page.getByTestId(`criterion-${id}`);
      await expect(criterion).toContainText("Проявлено");
      await expect(criterion.locator("blockquote")).toContainText("Ответ на шаг");
      await expect(criterion).toContainText("Проверить дополнительно:");
      await expect(criterion).not.toContainText("Высокая уверенность");
    }
    await expectNoHorizontalScroll(page);

    // Вес критерия меняет сводку и сохраняется.
    const before = await report.locator("p").nth(1).innerText();
    await page.getByLabel("Вес: Выявление потребностей").selectOption("0");
    await expect(page.getByLabel("Вес: Выявление потребностей")).toHaveValue("0");
    await page.reload();
    await expect(page.getByLabel("Вес: Выявление потребностей")).toHaveValue("0");
    expect(before).toContain("Навыки проявлены");

    await page.getByRole("link", { name: "К подбору" }).click();
    await tab(page, /Кандидаты/);
    await expect(cardOf(page, "Айдар К.").getByTestId("challenge-summary")).toContainText("завершена");
  });

  test("LIVE: согласие, ответы, досрочное завершение и сохранение после перезагрузки", async ({ page }) => {
    await openHiring(page);
    await tab(page, /Кандидаты/);
    await page.locator("input[type=file]").setInputFiles("tests/fixtures/resume-test.txt");
    await page.getByRole("button", { name: "Добавить и проанализировать" }).click();
    await expect(cards(page).first()).toContainText("соответствие");
    await cards(page).first().getByRole("link", { name: "Проверить навыки продаж" }).click();
    await page.getByLabel("Количество ситуаций").selectOption("3");
    await page.getByRole("button", { name: "Продолжить" }).click();

    const start = page.getByRole("button", { name: "Начать проверку" });
    await expect(start).toBeDisabled();
    await expect(page.getByText("Реплики собеседника заданы заранее")).toBeVisible();
    await page.getByLabel("Работодатель вносит ответы кандидата с его слов или из переписки").check();
    await page.getByLabel(/Кандидат согласен пройти проверку/).check();
    await start.click();

    // В LIVE нет вымышленных ответов.
    await expect(page.getByRole("button", { name: "Подставить вымышленный ответ" })).toHaveCount(0);
    await page.getByLabel(/^Ответ кандидата/).fill("Понимаю. Какая у вас концепция интерьера и сколько залов? У нас собственное производство и гарантия 3 года.");
    await page.getByRole("button", { name: "Отправить ответ" }).click();
    await expect(page.getByTestId("answer")).toHaveCount(1);

    // Перезагрузка не теряет состояние диалога.
    await page.reload();
    await expect(page.getByTestId("answer")).toHaveCount(1);
    await expect(page.getByText("Ситуация 2 из 3")).toBeVisible();

    await page.getByRole("button", { name: "Закончить досрочно" }).click();
    await page.getByRole("button", { name: "Завершить и получить отчёт" }).click();
    const report = page.getByRole("region", { name: "Отчёт о проверке" });
    await expect(report).toContainText("Остановлено досрочно");
    await expect(report).toContainText("Отвечено ситуаций: 1 из 3");
    await expect(page.getByTestId("criterion-needs")).toContainText("Какая у вас концепция интерьера");
    await expect(report).not.toContainText("вымышлен");
  });

  test("сравнение трёх кандидатов без победителя и с «Нет данных»", async ({ page }) => {
    await openHiring(page);
    await loadDemo(page);
    for (const name of ["Айдар К.", "Руслан Т.", "Алия М."]) await cardOf(page, name).getByRole("button", { name: "Добавить к сравнению" }).click();
    await expect(page.getByTestId("compare-bar")).toContainText("В сравнении: 3 из 3");
    await expect(cardOf(page, "Тимур Б.").getByRole("button", { name: "Добавить к сравнению" })).toBeDisabled();

    await page.getByRole("link", { name: "Сравнить кандидатов" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Сравнение кандидатов");
    await expect(page.getByText("Режим DEMO: все кандидаты и их ответы вымышлены.")).toBeVisible();
    await expect(page.getByTestId("field-interview").getByText("Нет данных", { exact: true })).toHaveCount(3);
    await expect(page.getByTestId("field-prospecting")).toContainText("Кандидат пишет, что не занимался");
    await expect(page.getByTestId("field-achievements")).toContainText("Источник: Резюме");
    await expect(page.getByText("Платформа не выбирает победителя")).toBeVisible();
    await expect(page.getByRole("region", { name: /Сравнительный|Самостоятельное/ }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/победитель:|лучший кандидат/i);
    await expectNoHorizontalScroll(page);

    await page.getByRole("button", { name: "Убрать: Алия М." }).click();
    await expect(page.getByTestId("field-salary").getByTestId("compare-cell")).toHaveCount(2);
    await page.getByRole("button", { name: "Убрать: Руслан Т." }).click();
    await expect(page.getByText(/Нужно хотя бы 2 проанализированных кандидата/)).toBeVisible();
  });

  test("DEMO и LIVE не смешиваются в сравнении и проверках", async ({ page }) => {
    await openHiring(page);
    await tab(page, /Кандидаты/);
    await page.locator("input[type=file]").setInputFiles("tests/fixtures/resume-test.txt");
    await page.getByRole("button", { name: "Добавить и проанализировать" }).click();
    await expect(cards(page).first()).toContainText("соответствие");
    await cards(page).first().getByRole("button", { name: "Добавить к сравнению" }).click();
    await expect(page.getByTestId("compare-bar")).toContainText("В сравнении: 1 из 3");

    await loadDemo(page);
    await expect(page.getByTestId("compare-bar")).toHaveCount(0);
    await cardOf(page, "Айдар К.").getByRole("button", { name: "Добавить к сравнению" }).click();
    await expect(page.getByTestId("compare-bar")).toContainText("В сравнении: 1 из 3");

    await page.getByRole("radio", { name: "LIVE" }).click();
    await tab(page, /Кандидаты/);
    await expect(page.getByTestId("compare-bar")).toContainText("В сравнении: 1 из 3");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first().getByRole("button", { name: "Убрать из сравнения" })).toBeVisible();

    // Проверка навыков наследует режим кандидата: в LIVE нет вымышленных ответов.
    await cards(page).first().getByRole("link", { name: "Проверить навыки продаж" }).click();
    await page.getByRole("button", { name: "Продолжить" }).click();
    await expect(page.getByText("Демо, вымышлен")).toHaveCount(0);
    await expect(page.getByText("Перед началом — для кандидата")).toBeVisible();
  });

  test("журнал показывает только реальные действия, без выдуманного поиска", async ({ page }) => {
    await openHiring(page);
    await tab(page, "Поиск");
    const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByRole("link", { name: "Искать на Enbek.kz" }).click()]);
    await popup.close();
    await tab(page, /Кандидаты/);
    await page.locator("input[type=file]").setInputFiles("tests/fixtures/resume-scan.pdf");
    await page.getByRole("button", { name: "Добавить и проанализировать" }).click();
    await expect(page.getByRole("form", { name: "Добавление резюме" }).getByRole("alert")).toBeVisible();
    await page.locator("input[type=file]").setInputFiles("tests/fixtures/resume-test.pdf");
    await page.getByRole("button", { name: "Добавить и проанализировать" }).click();
    await expect(cards(page).first()).toContainText("соответствие");

    await tab(page, "Журнал");
    const events = page.getByTestId("activity-event");
    const types = await events.evaluateAll((items) => items.map((item) => item.getAttribute("data-type")));
    for (const type of ["vacancy_created", "vacancy_confirmed", "queries_generated", "source_unavailable", "source_opened", "resume_import_failed", "resume_imported", "resume_analyzed", "shortlist_updated"]) {
      expect(types, type).toContain(type);
    }
    // Ни одного события, будто агент сам нашёл кандидатов.
    await expect(page.getByRole("list", { name: "События" })).not.toContainText(/Найдено \d+ кандидат/);
    await expect(events.filter({ hasText: "Работодатель открыл внешний источник" })).toContainText("Резюме автоматически не загружались");
    await expect(events.filter({ hasText: "Автоматический поиск недоступен" })).toContainText("Требуется разрешение");
    await expect(events.filter({ hasText: "Резюме не импортировано" })).toContainText("код ошибки: no_text");
    // В журнал не попадают контакты из резюме.
    await expect(page.getByRole("list", { name: "События" })).not.toContainText(/example\.com|700 000 00 00/);
    await expect(page.getByText("Это не централизованный аудит")).toBeVisible();

    // История по кандидату — из его карточки.
    await tab(page, /Кандидаты/);
    await cards(page).first().getByRole("button", { name: "История действий" }).click();
    await expect(page.getByText("Показаны действия по кандидату")).toBeVisible();
    await expect(events).toHaveCount(2);

    // Глобальный журнал с фильтром по вакансии.
    await page.getByRole("link", { name: "Журнал", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Журнал действий");
    await page.getByLabel("Тип событий").selectOption("search");
    const searchTypes = await page.getByTestId("activity-event").evaluateAll((items) => items.map((item) => item.getAttribute("data-type")));
    expect(new Set(searchTypes)).toEqual(new Set(["queries_generated", "source_unavailable", "source_opened"]));
  });
});
