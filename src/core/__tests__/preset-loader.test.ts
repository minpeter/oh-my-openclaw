import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { listPresets, loadPreset, savePreset } from '../preset-loader';
import type { PresetManifest } from '../types';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  tempDirs.push(dir);
  return dir;
}

async function writePresetManifest(
  presetDir: string,
  manifest: Record<string, unknown>
) {
  await fs.mkdir(presetDir, { recursive: true });
  const content = JSON.stringify(manifest);
  await fs.writeFile(path.join(presetDir, 'preset.json5'), content, 'utf-8');
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    })
  );
});

describe('loadPreset', () => {
  test('loads valid preset.json5 from directory', async () => {
    const presetsRoot = await createTempDir('load-preset');
    const presetDir = path.join(presetsRoot, 'my-preset');
    await writePresetManifest(presetDir, {
      name: 'my-preset',
      description: 'A test preset',
      version: '1.0.0',
    });

    const manifest = await loadPreset(presetDir);

    expect(manifest.name).toBe('my-preset');
    expect(manifest.description).toBe('A test preset');
    expect(manifest.version).toBe('1.0.0');
  });

  test('throws on missing preset.json5', async () => {
    const presetsRoot = await createTempDir('missing-preset');
    const nonExistentDir = path.join(presetsRoot, 'no-such-preset');

    await expect(loadPreset(nonExistentDir)).rejects.toThrow(
      'Preset not found:'
    );
  });

  test('throws on missing required field: name', async () => {
    const presetsRoot = await createTempDir('invalid-preset-name');
    const presetDir = path.join(presetsRoot, 'bad-preset');
    await writePresetManifest(presetDir, {
      description: 'Missing name',
      version: '1.0.0',
    });

    await expect(loadPreset(presetDir)).rejects.toThrow(
      'Preset missing required field: name'
    );
  });

  test('surfaces invalid JSON5 parse errors from manifest', async () => {
    const presetsRoot = await createTempDir('invalid-preset-json5');
    const presetDir = path.join(presetsRoot, 'broken-preset');
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(path.join(presetDir, 'preset.json5'), '{', 'utf-8');

    await expect(loadPreset(presetDir)).rejects.toThrow(
      `Invalid JSON5 in ${path.join(presetDir, 'preset.json5')}:`
    );
  });

  test('throws on missing required field: description', async () => {
    const presetsRoot = await createTempDir('invalid-preset-desc');
    const presetDir = path.join(presetsRoot, 'bad-preset');
    await writePresetManifest(presetDir, {
      name: 'bad-preset',
      version: '1.0.0',
    });

    await expect(loadPreset(presetDir)).rejects.toThrow(
      'Preset missing required field: description'
    );
  });

  test('throws on missing required field: version', async () => {
    const presetsRoot = await createTempDir('invalid-preset-ver');
    const presetDir = path.join(presetsRoot, 'bad-preset');
    await writePresetManifest(presetDir, {
      name: 'bad-preset',
      description: 'Missing version',
    });

    await expect(loadPreset(presetDir)).rejects.toThrow(
      'Preset missing required field: version'
    );
  });

  test('loads optional fields when present', async () => {
    const presetsRoot = await createTempDir('full-preset');
    const presetDir = path.join(presetsRoot, 'full-preset');
    await writePresetManifest(presetDir, {
      name: 'full-preset',
      description: 'Full preset with all fields',
      version: '2.0.0',
      author: 'Test Author',
      openclawBootstrap: { memoryIndex: true },
      openclawPlugins: ['openclaw-memory-auto-recall'],
      tags: ['tag1', 'tag2'],
      builtin: false,
    });

    const manifest = await loadPreset(presetDir);

    expect(manifest.author).toBe('Test Author');
    expect(manifest.openclawBootstrap).toEqual({ memoryIndex: true });
    expect(manifest.openclawPlugins).toEqual(['openclaw-memory-auto-recall']);
    expect(manifest.tags).toEqual(['tag1', 'tag2']);
    expect(manifest.builtin).toBe(false);
  });

  test('throws when openclawPlugins is not a string array', async () => {
    const presetsRoot = await createTempDir('invalid-openclaw-plugins');
    const presetDir = path.join(presetsRoot, 'bad-preset');
    await writePresetManifest(presetDir, {
      name: 'bad-preset',
      description: 'Invalid plugins field',
      version: '1.0.0',
      openclawPlugins: [123],
    });

    await expect(loadPreset(presetDir)).rejects.toThrow(
      'Preset invalid field: openclawPlugins'
    );
  });

  test('throws when openclawBootstrap.memoryIndex is not boolean', async () => {
    const presetsRoot = await createTempDir('invalid-openclaw-bootstrap');
    const presetDir = path.join(presetsRoot, 'bad-preset');
    await writePresetManifest(presetDir, {
      name: 'bad-preset',
      description: 'Invalid bootstrap field',
      version: '1.0.0',
      openclawBootstrap: { memoryIndex: 'yes' },
    });

    await expect(loadPreset(presetDir)).rejects.toThrow(
      'Preset invalid field: openclawBootstrap.memoryIndex'
    );
  });
});

describe('listPresets', () => {
  test('listPresets merges built-in + user presets', async () => {
    const presetsRoot = await createTempDir('list-presets');

    const userPresetDir = path.join(presetsRoot, 'user-preset');
    await writePresetManifest(userPresetDir, {
      name: 'user-preset',
      description: 'User preset',
      version: '1.0.0',
    });

    const builtins: PresetManifest[] = [
      {
        name: 'builtin-preset',
        description: 'Built-in preset',
        version: '1.0.0',
        builtin: true,
      },
    ];

    const result = await listPresets(presetsRoot, builtins);

    expect(result).toHaveLength(2);
    const names = result.map((p) => p.name);
    expect(names).toContain('builtin-preset');
    expect(names).toContain('user-preset');
  });

  test('user preset overrides built-in with same name', async () => {
    const presetsRoot = await createTempDir('override-preset');

    const overrideDir = path.join(presetsRoot, 'shared-preset');
    await writePresetManifest(overrideDir, {
      name: 'shared-preset',
      description: 'User version',
      version: '2.0.0',
    });

    const builtins: PresetManifest[] = [
      {
        name: 'shared-preset',
        description: 'Builtin version',
        version: '1.0.0',
        builtin: true,
      },
    ];

    const result = await listPresets(presetsRoot, builtins);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('User version');
    expect(result[0].version).toBe('2.0.0');
  });

  test('returns only built-ins when presetsDir does not exist', async () => {
    const nonExistentDir = path.join(os.tmpdir(), `no-presets-${Date.now()}`);

    const builtins: PresetManifest[] = [
      {
        name: 'builtin-only',
        description: 'Only builtin',
        version: '1.0.0',
        builtin: true,
      },
    ];

    const result = await listPresets(nonExistentDir, builtins);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('builtin-only');
  });

  test('skips invalid preset directories silently', async () => {
    const presetsRoot = await createTempDir('skip-invalid');

    // Valid preset
    const validDir = path.join(presetsRoot, 'valid-preset');
    await writePresetManifest(validDir, {
      name: 'valid-preset',
      description: 'Valid',
      version: '1.0.0',
    });

    // Invalid preset (no manifest file)
    const invalidDir = path.join(presetsRoot, 'invalid-preset');
    await fs.mkdir(invalidDir, { recursive: true });

    const result = await listPresets(presetsRoot, []);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('valid-preset');
  });

  test('skips malformed preset manifests during listing', async () => {
    const presetsRoot = await createTempDir('skip-malformed');

    const validDir = path.join(presetsRoot, 'valid-preset');
    await writePresetManifest(validDir, {
      name: 'valid-preset',
      description: 'Valid',
      version: '1.0.0',
    });

    const malformedDir = path.join(presetsRoot, 'malformed-preset');
    await fs.mkdir(malformedDir, { recursive: true });
    await fs.writeFile(path.join(malformedDir, 'preset.json5'), '{', 'utf-8');

    const result = await listPresets(presetsRoot, []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('valid-preset');
  });

  test('returns empty list when presetsDir empty and no builtins', async () => {
    const presetsRoot = await createTempDir('empty-presets');

    const result = await listPresets(presetsRoot, []);

    expect(result).toHaveLength(0);
  });
});

describe('savePreset', () => {
  test('savePreset creates directory + writes preset.json5', async () => {
    const saveRoot = await createTempDir('save-preset');
    const presetDir = path.join(saveRoot, 'new-preset');

    const manifest: PresetManifest = {
      name: 'new-preset',
      description: 'Newly saved preset',
      version: '1.0.0',
    };

    await savePreset(presetDir, manifest);

    // Verify directory and manifest were created
    const manifestPath = path.join(presetDir, 'preset.json5');
    const stat = await fs.stat(manifestPath);
    expect(stat.isFile()).toBe(true);

    // Verify content round-trips via loadPreset
    const loaded = await loadPreset(presetDir);
    expect(loaded.name).toBe('new-preset');
    expect(loaded.description).toBe('Newly saved preset');
    expect(loaded.version).toBe('1.0.0');
  });

  test('savePreset creates nested directories recursively', async () => {
    const saveRoot = await createTempDir('save-nested');
    const presetDir = path.join(saveRoot, 'level1', 'level2', 'my-preset');

    const manifest: PresetManifest = {
      name: 'my-preset',
      description: 'Nested preset',
      version: '1.0.0',
    };

    await savePreset(presetDir, manifest);

    const loaded = await loadPreset(presetDir);
    expect(loaded.name).toBe('my-preset');
  });

  test('savePreset writes workspace files when provided', async () => {
    const saveRoot = await createTempDir('save-workspace');
    const presetDir = path.join(saveRoot, 'ws-preset');

    const manifest: PresetManifest = {
      name: 'ws-preset',
      description: 'Preset with workspace files',
      version: '1.0.0',
    };

    const workspaceFiles = new Map([
      ['AGENTS.md', '# Agents\nSome content'],
      ['SOUL.md', '# Soul\nSome soul content'],
    ]);

    await savePreset(presetDir, manifest, workspaceFiles);

    const agentsContent = await fs.readFile(
      path.join(presetDir, 'AGENTS.md'),
      'utf-8'
    );
    const soulContent = await fs.readFile(
      path.join(presetDir, 'SOUL.md'),
      'utf-8'
    );

    expect(agentsContent).toBe('# Agents\nSome content');
    expect(soulContent).toBe('# Soul\nSome soul content');
  });
});
