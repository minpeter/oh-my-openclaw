import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { exportCommand } from '../export';

describe('exportCommand', () => {
  let output: string[] = [];
  const originalLog = console.log;
  let tempStateDir: string;

  beforeEach(async () => {
    output = [];
    console.log = (...args: unknown[]) => {
      output.push(args.map(String).join(' '));
    };

    tempStateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-export-test-'));
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

  test('creates preset directory with preset.json5', async () => {
    await exportCommand('my-preset');

    const presetDir = path.join(tempStateDir, 'oh-my-openclaw', 'presets', 'my-preset');
    const manifestPath = path.join(presetDir, 'preset.json5');

    const stat = await fs.stat(manifestPath);
    expect(stat.isFile()).toBe(true);
  });

  test('preset.json5 contains name, description, version fields', async () => {
    await exportCommand('fields-test', { description: 'My custom desc', version: '2.0.0' });

    const presetDir = path.join(tempStateDir, 'oh-my-openclaw', 'presets', 'fields-test');
    const manifestPath = path.join(presetDir, 'preset.json5');
    const content = await fs.readFile(manifestPath, 'utf-8');

    expect(content).toContain('fields-test');
    expect(content).toContain('My custom desc');
    expect(content).toContain('2.0.0');
  });

  test('sensitive fields are excluded from exported config', async () => {
    // Create a config with sensitive fields
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        identity: { name: 'MyBot' },
        auth: { token: 'secret-token' },
        env: { SECRET: 'hidden' },
        meta: { internal: 'data' },
      }),
      'utf-8',
    );

    await exportCommand('sensitive-test');

    const presetDir = path.join(tempStateDir, 'oh-my-openclaw', 'presets', 'sensitive-test');
    const manifestPath = path.join(presetDir, 'preset.json5');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');

    // Sensitive fields should not appear
    expect(manifestContent).not.toContain('secret-token');
    expect(manifestContent).not.toContain('hidden');
    expect(manifestContent).not.toContain('"internal"');

    // Non-sensitive fields should remain
    expect(manifestContent).toContain('MyBot');
  });

  test('errors on duplicate name without --force', async () => {
    await exportCommand('duplicate-preset');

    await expect(exportCommand('duplicate-preset')).rejects.toThrow(
      "Preset 'duplicate-preset' already exists. Use --force to overwrite.",
    );
  });

  test('--force overwrites existing preset', async () => {
    await exportCommand('force-test');

    // Should not throw with --force
    await exportCommand('force-test', { force: true });

    const presetDir = path.join(tempStateDir, 'oh-my-openclaw', 'presets', 'force-test');
    const manifestPath = path.join(presetDir, 'preset.json5');
    const stat = await fs.stat(manifestPath);
    expect(stat.isFile()).toBe(true);
  });

  test('workspace MD files are copied into preset directory', async () => {
    // Create workspace directory with MD files
    const workspaceDir = path.join(tempStateDir, 'workspace');
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.writeFile(path.join(workspaceDir, 'AGENTS.md'), '# My Agent', 'utf-8');
    await fs.writeFile(path.join(workspaceDir, 'SOUL.md'), '# My Soul', 'utf-8');

    await exportCommand('workspace-test');

    const presetDir = path.join(tempStateDir, 'oh-my-openclaw', 'presets', 'workspace-test');

    const agentsFile = path.join(presetDir, 'AGENTS.md');
    const agentsStat = await fs.stat(agentsFile);
    expect(agentsStat.isFile()).toBe(true);

    const agentsContent = await fs.readFile(agentsFile, 'utf-8');
    expect(agentsContent).toBe('# My Agent');

    const soulFile = path.join(presetDir, 'SOUL.md');
    const soulStat = await fs.stat(soulFile);
    expect(soulStat.isFile()).toBe(true);
  });

  test('workspaceFiles list is saved in manifest', async () => {
    const workspaceDir = path.join(tempStateDir, 'workspace');
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.writeFile(path.join(workspaceDir, 'AGENTS.md'), '# Agent', 'utf-8');

    await exportCommand('manifest-files-test');

    const presetDir = path.join(
      tempStateDir,
      'oh-my-openclaw',
      'presets',
      'manifest-files-test',
    );
    const manifestPath = path.join(presetDir, 'preset.json5');
    const content = await fs.readFile(manifestPath, 'utf-8');

    expect(content).toContain('AGENTS.md');
  });

  test('prints success summary after export', async () => {
    await exportCommand('summary-test');

    const combined = output.join('\n');
    expect(combined).toContain('summary-test');
    expect(combined).toContain('exported');
  });

  test('prints workspace files in summary when files are copied', async () => {
    const workspaceDir = path.join(tempStateDir, 'workspace');
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.writeFile(path.join(workspaceDir, 'AGENTS.md'), '# Agent', 'utf-8');

    await exportCommand('summary-with-files');

    const combined = output.join('\n');
    expect(combined).toContain('AGENTS.md');
  });

  test('notes sensitive field exclusion in summary when config has sensitive fields', async () => {
    const configPath = path.join(tempStateDir, 'openclaw.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({ identity: { name: 'Bot' }, env: { KEY: 'value' } }),
      'utf-8',
    );

    await exportCommand('sensitive-summary-test');

    const combined = output.join('\n');
    expect(combined).toContain('Sensitive fields');
  });

  test('exports empty config when no config file exists', async () => {
    // No config file created — should warn and export empty config
    await exportCommand('no-config-test');

    const combined = output.join('\n');
    expect(combined).toContain('No OpenClaw config found');

    const presetDir = path.join(tempStateDir, 'oh-my-openclaw', 'presets', 'no-config-test');
    const manifestPath = path.join(presetDir, 'preset.json5');
    const stat = await fs.stat(manifestPath);
    expect(stat.isFile()).toBe(true);
  });
});
