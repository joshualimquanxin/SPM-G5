/**
 * Thin fetch wrapper shared by every API module.
 *
 * - Always sends the session cookie (`credentials: 'include'`) - see story 1.1.
 * - Throws `ApiError` for non-2xx responses with the backend's `detail` message, so pages can
 *   show it directly (`formatApiError`).
 */

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown

  constructor(status: number, detail: unknown) {
    super(formatDetail(detail) || `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

interface PydanticIssue {
  loc?: (string | number)[]
  msg?: string
}

function formatDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{loc: ['body', 'capacity'], msg: '...'}]
    return detail
      .map((issue: PydanticIssue) => {
        const field = (issue.loc ?? []).filter((p) => p !== 'body').join('.')
        return field ? `${field}: ${issue.msg ?? 'invalid'}` : (issue.msg ?? 'invalid')
      })
      .join('; ')
  }
  return ''
}

export function formatApiError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
}

export async function api<T>(
  path: string,
  { method = 'GET', body }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 204) return undefined as T
  const text = await response.text()
  const data: unknown = text ? JSON.parse(text) : null
  if (!response.ok) {
    const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : data
    throw new ApiError(response.status, detail)
  }
  return data as T
}
