/**
 * Story 1.1 AC4: after login each role lands on the page most useful to it.
 * Add entries here as feature pages are built (e.g. coordinators -> review queue, story 4.1).
 */
export function homeFor(roleCode: string): string {
  switch (roleCode) {
    case 'VENUE_STAFF':
      return '/venues/manage'
    default:
      return '/'
  }
}
