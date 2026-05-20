import { apiClient } from '@/lib/api/client';
import { appConfig } from '@/lib/config';
import { mockPlans, mockSubscribe, mockUser } from '@/lib/api/mock';
import type { ApiEnvelope, Plan, SubscribeInfo, UserInfo } from '@/lib/api/types';

type RawSubscribeInfo = Omit<SubscribeInfo, 'plan'> & {
  plan?: string | { name?: string | null } | null
}

function normalizeUserInfo(user: UserInfo): UserInfo {
  return user
}

function normalizeSubscribeUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return ''
  return new URL(value.trim(), appConfig.apiBaseUrl).toString()
}

function normalizeSubscribeInfo(subscribe: RawSubscribeInfo): SubscribeInfo {
  const normalized = {
    ...subscribe,
    plan: typeof subscribe.plan === 'string'
      ? subscribe.plan
      : subscribe.plan?.name ?? null,
  }
  return {
    ...normalized,
    subscribe_url: normalizeSubscribeUrl(normalized.subscribe_url),
  }
}

export async function getUserInfo() {
  if (appConfig.enableMock) return mockUser;
  const response = await apiClient.get<ApiEnvelope<UserInfo>>('/api/v1/user/info');
  return normalizeUserInfo(response.data.data);
}

export async function getSubscribeInfo() {
  if (appConfig.enableMock) return mockSubscribe;
  const response = await apiClient.get<ApiEnvelope<RawSubscribeInfo>>('/api/v1/user/getSubscribe');
  return normalizeSubscribeInfo(response.data.data);
}

export async function getPlans() {
  if (appConfig.enableMock) return mockPlans;
  const response = await apiClient.get<ApiEnvelope<Plan[]>>('/api/v1/user/plan/fetch');
  return response.data.data;
}
