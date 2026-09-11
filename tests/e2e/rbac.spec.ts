/**
 * Story 1.2 - fe/be: enforce role-based access control (browser-level checks).
 * AC2 navigation outside the role's permitted set is not displayed;
 * AC4 direct URLs to unauthorised pages are rejected.
 */
import { expect, test } from '@playwright/test'
import { ACCOUNTS, signIn } from './support'

test('1.2 AC2: venue staff see the "Manage venues" link', async ({ page }) => {
  await signIn(page, ACCOUNTS.venueStaff)
  await expect(page.getByRole('link', { name: 'Manage venues' })).toBeVisible()
})

for (const [role, email] of [
  ['organiser', ACCOUNTS.organiser],
  ['coordinator', ACCOUNTS.coordinator],
  ['attendee', ACCOUNTS.attendee],
] as const) {
  test(`1.2 AC2/AC4: ${role} cannot see or open venue management`, async ({ page }) => {
    await signIn(page, email)
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Manage venues' })).toHaveCount(0)

    await page.goto('/venues/manage')
    await expect(page.getByRole('heading', { name: 'Not permitted' })).toBeVisible()
  })
}
