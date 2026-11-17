import { expect, type Page } from "@playwright/test";

export const COFFEE_SHORT = "Мне нужны два бариста в Астане, зарплата 300 000 тенге, график 5/2";

export async function startVacancy(page: Page, request: string) {
  await page.goto("/");
  await page.getByLabel("Кого вы ищете").fill(request);
  await page.getByRole("button", { name: "Собрать вакансию" }).click();
  await expect(page).toHaveURL(/\/vacancies\/[\w-]+$/);
}

export const card = (page: Page) => page.getByRole("article", { name: "Вакансия" });
export const dialog = (page: Page) => page.getByRole("region", { name: "Диалог с Talent Agent" });

/** Страница не должна прокручиваться по горизонтали — главный признак сломанной мобильной вёрстки. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
