import { expect, test } from "@playwright/test"

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000"
const teacherEmail = process.env.E2E_TEACHER_EMAIL
const teacherPassword = process.env.E2E_TEACHER_PASSWORD
const lessonId = process.env.E2E_TEACHER_LESSON_ID

const missingEnv = [
  ["E2E_TEACHER_EMAIL", teacherEmail],
  ["E2E_TEACHER_PASSWORD", teacherPassword],
  ["E2E_TEACHER_LESSON_ID", lessonId]
]
  .filter(([, value]) => !value)
  .map(([name]) => name)

test.skip(missingEnv.length > 0, `Missing env for lesson-builder e2e: ${missingEnv.join(", ")}`)

test.describe("lesson builder preview smoke", () => {
  test("teacher can open builder and launch student preview", async ({ context, page }) => {
    await page.goto(`${baseUrl}/`)

    await page.getByRole("button", { name: "Преподаватель" }).click()
    await page.getByLabel("Email").fill(teacherEmail!)
    await page.getByLabel("Пароль").fill(teacherPassword!)
    await page.getByRole("button", { name: /^Войти$/ }).click()

    await page.waitForURL(/\/teacher\/dashboard/, { timeout: 30_000 })
    await page.goto(`${baseUrl}/teacher/lessons/${lessonId}`)

    await expect(page.getByRole("button", { name: "Превью" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Опубликовать" })).toBeVisible()
    await expect(page.getByText("Добавить блок")).toBeVisible()
    await expect(page.getByText("Текст")).toBeVisible()

    const previewPagePromise = context.waitForEvent("page")
    await page.getByRole("button", { name: "Превью" }).click()
    const previewPage = await previewPagePromise

    await previewPage.waitForLoadState("domcontentloaded")
    await expect(previewPage).toHaveURL(new RegExp(`/lesson/${lessonId}$`))
    await expect(previewPage.getByText("Превью для ученика")).toBeVisible()
    await expect(previewPage.getByRole("link", { name: "Вернуться в редактор" })).toBeVisible()
    await expect(previewPage.locator("body")).toContainText(/Блок 1|В этом уроке пока нет блоков/)
  })
})
