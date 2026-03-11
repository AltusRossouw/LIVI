export function validate(input: unknown, schema: any): any {
  const result: any = {}

  const source =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}

  for (const key of Object.keys(schema)) {
    const def = schema[key]
    const val = source[key]

    if (val === undefined) {
      result[key] = def
      continue
    }

    if (Array.isArray(def)) {
      result[key] = Array.isArray(val) ? val : def
      continue
    }

    if (typeof def === 'object' && def !== null) {
      result[key] = validate(val, def)
      continue
    }

    result[key] = typeof val === typeof def ? val : def
  }

  return result
}
