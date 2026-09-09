const apiUrl = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError('The server could not be reached. Please try again.', 0)
  }

  if (response.status === 204) return undefined as T

  const payload = (await response.json().catch(() => null)) as { message?: string } | T | null
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload && payload.message
        ? payload.message
        : 'Unable to complete the request.'
    throw new ApiError(message, response.status)
  }

  return payload as T
}
