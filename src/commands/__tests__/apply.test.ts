import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';
import JSON5 from 'json5';

import { applyCommand } from '../apply';

interface TempEnv {
  stateDir: string;
  configPath: string;
  workspaceDir: string;
  presetsDir: string;
  backupsDir: string;
}

const tempDirs: string[] = [];
const originalEnv = { ...process.env };

async function createTempEnv(prefix: string): Promise<TempEnv> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(rootDir);

  const stateDir = path.join(rootDir, '.openclaw');
  const configPath = path.join(stateDir, 'openclaw.json');
  const workspaceDir = path.join(stateDir, 'workspace');
  const presetsDir = path.join(stateDir, 'oh-my-openclaw', 'presets');
  const backupsDir = path.join(stateDir, 'oh-my-openclaw', 'backups');

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(presetsDir, { recursive: true });
  await fs.mkdir(backupsDir, { recursive: true });

  process.env.OPENCLAW_CONFIG_PATH = configPath;
  delete process.env.OPENCLAW_STATE_DIR;

  return { stateDir, configPath, workspaceDir, presetsDir, backupsDir };
}

async function writeConfig(configPath: string, data: Record<string, unknown>): Promise<void> {
  await fs.writeFile(configPath, JSON5.stringify(data, null, 2), 'utf-8');
}

async function readConfig(configPath: string): Promise<Record<string, unknown>> {
  return JSON5.parse(await fs.readFile(configPath, 'utf-8')) as Record<string, unknown>;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeUserPreset(
  presetsDir: string,
  presetName: string,
  manifest: Record<string, unknown>,
  workspaceFiles: Record<string, string> = {},
): Promise<void> {
  const presetDir = path.join(presetsDir, presetName);
  await fs.mkdir(presetDir, { recursive: true });
  await fs.writeFile(path.join(presetDir, 'preset.json5'), JSON5.stringify(manifest, null, 2), 'utf-8');

  for (const [filename, content] of Object.entries(workspaceFiles)) {
    await fs.writeFile(path.join(presetDir, filename), content, 'utf-8');
  }
}

async function captureLogs(run: () => Promise<void>): Promise<string[]> {
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };

  try {
    await run();
  } finally {
    console.log = originalLog;
  }

  return logs;
}

afterEach(async () => {
  process.env = { ...originalEnv };
  await Promise.all(
    tempDirs.splice(0).map(async (tempDir) => {
      await fs.rm(tempDir, { recursive: true, force: true });
    }),
  );
});

describe('applyCommand', () => {
  test('applies preset config via deep merge', async () => {
    const env = await createTempEnv('openclaw-apply-merge-');

    await writeConfig(env.configPath, {
      identity: { name: 'OldBot', emoji: 'lobster' },
      agents: { defaults: { temperature: 0.2 } },
      tools: { allow: ['read'] },
      untouched: { keep: true },
    });

    await writeUserPreset(env.presetsDir, 'merge-preset', {
      name: 'merge-preset',
      description: 'Merge test preset',
      version: '1.0.0',
      config: {
        identity: { name: 'NewBot' },
        agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-5' } } },
        tools: { allow: ['read', 'write'] },
      },
    });

    await applyCommand('merge-preset');

    const merged = await readConfig(env.configPath);
    expect(merged).toEqual({
      identity: { name: 'NewBot', emoji: 'lobster' },
      agents: {
        defaults: {
          temperature: 0.2,
          model: { primary: 'anthropic/claude-sonnet-4-5' },
        },
      },
      tools: { allow: ['read', 'write'] },
      untouched: { keep: true },
    });
  });

  test('copies preset MD files to workspace', async () => {
    const env = await createTempEnv('openclaw-apply-ws-copy-');

    await writeConfig(env.configPath, { identity: { name: 'CopyBot' } });

    await writeUserPreset(
      env.presetsDir,
      'workspace-preset',
      {
        name: 'workspace-preset',
        description: 'Workspace copy preset',
        version: '1.0.0',
        workspaceFiles: ['AGENTS.md', 'SOUL.md'],
      },
      {
        'AGENTS.md': '# Agents\nWorkspace copy test',
        'SOUL.md': '# Soul\nWorkspace copy test',
      },
    );

    await applyCommand('workspace-preset');

    const agents = await fs.readFile(path.join(env.workspaceDir, 'AGENTS.md'), 'utf-8');
    const soul = await fs.readFile(path.join(env.workspaceDir, 'SOUL.md'), 'utf-8');

    expect(agents).toBe('# Agents\nWorkspace copy test');
    expect(soul).toBe('# Soul\nWorkspace copy test');
  });

  test('creates backup before writing', async () => {
    const env = await createTempEnv('openclaw-apply-backup-');

    const beforeConfig = {
      identity: { name: 'BeforeBackup' },
      tools: { allow: ['read'] },
    };
    await writeConfig(env.configPath, beforeConfig);

    await writeUserPreset(env.presetsDir, 'backup-preset', {
      name: 'backup-preset',
      description: 'Backup preset',
      version: '1.0.0',
      config: {
        identity: { name: 'AfterBackup' },
      },
    });

    await applyCommand('backup-preset');

    const backupEntries = await fs.readdir(env.backupsDir);
    const configBackups = backupEntries.filter((entry) => entry.endsWith('.bak'));

    expect(configBackups.length).toBe(1);

    const backupConfig = JSON5.parse(
      await fs.readFile(path.join(env.backupsDir, configBackups[0]), 'utf-8'),
    ) as Record<string, unknown>;
    expect(backupConfig).toEqual(beforeConfig);

    const updated = await readConfig(env.configPath);
    expect(updated.identity).toEqual({ name: 'AfterBackup' });
  });

  test('--dry-run shows changes without writing', async () => {
    const env = await createTempEnv('openclaw-apply-dry-run-');

    const originalConfig = {
      identity: { name: 'DryRunOriginal' },
    };
    await writeConfig(env.configPath, originalConfig);

    await writeUserPreset(env.presetsDir, 'dry-run-preset', {
      name: 'dry-run-preset',
      description: 'Dry run preset',
      version: '1.0.0',
      config: {
        identity: { name: 'DryRunUpdated' },
      },
      workspaceFiles: ['AGENTS.md'],
    });

    const logs = await captureLogs(async () => {
      await applyCommand('dry-run-preset', { dryRun: true });
    });

    const currentConfig = await readConfig(env.configPath);
    expect(currentConfig).toEqual(originalConfig);
    expect(await fileExists(path.join(env.workspaceDir, 'AGENTS.md'))).toBe(false);

    const backupEntries = await fs.readdir(env.backupsDir);
    expect(backupEntries.length).toBe(0);

    const combined = logs.join('\n');
    expect(combined).toContain('DRY RUN');
    expect(combined).toContain('dry-run-preset');
  });

  test('filters sensitive fields from preset config before merge', async () => {
    const env = await createTempEnv('openclaw-apply-sensitive-');

    await writeConfig(env.configPath, {
      identity: { name: 'BaseBot' },
      env: { BASE_ONLY: 'keep-me' },
      gateway: { port: 18789, auth: { token: 'base-token' } },
      models: {
        providers: {
          custom: {
            apiKey: 'base-provider-key',
            baseUrl: 'https://base.example.com',
          },
        },
      },
    });

    await writeUserPreset(env.presetsDir, 'sensitive-preset', {
      name: 'sensitive-preset',
      description: 'Sensitive filter preset',
      version: '1.0.0',
      config: {
        identity: { name: 'SafeBot' },
        auth: { profiles: { default: { provider: 'anthropic' } } },
        env: { OPENROUTER_API_KEY: 'new-secret' },
        gateway: {
          port: 19000,
          auth: { token: 'new-token' },
        },
        models: {
          providers: {
            custom: {
              apiKey: 'new-provider-key',
              baseUrl: 'https://override.example.com',
            },
          },
        },
      },
    });

    await applyCommand('sensitive-preset');

    const merged = await readConfig(env.configPath);
    expect(merged).toEqual({
      identity: { name: 'SafeBot' },
      env: { BASE_ONLY: 'keep-me' },
      gateway: { port: 19000, auth: { token: 'base-token' } },
      models: {
        providers: {
          custom: {
            apiKey: 'base-provider-key',
            baseUrl: 'https://override.example.com',
          },
        },
      },
    });
  });

  test('prints gateway restart reminder', async () => {
    const env = await createTempEnv('openclaw-apply-reminder-');

    await writeConfig(env.configPath, { identity: { name: 'ReminderBase' } });

    const logs = await captureLogs(async () => {
      await applyCommand('apex');
    });

    const combined = logs.join('\n');
    expect(combined).toContain("openclaw gateway restart");
    expect(combined).toContain("Preset 'apex' applied");

    const config = await readConfig(env.configPath);
    expect(config.identity).toEqual({ name: 'Apex', theme: 'all-in-one power assistant', emoji: '⚡' });
  });

  test('handles preset with only MD files (no config)', async () => {
    const env = await createTempEnv('openclaw-apply-md-only-');

    const beforeConfig = { identity: { name: 'MdOnlyBase' } };
    await writeConfig(env.configPath, beforeConfig);

    await writeUserPreset(
      env.presetsDir,
      'md-only-preset',
      {
        name: 'md-only-preset',
        description: 'MD only preset',
        version: '1.0.0',
        workspaceFiles: ['AGENTS.md'],
      },
      {
        'AGENTS.md': '# Agents\nMD only',
      },
    );

    await applyCommand('md-only-preset');

    const afterConfig = await readConfig(env.configPath);
    expect(afterConfig).toEqual(beforeConfig);

    const agents = await fs.readFile(path.join(env.workspaceDir, 'AGENTS.md'), 'utf-8');
    expect(agents).toBe('# Agents\nMD only');
  });

  test('handles preset with only config (no MD files)', async () => {
    const env = await createTempEnv('openclaw-apply-config-only-');

    await writeConfig(env.configPath, {
      identity: { name: 'ConfigOnlyBase' },
      tools: { allow: ['read'] },
    });

    await writeUserPreset(env.presetsDir, 'config-only-preset', {
      name: 'config-only-preset',
      description: 'Config only preset',
      version: '1.0.0',
      config: {
        identity: { name: 'ConfigOnlyUpdated' },
        tools: { allow: ['read', 'write'] },
      },
    });

    await applyCommand('config-only-preset');

    const updatedConfig = await readConfig(env.configPath);
    expect(updatedConfig).toEqual({
      identity: { name: 'ConfigOnlyUpdated' },
      tools: { allow: ['read', 'write'] },
    });

    expect(await fileExists(path.join(env.workspaceDir, 'AGENTS.md'))).toBe(false);
  });

  test('--clean removes config and workspace files before applying', async () => {
    const env = await createTempEnv('openclaw-apply-clean-');

    await writeConfig(env.configPath, { identity: { name: 'OldBot' }, untouched: { keep: true } });
    await fs.writeFile(path.join(env.workspaceDir, 'AGENTS.md'), '# Old Agents', 'utf-8');
    await fs.writeFile(path.join(env.workspaceDir, 'SOUL.md'), '# Old Soul', 'utf-8');

    const logs = await captureLogs(async () => {
      await applyCommand('apex', { clean: true, noBackup: true });
    });

    // Config is fresh (not merged with OldBot — 'untouched' key must be gone)
    const config = await readConfig(env.configPath);
    expect((config.identity as Record<string, unknown>).name).toBe('Apex');
    expect(config.untouched).toBeUndefined();

    // Workspace files are overwritten by apex preset files
    const agentsContent = await fs.readFile(path.join(env.workspaceDir, 'AGENTS.md'), 'utf-8');
    expect(agentsContent).not.toBe('# Old Agents');

    const combined = logs.join('\n');
    expect(combined).toContain('Clean install');
  })

  test('--clean creates backup before wiping', async () => {
    const env = await createTempEnv('openclaw-apply-clean-backup-');

    const beforeConfig = { identity: { name: 'BackupMe' } };
    await writeConfig(env.configPath, beforeConfig);

    await applyCommand('apex', { clean: true });

    const backupEntries = await fs.readdir(env.backupsDir);
    const configBackups = backupEntries.filter((entry) => entry.endsWith('.bak'));
    expect(configBackups.length).toBeGreaterThanOrEqual(1);

    const backupConfig = JSON5.parse(
      await fs.readFile(path.join(env.backupsDir, configBackups[0]), 'utf-8'),
    ) as Record<string, unknown>;
    expect(backupConfig).toEqual(beforeConfig);
  });

  test('--clean with --dry-run does not delete anything', async () => {
    const env = await createTempEnv('openclaw-apply-clean-dry-');

    await writeConfig(env.configPath, { identity: { name: 'DryClean' } });
    await fs.writeFile(path.join(env.workspaceDir, 'AGENTS.md'), 'original content', 'utf-8');

    const logs = await captureLogs(async () => {
      await applyCommand('apex', { clean: true, dryRun: true });
    });

    const config = await readConfig(env.configPath);
    expect((config.identity as Record<string, unknown>).name).toBe('DryClean');

    const agentsContent = await fs.readFile(path.join(env.workspaceDir, 'AGENTS.md'), 'utf-8');
    expect(agentsContent).toBe('original content');

    const backupEntries = await fs.readdir(env.backupsDir);
    expect(backupEntries.length).toBe(0);

    const combined = logs.join('\n');
    expect(combined).toContain('DRY RUN');
    expect(combined).toContain('CLEAN INSTALL');
  });

  test('install alias applies apex preset', async () => {
    const env = await createTempEnv('openclaw-apply-install-');

    await writeConfig(env.configPath, { identity: { name: 'InstallBase' } });

    await applyCommand('apex', { noBackup: true });

    const config = await readConfig(env.configPath);
    expect((config.identity as Record<string, unknown>).name).toBe('Apex');
    expect((config.identity as Record<string, unknown>).theme).toBe('all-in-one power assistant');
  });
});
