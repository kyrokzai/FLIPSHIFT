import { expect, test } from "@playwright/test";
import { COFFEE_SHORT, card, dialog, expectNoHorizontalScroll, startVacancy } from "./helpers";

test.describe("сценарий: кофейня", () => {
  test("от фразы работодателя до подтверждённой вакансии", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Кого вы ищете").fill(COFFEE_SHORT);

    // Разбор виден ещё до отправки, прямо под полем ввода.
    const understood = page.getByRole("list", { name: "Понято из запроса" });
    await expect(understood).toContainText("Бариста");
    await expect(understood).toContainText("Астана");
    await expect(understood).toContainText("График 5/2");

    await page.getByRole("button", { name: "Собрать вакансию" }).click();
    await expect(dialog(page)).toContainText("Собрал черновик вакансии: «Бариста», 2 человека, Астана");
    await expect(card(page).getByRole("heading", { level: 2 })).toHaveText("Бариста");
    await expect(card(page)).toContainText("300 000 ₸ в месяц");
    await expect(card(page)).toContainText("5/2");
    await expect(card(page)).toContainText("Черновик вакансии");

    // Уточнение 1: опыт — кнопкой.
    await expect(dialog(page)).toContainText("Нужен ли опыт работы?");
    await page.getByRole("button", { name: "Не обязателен" }).click();
    await expect(card(page)).toContainText("Не обязателен");

    // Уточнение 2: обязанности — свободным текстом.
    await expect(dialog(page)).toContainText("Чем будет заниматься сотрудник?");
    await page.getByLabel("Ваш ответ").fill("приготовление кофе, работа с гостями, кассой и чистота рабочего места");
    await page.getByRole("button", { name: "Отправить" }).click();
    for (const duty of ["Приготовление кофе", "Работа с гостями", "Работа с кассой", "Чистота рабочего места"]) {
      await expect(card(page)).toContainText(duty);
    }

    // Уточнение 3: ИИ-интервью — с оговоркой о согласии кандидата.
    await expect(dialog(page)).toContainText("Интервью проходит только с согласия кандидата");
    await page.getByRole("button", { name: "Включить" }).click();
    await expect(card(page)).toContainText("Включено, с согласия кандидата");
    await expect(dialog(page)).toContainText("Основные условия заполнены");

    await page.getByRole("button", { name: "Подтвердить вакансию" }).click();
    await expect(card(page)).toContainText("Вакансия подтверждена");
    // Подтверждённая вакансия ведёт к подбору кандидатов.
    await expect(card(page).getByRole("link", { name: "Перейти к подбору" })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Вакансия сохранилась в «Моих вакансиях» этого браузера.
    await page.getByRole("link", { name: "Мои вакансии" }).click();
    await expect(page.getByRole("link", { name: /Бариста/ })).toContainText("Подтверждена");
    await page.reload();
    await expect(page.getByRole("link", { name: /Бариста/ })).toBeVisible();
  });
});

test.describe("сценарий: мебельная компания", () => {
  test("варианты оплаты, вилка и ручное изменение условий", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Менеджер по продажам мебели" }).click();
    await page.getByRole("button", { name: "Собрать вакансию" }).click();

    await expect(card(page).getByRole("heading", { level: 2 })).toHaveText(
      "Менеджер по активным продажам готовой мебели и мебели на заказ",
    );
    await expect(card(page)).toContainText("Мебельная компания");
    for (const duty of ["Самостоятельный поиск клиентов", "B2B-продажи", "Переговоры", "Заключение сделок"]) {
      await expect(card(page)).toContainText(duty);
    }

    // Работодатель рассматривает несколько схем оплаты.
    await expect(dialog(page)).toContainText("Какие варианты оплаты готовы рассмотреть?");
    const done = page.getByRole("button", { name: "Готово" });
    await expect(done).toBeDisabled();
    await page.getByRole("button", { name: "Оклад + % от продаж" }).click();
    await page.getByRole("button", { name: "Только % от продаж" }).click();
    await done.click();
    await expect(card(page)).toContainText("Варианты: оклад + % от результата; сдельная оплата, % от результата");

    await expect(dialog(page)).toContainText("Какой оклад указать в вакансии?");
    await page.getByLabel("Ваш ответ").fill("от 300 до 500 тысяч");
    await page.getByLabel("Ваш ответ").press("Enter");
    await expect(card(page)).toContainText("300 000 – 500 000 ₸ в месяц");
    await expect(card(page)).toContainText("Варианты: оклад + % от результата");

    await page.getByRole("button", { name: "5/2", exact: true }).click();
    await page.getByRole("button", { name: "От 1 года" }).click();
    await page.getByRole("button", { name: "Не нужно" }).click();
    await expect(card(page)).toContainText("Не проводится");

    // Ручная правка условий.
    await page.getByRole("button", { name: "Изменить условия" }).click();
    const form = page.getByRole("form", { name: "Изменение вакансии" });
    await form.getByLabel("Должность").fill("Менеджер по активным продажам мебели");
    await form.getByLabel("Сколько человек нужно").fill("2");
    await form.getByLabel("Требования").fill("Опыт B2B-продаж\nГрамотная речь");
    await expectNoHorizontalScroll(page);
    await form.getByRole("button", { name: "Сохранить изменения" }).click();

    await expect(card(page).getByRole("heading", { level: 2 })).toHaveText("Менеджер по активным продажам мебели");
    await expect(card(page)).toContainText("2 человека");
    await expect(card(page)).toContainText("Грамотная речь");

    await page.getByRole("button", { name: "Подтвердить вакансию" }).click();
    await expect(card(page)).toContainText("Вакансия подтверждена");
    await page.getByRole("button", { name: "Вернуть в черновик" }).click();
    await expect(card(page)).toContainText("Черновик вакансии");
  });
});

test.describe("правила и устойчивость", () => {
  test("защищённые признаки исключаются с объяснением", async ({ page }) => {
    await startVacancy(page, "Нужна девушка до 30 лет на ресепшн в салон красоты в Алматы");
    await expect(dialog(page).getByRole("note").first()).toContainText("защищённый признак");
    await expect(card(page).getByRole("heading", { level: 2 })).toHaveText("Администратор ресепшн");
    await expect(card(page)).not.toContainText(/девушк/i);
    await expect(card(page)).not.toContainText("30 лет");
  });

  test("правка свободным текстом меняет условия", async ({ page }) => {
    await startVacancy(page, COFFEE_SHORT);
    await expect(card(page)).toContainText("300 000 ₸");
    await page.getByLabel("Ваш ответ").fill("измени зарплату на 350 тысяч и график 2/2");
    await page.getByRole("button", { name: "Отправить" }).click();
    await expect(card(page)).toContainText("350 000 ₸ в месяц");
    await expect(card(page)).toContainText("2/2");
    await expect(dialog(page)).toContainText("Записал: оплата, график");
  });

  test("без должности вакансию нельзя подтвердить, агент спрашивает её", async ({ page }) => {
    await startVacancy(page, "Нужен человек на склад в Караганде");
    await expect(dialog(page)).toContainText("На какую должность вы ищете сотрудника?");
    await expect(page.getByRole("button", { name: "Подтвердить вакансию" })).toBeDisabled();
    await expect(card(page)).toContainText("Чтобы подтвердить вакансию, укажите: должность");
    await page.getByLabel("Ваш ответ").fill("кладовщик");
    await page.getByRole("button", { name: "Отправить" }).click();
    await expect(card(page).getByRole("heading", { level: 2 })).toHaveText("Кладовщик");
    await expect(page.getByRole("button", { name: "Подтвердить вакансию" })).toBeEnabled();
  });

  test("сбой сети: сообщение не теряется, отправку можно повторить", async ({ page }) => {
    let failures = 1;
    await page.route("**/api/vacancies/intake", async (route) => {
      if (failures-- > 0) return route.abort("connectionfailed");
      return route.continue();
    });
    await startVacancy(page, COFFEE_SHORT);
    await expect(dialog(page).getByRole("alert")).toContainText("Нет связи с сервером");
    await page.getByRole("button", { name: "Повторить отправку" }).click();
    await expect(card(page).getByRole("heading", { level: 2 })).toHaveText("Бариста");
    await expect(dialog(page).getByRole("alert")).toHaveCount(0);
  });

  test("черновик открывается после перезагрузки, чужой адрес — понятное сообщение", async ({ page }) => {
    await startVacancy(page, COFFEE_SHORT);
    await expect(card(page)).toContainText("Бариста");
    await page.reload();
    await expect(card(page)).toContainText("Бариста");

    await page.goto("/vacancies/no-such-draft");
    await expect(page.getByRole("heading", { name: "Черновик не найден" })).toBeVisible();
  });

  test("удаление вакансии требует подтверждения", async ({ page }) => {
    await startVacancy(page, COFFEE_SHORT);
    await expect(card(page)).toContainText("Бариста");
    await page.goto("/vacancies");
    await page.getByRole("button", { name: "Удалить вакансию «Бариста»" }).click();
    await expect(page.getByRole("link", { name: /Бариста/ })).toBeVisible();
    await page.getByRole("button", { name: "Удалить вакансию", exact: true }).click();
    await expect(page.getByText("Здесь появятся вакансии")).toBeVisible();
  });
});

test.describe("страницы", () => {
  test("главная: заголовок, поле ввода, нет горизонтальной прокрутки", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/FORMIQ Talent Agent/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Опишите, кого вы ищете");
    await expect(page.getByRole("button", { name: "Собрать вакансию" })).toBeDisabled();
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expectNoHorizontalScroll(page);
  });

  test("длинный запрос виден целиком, поле растёт", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Два бариста в кофейню" }).click();
    const field = page.getByLabel("Кого вы ищете");
    const clipped = await field.evaluate((el: HTMLTextAreaElement) => el.scrollHeight - el.clientHeight);
    expect(clipped).toBeLessThanOrEqual(2);
    await expectNoHorizontalScroll(page);
  });

  test("ответы сервера несут защитные заголовки", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["x-powered-by"]).toBeUndefined();
  });
});
