import fs from 'node:fs/promises';
import JSON5 from 'json5';

import type { ConfigSnapshot } from './types.ts';

export async function readJson5(filePath: string): Promise<ConfigSnapshot> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new Error(`Cannot read file: ${filePath}`);
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return { raw, parsed: {}, path: filePath };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON5.parse(trimmed);
  } catch (err) {
    throw new Error(
      `Invalid JSON5 in ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { raw, parsed, path: filePath };
}

export async function writeJson5(filePath: string, data: Record<string, unknown>): Promise<void> {
  const content = JSON5.stringify(data, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
}

export function parseJson5(content: string): Record<string, unknown> {
  if (content.trim() === '') return {};
  return JSON5.parse(content);
}

export function stringifyJson5(data: Record<string, unknown>): string {
  return JSON5.stringify(data, null, 2);
}
