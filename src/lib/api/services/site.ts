import { apiClient } from '@/lib/api/client'
import { appConfig } from '@/lib/config'
import type { ApiEnvelope } from '@/lib/api/types'

export type SiteConfig = {
  app_name?: string
  description?: string
  logo?: string
  tos_url?: string
  is_email_verify?: boolean
  is_invite_force?: boolean
  is_recaptcha?: boolean
  recaptcha_site_key?: string
  register_enabled?: boolean
  telegram_discuss_link?: string
  telegram_group_link?: string
}

type RawSiteConfig = Record<string, unknown>

function boolValue(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
  return fallback
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeSiteConfig(raw: RawSiteConfig = {}): SiteConfig {
  return {
    app_name: stringValue(raw.app_name ?? raw.name ?? raw.site_name),
    description: stringValue(raw.description ?? raw.app_description),
    logo: stringValue(raw.logo),
    tos_url: stringValue(raw.tos_url),
    is_email_verify: boolValue(raw.is_email_verify ?? raw.email_verify),
    is_invite_force: boolValue(raw.is_invite_force ?? raw.invite_force),
    is_recaptcha: boolValue(raw.is_recaptcha ?? raw.recaptcha_enable),
    recaptcha_site_key: stringValue(raw.recaptcha_site_key),
    register_enabled: raw.register_enable == null && raw.is_register == null
      ? true
      : boolValue(raw.register_enable ?? raw.is_register, true),
    telegram_discuss_link: stringValue(raw.telegram_discuss_link),
    telegram_group_link: stringValue(raw.telegram_group_link),
  }
}

export async function getGuestSiteConfig() {
  if (appConfig.enableMock) {
    return normalizeSiteConfig({
      app_name: appConfig.appName,
      register_enable: true,
      is_email_verify: true,
      is_invite_force: false,
    })
  }

  const response = await apiClient.get<ApiEnvelope<RawSiteConfig>>('/api/v1/guest/comm/config')
  return normalizeSiteConfig(response.data.data ?? {})
}

export async function getUserSiteConfig() {
  if (appConfig.enableMock) return getGuestSiteConfig()

  const response = await apiClient.get<ApiEnvelope<RawSiteConfig>>('/api/v1/user/comm/config')
  return normalizeSiteConfig(response.data.data ?? {})
}
