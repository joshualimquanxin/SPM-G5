/**
 * Story 1.1 - fe/be: implement user login and logout (browser-level checks).
 * AC1 valid login starts a session; AC2 invalid login is refused generically;
 * AC4 redirect to the role's page; AC5 logout invalidates the session.
 */
import { expect, test } from '@playwright/test'
import { ACCOUNTS, expectSignedIn, signIn } from './support'

test('1.1 AC1/AC4: venue staff signs in and lands on the venue management page', async ({
  page,
}) => {
  await signIn(page, ACCOUNTS.venueStaff)

  await expect(page).toHaveURL(/\/venues\/manage$/)
  await expectSignedIn(page)
  await expect(page.getByText('Vera Venue')).toBeVisible()
})

test('1.1 AC4: an organiser lands on the home page', async ({ page }) => {
  await signIn(page, ACCOUNTS.organiser)

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: /Welcome, Olivia Organiser/ })).toBeVisible()
})

test('1.1 AC2: wrong password shows a generic message and stays on the login page', async ({
  page,
}) => {
  await signIn(page, ACCOUNTS.venueStaff, 'wrong-password')

  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.')
  await expect(page).toHaveURL(/\/login$/)
})

test('1.1 AC2: unknown email shows exactly the same message', async ({ page }) => {
  await signIn(page, 'nobody@nowhere.example')

  await expect(page.getByRole('alert')).toHaveText('Invalid email or password.')
})

test('1.1 AC5: sign out ends the session and protected pages redirect to login', async ({
  page,
}) => {
  await signIn(page, ACCOUNTS.venueStaff)
  await expectSignedIn(page)

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto('/venues/manage')
  await expect(page).toHaveURL(/\/login$/)
})

test('1.1: a deep link is remembered across login', async ({ page }) => {
  await page.goto('/venues/new')
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel('Email').fill(ACCOUNTS.venueStaff)
  await page.getByLabel('Password').fill('Password123!')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL(/\/venues\/new$/)
})
