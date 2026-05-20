import { apiClient } from '@/lib/api/client'
import { appConfig } from '@/lib/config'
import type { ApiEnvelope } from '@/lib/api/types'

export type ActiveSession = {
  id: number | string
  ip?: string
  user_agent?: string
  login_at?: number
  last_active_at?: number
}

export type TelegramBotInfo = {
  username?: string
  token?: string
  bind_url?: string
}

type RawSession = Record<string, unknown>
type RawTelegram = Record<string, unknown>

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function toStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeSession(item: RawSession, index: number): ActiveSession {
  return {
    id: toStringValue(item.session_id) ?? toStringValue(item.id) ?? toNumber(item.id) ?? index,
    ip: toStringValue(item.ip),
    user_agent: toStringValue(item.user_agent),
    login_at: toNumber(item.login_at ?? item.created_at),
    last_active_at: toNumber(item.last_active_at ?? item.updated_at),
  }
}

export async function getActiveSessions() {
  if (appConfig.enableMock) {
    return [
      {
        id: 'mock-current',
        ip: '127.0.0.1',
        user_agent: 'Demo Browser',
        login_at: Math.floor(Date.now() / 1000) - 3600,
        last_active_at: Math.floor(Date.now() / 1000),
      },
    ] satisfies ActiveSession[]
  }

  const response = await apiClient.get<ApiEnvelope<RawSession[]>>('/api/v1/user/getActiveSession')
  const data = Array.isArray(response.data.data) ? response.data.data : []
  return data.map(normalizeSession)
}

export async function removeActiveSession(id: ActiveSession['id']) {
  if (appConfig.enableMock) return { success: true }

  const response = await apiClient.post<ApiEnvelope<unknown>>('/api/v1/user/removeActiveSession', { session_id: id })
  return response.data.data
}

export async function getTelegramBotInfo() {
  if (appConfig.enableMock) {
    return {
      username: 'your_bot',
      bind_url: 'https://t.me/your_bot',
    } satisfies TelegramBotInfo
  }

  const response = await apiClient.get<ApiEnvelope<RawTelegram>>('/api/v1/user/telegram/getBotInfo', {
    timeout: 2500,
  })
  const data = response.data.data ?? {}
  return {
    username: toStringValue(data.username ?? data.bot_username),
    token: toStringValue(data.token),
    bind_url: toStringValue(data.bind_url ?? data.url),
  } satisfies TelegramBotInfo
}

export async function transferCommissionToBalance(amount?: number) {
  if (appConfig.enableMock) return { success: true }

  const payload = amount == null ? {} : { transfer_amount: amount }
  const response = await apiClient.post<ApiEnvelope<unknown>>('/api/v1/user/transfer', payload)
  return response.data.data
}
