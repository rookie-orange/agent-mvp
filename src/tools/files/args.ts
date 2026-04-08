import { isNumber, isString } from '@/shared/general'

interface IntegerOptionConfig {
  fallback?: number
  min?: number
  max?: number
}

export function getNonEmptyString(value: unknown, fieldName: string) {
  if (!isString(value) || !value.trim()) {
    throw new Error(`${fieldName} 必须是非空字符串。`)
  }

  return value.trim()
}

export function getRequiredPath(value: unknown, fieldName = 'path') {
  return getNonEmptyString(value, fieldName)
}

export function getPathWithDefault(value: unknown, fieldName = 'path', fallback = '.') {
  if (value === undefined) {
    return fallback
  }

  return getRequiredPath(value, fieldName)
}

export function getRequiredString(value: unknown, fieldName: string) {
  if (!isString(value)) {
    throw new Error(`${fieldName} 必须是字符串。`)
  }

  return value
}

export function getBooleanOption(value: unknown, fieldName: string, fallback: boolean) {
  if (value === undefined) {
    return fallback
  }

  if (typeof value !== 'boolean') {
    throw new TypeError(`${fieldName} 必须是布尔值。`)
  }

  return value
}

function buildIntegerRangeMessage(fieldName: string, min?: number, max?: number) {
  if (min !== undefined && max !== undefined) {
    return `${fieldName} 必须在 ${min} 到 ${max} 之间。`
  }

  if (min !== undefined) {
    return `${fieldName} 必须是大于等于 ${min} 的整数。`
  }

  if (max !== undefined) {
    return `${fieldName} 必须是小于等于 ${max} 的整数。`
  }

  return `${fieldName} 必须是整数。`
}

export function getIntegerOption(
  value: unknown,
  fieldName: string,
  config: IntegerOptionConfig = {},
) {
  const { fallback, min, max } = config

  if (value === undefined) {
    return fallback
  }

  if (!isNumber(value) || !Number.isInteger(value)) {
    throw new Error(`${fieldName} 必须是整数。`)
  }

  if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
    throw new Error(buildIntegerRangeMessage(fieldName, min, max))
  }

  return value
}

export function getLineNumber(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined
  }

  if (!isNumber(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} 必须是大于等于 1 的整数。`)
  }

  return value
}

export function getExpectedOccurrences(value: unknown, fallback?: number) {
  if (value === undefined) {
    return fallback
  }

  if (!isNumber(value) || !Number.isInteger(value) || value < 0) {
    throw new Error('expectedOccurrences 必须是大于等于 0 的整数。')
  }

  return value
}
