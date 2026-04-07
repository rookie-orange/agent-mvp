function isFunction(value: unknown): value is Function {
  return typeof value === 'function'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export { isArray, isFunction, isObject, isString }
