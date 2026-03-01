import { SENSITIVE_FIELDS } from './constants';

function matchesPattern(path: string[], pattern: string): boolean {
  const patternParts = pattern.split('.');

  if (path.length !== patternParts.length) {
    return false;
  }

  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];

    if (patternPart === '*') {
      continue;
    }

    if (path[index] !== patternPart) {
      return false;
    }
  }

  return true;
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }

  return value;
}

export function isSensitivePath(keyPath: string[]): boolean {
  for (const pattern of SENSITIVE_FIELDS) {
    if (matchesPattern(keyPath, pattern)) {
      return true;
    }
  }

  return false;
}

export function filterSensitiveFields(
  config: Record<string, unknown>,
  keyPath: string[] = []
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    const currentPath = [...keyPath, key];

    if (isSensitivePath(currentPath)) {
      continue;
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = filterSensitiveFields(
        value as Record<string, unknown>,
        currentPath
      );
      continue;
    }

    result[key] = cloneValue(value);
  }

  return result;
}
