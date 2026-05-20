import axios from 'axios'

type ApiFailureEnvelope = {
  message?: unknown
  error?: unknown
  data?: unknown
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiFailureEnvelope>(error)) {
    const responseMessage = error.response?.data?.message
    if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage

    const responseError = error.response?.data?.error
    if (typeof responseError === 'string' && responseError.trim()) return responseError

    if (error.response?.status) return `${fallback} (HTTP ${error.response.status})`
  }

  if (error instanceof Error && error.message.trim()) return error.message

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }

  return fallback
}

export function assertApiSuccess(status: unknown, message: unknown, fallback: string) {
  if (status == null) return
  if (typeof status === 'number' && (status === 1 || status === 200)) return
  if (typeof status === 'string' && ['success', 'ok', '1', '200'].includes(status.toLowerCase())) return

  throw new Error(typeof message === 'string' && message.trim() ? message : fallback)
}
