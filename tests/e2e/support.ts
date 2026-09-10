import { expect, type Page } from '@playwright/test'

/** Accounts from backend/db/seed/020_sample_data.sql. All share one password. */
export const PASSWORD = 'Password123!'
export const ACCOUNTS = {
  organiser: 'organiser@acme.example',
  coordinator: 'coordinator@connectsphere.example',
  venueStaff: 'venue@connectsphere.example',
  techSupport: 'tech@connectsphere.example',
  attendee: 'attendee@example.com',
} as const

export async function signIn(page: Page, email: string, password: string = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/auth/login')),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ])
}

export async function expectSignedIn(page: Page) {
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}
