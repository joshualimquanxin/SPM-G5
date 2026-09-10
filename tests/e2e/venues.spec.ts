/**
 * Story 8.3 - fe/be: create and update venue records (browser-level checks).
 * AC1 create with name, location, capacity; AC2 edit and save; AC3 capacity validation.
 */
import { expect, test } from '@playwright/test'
import { ACCOUNTS, signIn } from './support'

test('8.3 AC1/AC2: venue staff create a venue, then edit it', async ({ page }) => {
  const name = `E2E Room ${Date.now()}`
  await signIn(page, ACCOUNTS.venueStaff)

  await page.getByRole('link', { name: 'New venue' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Location').fill('Tower E, Level 2')
  await page.getByLabel('Capacity (people)').fill('45')
  await page.getByRole('checkbox', { name: 'Wi-Fi', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Theatre', exact: true }).check()
  await page.getByRole('button', { name: 'Create venue' }).click()

  await expect(page).toHaveURL(/\/venues\/manage$/)
  await expect(page.getByText(`Venue "${name}" created.`)).toBeVisible()
  const row = page.getByRole('row', { name: new RegExp(name) })
  await expect(row).toContainText('45')

  await row.getByRole('link', { name: 'Edit' }).click()
  await expect(page.getByRole('heading', { name: `Edit venue: ${name}` })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Wi-Fi', exact: true })).toBeChecked()
  await page.getByLabel('Capacity (people)').fill('60')
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(page.getByText(`Venue "${name}" updated.`)).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText('60')
})

test('8.3 AC3: capacity must be a positive whole number', async ({ page }) => {
  await signIn(page, ACCOUNTS.venueStaff)
  await page.goto('/venues/new')
  await page.getByLabel('Name').fill('Bad capacity room')
  await page.getByLabel('Location').fill('Nowhere')

  for (const value of ['0', '-3', '12.5']) {
    await page.getByLabel('Capacity (people)').fill(value)
    await page.getByRole('button', { name: 'Create venue' }).click()
    await expect(page.getByRole('alert')).toContainText('positive whole number')
  }
})

test('8.3 AC1: a duplicate venue name is refused by the backend', async ({ page }) => {
  await signIn(page, ACCOUNTS.venueStaff)
  await page.goto('/venues/new')
  await page.getByLabel('Name').fill('Grand Hall')
  await page.getByLabel('Location').fill('Anywhere')
  await page.getByLabel('Capacity (people)').fill('10')
  await page.getByRole('button', { name: 'Create venue' }).click()

  await expect(page.getByRole('alert')).toContainText('already exists')
})
