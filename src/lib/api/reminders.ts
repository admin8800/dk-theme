export function isReminderEnabled(value: unknown, fallback = true) {
  if (value == null) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return fallback
    return !['0', 'false', 'off', 'no'].includes(normalized)
  }
  return Boolean(value)
}

export function toReminderFlag(value: boolean): 0 | 1 {
  return value ? 1 : 0
}
