import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  parseJson5,
  readJson5,
  stringifyJson5,
  writeJson5,
} from '../json5-utils';

const tempPaths: string[] = [];

async function createTempPath(name: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'json5-utils-'));
  tempPaths.push(dir);
  return path.join(dir, name);
}

afterEach(async () => {
  await Promise.all(
    tempPaths.splice(0).map(async (tempPath) => {
      await fs.rm(tempPath, { recursive: true, force: true });
    })
  );
});

describe('json5-utils', () => {
  test('reads valid JSON5 with comments and trailing commas', async () => {
    const filePath = await createTempPath('valid.json5');
    await fs.writeFile(
      filePath,
      '{\n  // comment\n  name: "test",\n  enabled: true,\n}\n',
      'utf-8'
    );

    const snapshot = await readJson5(filePath);

    expect(snapshot.path).toBe(filePath);
    expect(snapshot.raw).toContain('// comment');
    expect(snapshot.parsed).toEqual({ name: 'test', enabled: true });
  });

  test('writes JSON5 using 2-space indent', async () => {
    const filePath = await createTempPath('written.json5');
    await writeJson5(filePath, { name: 'test', nested: { value: 1 } });

    const written = await fs.readFile(filePath, 'utf-8');

    expect(written).toContain('\n  nested: {\n    value: 1,\n  },\n');
    expect(written).toBe(
      stringifyJson5({ name: 'test', nested: { value: 1 } })
    );
  });

  test('throws descriptive error for missing file', async () => {
    const filePath = path.join(os.tmpdir(), `missing-${Date.now()}.json5`);

    return expect(readJson5(filePath)).rejects.toThrow(
      `Cannot read file: ${filePath}`
    );
  });

  test('throws descriptive error for invalid JSON5 syntax', async () => {
    const filePath = await createTempPath('invalid.json5');
    await fs.writeFile(filePath, '{unclosed', 'utf-8');

    return expect(readJson5(filePath)).rejects.toThrow(
      `Invalid JSON5 in ${filePath}:`
    );
  });

  test('returns empty object for empty file', async () => {
    const filePath = await createTempPath('empty.json5');
    await fs.writeFile(filePath, '   \n\t', 'utf-8');

    const snapshot = await readJson5(filePath);

    expect(snapshot.parsed).toEqual({});
    expect(parseJson5(snapshot.raw)).toEqual({});
  });

  test('parseJson5 and stringifyJson5 round-trip simple object', () => {
    const data = { foo: 'bar', count: 2 };
    const stringified = stringifyJson5(data);

    expect(parseJson5(stringified)).toEqual(data);
  });
});
