import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPreset } from '../../core/preset-loader';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function collectKeyPaths(value: unknown, parent = ''): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectKeyPaths(item, `${parent}[${index}]`)
    );
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const keyPath = parent ? `${parent}.${key}` : key;
    return [keyPath, ...collectKeyPaths(child, keyPath)];
  });
}

describe('apex preset', () => {
  test('loads successfully', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));

    expect(preset.name).toBe('apex');
  });

  test('has expected metadata', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));

    expect(preset.name).toBe('apex');
    expect(preset.version).toBe('1.0.0');
    expect(preset.description.toLowerCase()).toMatch(/all-in-one|power/);
  });

  test('includes exactly five workspace files in expected order', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));

    expect(preset.workspaceFiles).toEqual([
      'AGENTS.md',
      'SOUL.md',
      'TOOLS.md',
      'USER.md',
      'IDENTITY.md',
    ]);
    expect(preset.workspaceFiles).toHaveLength(5);
  });

  test('includes required config sections', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));

    expect(preset.config).toBeDefined();
    expect(preset.config).toHaveProperty('identity');
    expect(preset.config).toHaveProperty('agents');
    expect(preset.config).toHaveProperty('tools');
  });

  test('does not include restricted sensitive keys', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));
    const keyPaths = collectKeyPaths(preset.config);

    expect(keyPaths.some((key) => /(^|\.)auth$/i.test(key))).toBe(false);
    expect(keyPaths.some((key) => /(^|\.)env$/i.test(key))).toBe(false);
    expect(keyPaths.some((key) => /(^|\.)meta$/i.test(key))).toBe(false);
    expect(keyPaths.some((key) => /apikey/i.test(key))).toBe(false);
    expect(
      keyPaths.some((key) => /(^|\.)(token|botToken|accessToken)$/i.test(key))
    ).toBe(false);
  });

  test('marks apex as builtin preset', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));

    expect(preset.builtin).toBe(true);
  });
});
