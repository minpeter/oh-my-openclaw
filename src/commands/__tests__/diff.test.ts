import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { diffCommand } from '../diff';

describe('diffCommand', () => {
  let output: string[] = [];
  const originalLog = console.log;
  let tempStateDir: string;

  beforeEach(async () => {
    output = [];
    console.log = (...args: unknown[]) => {
      output.push(args.map(String).join(' '));
    };

    tempStateDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'openclaw-diff-test-')
    );
    process.env.OPENCLAW_STATE_DIR = tempStateDir;
    delete process.env.OPENCLAW_CONFIG_PATH;
  });

  afterEach(async () => {
    console.log = originalLog;

    delete process.env.OPENCLAW_STATE_DIR;
    delete process.env.OPENCLAW_CONFIG_PATH;

    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
    }
  });

  test('shows added keys (green +) when current config is missing preset keys', async () => {
    // Empty config — all preset keys will be "added"
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(configPath, '{}', 'utf-8');
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('apex');

    const combined = output.join('\n');
    // apex preset has identity, agents, tools keys
    expect(combined).toContain('+');
    // Should show added keys from apex preset
    expect(combined).toMatch(/identity|agents|tools/);
  });

  test('shows changed values with old → new format', async () => {
    const configPath = path.join(tempStateDir, 'openclaw.json');
    // Set identity.name to something different from apex preset (Apex)
    await fs.writeFile(
      configPath,
      JSON.stringify({ identity: { name: 'OldBot', emoji: '🦞' } }),
      'utf-8'
    );
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('apex');

    const combined = output.join('\n');
    // Should show changed value with → separator
    expect(combined).toContain('→');
    expect(combined).toContain('OldBot');
    expect(combined).toContain('Apex');
  });

  test('shows removed keys (null) in red with - prefix', async () => {
    // Create a custom preset with null value (meaning delete)
    const presetsDir = path.join(
      tempStateDir,
      'oh-my-openclaw',
      'presets',
      'test-remove'
    );
    await fs.mkdir(presetsDir, { recursive: true });
    await fs.writeFile(
      path.join(presetsDir, 'preset.json5'),
      JSON.stringify({
        name: 'test-remove',
        description: 'Test preset with removal',
        version: '1.0.0',
        config: {
          tools: null,
        },
      }),
      'utf-8'
    );

    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({ tools: { allow: ['read'] } }),
      'utf-8'
    );
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('test-remove');

    const combined = output.join('\n');
    // Should show removed key with - prefix
    expect(combined).toContain('-');
    expect(combined).toContain('tools');
  });

  test('--json produces valid JSON diff', async () => {
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({ identity: { name: 'OldBot' } }),
      'utf-8'
    );
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('apex', { json: true });

    const jsonOutput = output.join('\n');
    const parsed = JSON.parse(jsonOutput) as {
      preset: string;
      changes: Array<{ path: string; type: string }>;
      workspaceFiles: { toAdd: string[]; toReplace: string[] };
    };

    expect(parsed.preset).toBe('apex');
    expect(Array.isArray(parsed.changes)).toBe(true);
    expect(typeof parsed.workspaceFiles).toBe('object');
    expect(Array.isArray(parsed.workspaceFiles.toAdd)).toBe(true);
    expect(Array.isArray(parsed.workspaceFiles.toReplace)).toBe(true);

    // After legacy migration normalization, identity moves to agents.list
    // So changes should include agents.list (different arrays with OldBot vs Apex)
    const listChange = parsed.changes.find((c) => c.path === 'agents.list');
    expect(listChange).toBeDefined();
    expect(listChange?.type).toBe('changed');
  });

  test('reports workspace file differences', async () => {
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(configPath, '{}', 'utf-8');
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('apex', { json: true });

    const jsonOutput = output.join('\n');
    const parsed = JSON.parse(jsonOutput) as {
      preset: string;
      changes: Array<{ path: string; type: string }>;
      workspaceFiles: { toAdd: string[]; toReplace: string[] };
    };

    // apex preset has 5 workspace files
    // Since workspace dir is empty, all should be in toAdd
    expect(parsed.workspaceFiles.toAdd).toContain('AGENTS.md');
    expect(parsed.workspaceFiles.toAdd).toContain('SOUL.md');
    expect(parsed.workspaceFiles.toAdd).toContain('TOOLS.md');
    expect(parsed.workspaceFiles.toAdd).toContain('USER.md');
    expect(parsed.workspaceFiles.toAdd).toContain('IDENTITY.md');
  });

  test('shows no differences when config matches preset', async () => {
    // Create a minimal preset with no config
    const presetsDir = path.join(
      tempStateDir,
      'oh-my-openclaw',
      'presets',
      'empty-preset'
    );
    await fs.mkdir(presetsDir, { recursive: true });
    await fs.writeFile(
      path.join(presetsDir, 'preset.json5'),
      JSON.stringify({
        name: 'empty-preset',
        description: 'Empty preset for testing',
        version: '1.0.0',
        config: {},
        workspaceFiles: [],
      }),
      'utf-8'
    );

    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(configPath, '{}', 'utf-8');
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await diffCommand('empty-preset');

    const combined = output.join('\n');
    expect(combined).toContain('No differences');
  });

  test('throws error for unknown preset', async () => {
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(configPath, '{}', 'utf-8');
    process.env.OPENCLAW_CONFIG_PATH = configPath;

    await expect(diffCommand('nonexistent-preset-xyz')).rejects.toThrow(
      "Preset 'nonexistent-preset-xyz' not found."
    );
  });
});
