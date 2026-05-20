import { apiClient } from '@/lib/api/client'
import { appConfig } from '@/lib/config'
import type { ApiEnvelope } from '@/lib/api/types'

export type GiftCardCheckResult = {
  code: string
  amount?: number
  valid: boolean
  message?: string
}

type RawGiftCardResult = Record<string, unknown> | boolean | null

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function normalizeGiftCardResult(code: string, payload: RawGiftCardResult, message?: string): GiftCardCheckResult {
  if (typeof payload === 'boolean') return { code, valid: payload, message }
  if (!payload || typeof payload !== 'object') return { code, valid: true, message }

  return {
    code,
    amount: toNumber(payload.amount ?? payload.balance ?? payload.value),
    valid: payload.can_redeem == null && payload.valid == null ? true : Boolean(payload.can_redeem ?? payload.valid),
    message: typeof payload.message === 'string'
      ? payload.message
      : typeof payload.reason === 'string'
        ? payload.reason
        : message,
  }
}

export async function checkGiftCard(code: string) {
  if (appConfig.enableMock) return { code, amount: 1000, valid: true } satisfies GiftCardCheckResult

  const response = await apiClient.post<ApiEnvelope<RawGiftCardResult>>('/api/v1/user/gift-card/check', { code })
  return normalizeGiftCardResult(code, response.data.data, response.data.message)
}

export async function redeemGiftCard(code: string) {
  if (appConfig.enableMock) return { code, amount: 1000, valid: true } satisfies GiftCardCheckResult

  const response = await apiClient.post<ApiEnvelope<RawGiftCardResult>>('/api/v1/user/gift-card/redeem', { code })
  return normalizeGiftCardResult(code, response.data.data, response.data.message)
}
