import { expect, test } from '@playwright/test'

test('login page loads and reports backend status', async ({ page }) => {
  await page.goto('/')

  // Signed-out visitors are sent to the login page (story 1.1).
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'ConnectSphere' })).toBeVisible()
  await expect(page.getByText('Backend status:')).toBeVisible()
  await expect(page.getByText('ok', { exact: true })).toBeVisible()
})
