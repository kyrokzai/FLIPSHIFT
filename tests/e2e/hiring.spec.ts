import { expect, test, type Page } from "@playwright/test";
import { card, expectNoHorizontalScroll, startVacancy } from "./helpers";

const PILOT = "Нужен менеджер по активным продажам мебели в Астане";
const FIXTURES = "tests/fixtures";
const RESUME_TEXT = [
  "Проверочный Соискатель",
  "Желаемая должность: Менеджер по продажам",
  "Город: Алматы",
  "Опыт работы: 3 года",
  "2023 — настоящее время. Менеджер по продажам строительных материалов",
  "Активные продажи, холодные звонки, переговоры с корпоративными клиентами, заключение договоров.",
].join("\n");

const cards = (page: Page) => page.getByTestId("candidate-card");
const tab = (page: Page, name: string | RegExp) => page.getByRole("tab", { name }).click();
const step = (page: Page, id: string) => page.getByTestId(`step-${id}`);

async function openHiring(page: Page) {
  await startVacancy(page, PILOT);
  await expect(card(page).getByRole("heading", { level: 2 })).toHaveText("Менеджер по активным продажам мебели");
  await page.getByRole("button", { name: "Подставить типовые обязанности" }).waitFor({ state: "hidden" }).catch(() => {});
  await page.getByRole("button", { name: "Подтвердить вакансию" }).click();
  await page.getByRole("link", { name: "Перейти к подбору" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Подбор: Менеджер по активным продажам мебели");
}

test.describe("пилот: подбор по одной вакансии", () => {
  test("LIVE: запросы, честные статусы источников, импорт PDF, анализ, шорт-лист, вопросы", async ({ page }) => {
    await openHiring(page);

    // LIVE включён по умолчанию; без доступа к площадкам поиск не изображается выполненным.
    await expect(page.getByRole("radio", { name: "LIVE" })).toBeChecked();
    await expect(step(page, "vacancy")).toContainText("Успешно");
    await expect(step(page, "queries")).toContainText("Успешно");
    await expect(step(page, "sources")).toContainText("Требуется доступ");
    await expect(step(page, "resumes")).toContainText("Ожидает");
    await expect(step(page, "shortlist")).toContainText("Ожидает");

    await tab(page, "Поиск");
    await expect(page.getByTestId("query-exact")).toHaveText("менеджер по активным продажам мебели");
    await expect(page.getByTestId("query-titles")).toContainText('"sales manager"');
    const hh = page.getByRole("link", { name: "Искать на hh.kz" }).first();
    await expect(hh).toHaveAttribute("href", /^https:\/\/hh\.kz\/search\/resume\?text=.+&area=159$/);
    await expect(hh).toHaveAttribute("target", "_blank");
    await expect(page.getByRole("link", { name: "Искать на Enbek.kz" })).toHaveAttribute(
      "href",
      `https://www.enbek.kz/ru/search/resume?prof=${encodeURIComponent("менеджер по продажам").replace(/%20/g, "+")}&region_id=71`,
    );
    await expect(page.getByRole("link", { name: "Искать в LinkedIn" })).toHaveCount(1);
    for (const heading of [
      "Доступно сейчас без платного подключения",
      "Требуется аккаунт работодателя",
      "Требуется OAuth / API",
      "Требуется платный доступ",
      "Недоступно или запрещено",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expectNoHorizontalScroll(page);

    await tab(page, /Кандидаты/);
    await expect(page.getByText("В LIVE здесь появляются только те кандидаты, которых добавили вы")).toBeVisible();
    await page.locator("input[type=file]").setInputFiles(`${FIXTURES}/resume-test.pdf`);
    await page.getByLabel("Ссылка на оригинальный профиль, необязательно").fill("https://hh.kz/resume/test-0000");
    await page.getByRole("button", { name: "Добавить и проанализировать" }).click();

    const candidate = cards(page).first();
    await expect(candidate.getByRole("heading", { level: 3 })).toHaveText("Тестовый Кандидат");
    await expect(candidate).toContainText("Источник: hh.kz, файл resume-test.pdf");
    await expect(candidate.getByRole("link", { name: "открыть оригинал" })).toHaveAttribute("href", "https://hh.kz/resume/test-0000");
    await expect(candidate).toContainText("Сильное соответствие");
    await expect(candidate).not.toContainText("Демо");
    await candidate.getByText("Показать разбор по критериям и вопросы").click();
    await expect(candidate).toContainText("Опыт по профилю: Менеджер по активным продажам мебели");
    await expect(candidate.locator("blockquote").first()).toContainText("Менеджер по активным продажам");
    await expect(candidate).toContainText("личные признаки не учитываются");
    await expectNoHorizontalScroll(page);

    await tab(page, "Шорт-лист");
    await expect(page.getByRole("list", { name: "Шорт-лист" })).toContainText("Тестовый Кандидат");

    await tab(page, "Интервью");
    await expect(page.getByRole("list", { name: "Общие вопросы" }).getByRole("listitem").first()).toContainText("Менеджер по активным продажам мебели");
    await expect(page.getByText("Автоматическое ИИ-интервью пока не подключено")).toBeVisible();

    await tab(page, "Ход подбора");
    await expect(step(page, "resumes")).toContainText("Добавлено: 1 кандидат.");
    await expect(step(page, "analysis")).toContainText("Успешно");
    await expect(step(page, "shortlist")).toContainText("В шорт-листе 1 кандидат из 1.");
  });

  test("DEMO и LIVE не смешиваются", async ({ page }) => {
    await openHiring(page);
    await tab(page, /Кандидаты/);
    await page.getByLabel("Или вставьте текст резюме").fill(RESUME_TEXT);
    await page.getByLabel("Откуда резюме").selectOption("Почта или мессенджер");
    await page.getByRole("button", { name: "Добавить и проанализировать" }).click();
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Проверочный Соискатель");
    await expect(cards(page).first()).toContainText("Источник: Почта или мессенджер");

    await page.getByRole("radio", { name: "DEMO" }).click();
    await expect(page.getByTestId("mode-note")).toContainText("Вымышленные кандидаты");
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole("form", { name: "Добавление резюме" })).toHaveCount(0);

    await page.getByRole("button", { name: "Загрузить демонстрационных кандидатов" }).click();
    await expect(cards(page)).toHaveCount(6);
    await expect(page.getByText("Анализирую резюме…")).toHaveCount(0);
    for (const item of await cards(page).all()) await expect(item).toContainText("Демо, вымышлен");
    await expect(page.getByText("Проверочный Соискатель")).toHaveCount(0);

    await tab(page, "Шорт-лист");
    await expect(page.getByRole("heading", { name: "Шорт-лист, демонстрационный" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Шорт-лист" }).getByRole("listitem").first()).toContainText("Айдар К.");
    await expect(page.getByText("Не вошли в шорт-лист")).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Обратно в LIVE: только добавленный вручную кандидат, выбор режима переживает перезагрузку.
    await page.getByRole("radio", { name: "LIVE" }).click();
    await tab(page, /Кандидаты/);
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByText("Айдар К.")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("radio", { name: "LIVE" })).toBeChecked();
    await tab(page, /Кандидаты/);
    await expect(cards(page)).toHaveCount(1);
  });

  test("скан и короткий текст дают понятную ошибку и не создают кандидата", async ({ page }) => {
    await openHiring(page);
    await tab(page, /Кандидаты/);
    const form = page.getByRole("form", { name: "Добавление резюме" });
    await expect(form.getByRole("button", { name: "Добавить и проанализировать" })).toBeDisabled();

    await page.locator("input[type=file]").setInputFiles(`${FIXTURES}/resume-scan.pdf`);
    await form.getByRole("button", { name: "Добавить и проанализировать" }).click();
    await expect(form.getByRole("alert")).toContainText("похоже, это скан или фотография");
    await expect(cards(page)).toHaveCount(0);

    await page.locator("input[type=file]").setInputFiles(`${FIXTURES}/resume-test.docx`);
    await page.getByLabel("Ссылка на оригинальный профиль, необязательно").fill("javascript:alert(1)");
    await form.getByRole("button", { name: "Добавить и проанализировать" }).click();
    await expect(form.getByRole("alert")).toContainText("должна начинаться с https://");
    await page.getByLabel("Ссылка на оригинальный профиль, необязательно").fill("");
    await form.getByRole("button", { name: "Добавить и проанализировать" }).click();
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("файл resume-test.docx");
  });

  test("после изменения вакансии оценки помечаются устаревшими и пересчитываются", async ({ page }) => {
    await openHiring(page);
    await tab(page, /Кандидаты/);
    await page.locator("input[type=file]").setInputFiles(`${FIXTURES}/resume-test.txt`);
    await page.getByRole("button", { name: "Добавить и проанализировать" }).click();
    await expect(cards(page).first()).toContainText("соответствие");

    await page.getByRole("link", { name: "К условиям вакансии" }).click();
    await page.getByRole("button", { name: "Вернуть в черновик" }).click();
    await page.getByRole("button", { name: "Изменить условия" }).click();
    await page.getByRole("form", { name: "Изменение вакансии" }).getByLabel("Требования").fill("Знание английского языка");
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    await page.getByRole("button", { name: "Подтвердить вакансию" }).click();
    await page.getByRole("link", { name: "Перейти к подбору" }).click();

    await expect(step(page, "analysis")).toContainText("оценки нужно пересчитать");
    await tab(page, /Кандидаты/);
    await page.getByRole("button", { name: "Пересчитать оценки" }).click();
    await expect(page.getByRole("button", { name: "Пересчитать оценки" })).toHaveCount(0);
    await cards(page).first().getByText("Показать разбор по критериям и вопросы").click();
    await expect(cards(page).first()).toContainText("Знание английского языка");
  });

  test("без языковой модели резюме не покидает браузер", async ({ page }) => {
    await openHiring(page);
    const sent: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (request.method() === "POST" && url.pathname.startsWith("/api/")) sent.push(url.pathname);
    });

    await tab(page, /Кандидаты/);
    for (const file of ["resume-test.pdf", "resume-test.docx", "resume-test.txt"]) {
      await page.locator("input[type=file]").setInputFiles(`${FIXTURES}/${file}`);
      await page.getByRole("button", { name: "Добавить и проанализировать" }).click();
      await expect(cards(page).filter({ hasText: `файл ${file}` })).toContainText("Сильное соответствие");
    }
    await expect(cards(page)).toHaveCount(3);
    // Ни файл, ни текст резюме на сервер не отправлялись: чтение и анализ прошли на устройстве.
    expect(sent).toEqual([]);
  });

  test("без вакансии подбор не открывается", async ({ page }) => {
    await page.goto("/vacancies/no-such/hiring");
    await expect(page.getByRole("heading", { name: "Сначала нужна вакансия" })).toBeVisible();
  });
});
