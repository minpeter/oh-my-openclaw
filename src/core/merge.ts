function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(override)) {
    const overrideVal = override[key];
    const baseVal = result[key];

    if (overrideVal === undefined) {
      continue;
    }

    if (overrideVal === null) {
      delete result[key];
      continue;
    }

    if (isPlainObject(overrideVal) && isPlainObject(baseVal)) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else {
      result[key] = overrideVal;
    }
  }

  return result;
}
