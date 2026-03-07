import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSON5 from 'json5';
import { setOpenClawCommandExecutorForTests } from '../../core/openclaw-plugin';
import { applyCommand } from '../apply';

interface TempEnv {
  backupsDir: string;
  configPath: string;
  presetsDir: string;
  stateDir: string;
  workspaceDir: string;
}

const tempDirs: string[] = [];
const originalEnv = { ...process.env };
const FAILED_TO_CLONE_PATTERN = /Failed to clone/;
const INVALID_PRESET_JSON_PATTERN = /Invalid JSON5 in .*preset\.json5:/;

async function createTempEnv(prefix: string): Promise<TempEnv> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(rootDir);

  const stateDir = path.join(rootDir, '.openclaw');
  const configPath = path.join(stateDir, 'openclaw.json');
  const workspaceDir = path.join(stateDir, 'workspace');
  const presetsDir = path.join(stateDir, 'apex', 'presets');
  const backupsDir = path.join(stateDir, 'apex', 'backups');

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(presetsDir, { recursive: true });
  await fs.mkdir(backupsDir, { recursive: true });

  process.env.OPENCLAW_CONFIG_PATH = configPath;
  Reflect.deleteProperty(process.env, 'OPENCLAW_STATE_DIR');

  return { stateDir, configPath, workspaceDir, presetsDir, backupsDir };
}

async function writeConfig(
  configPath: string,
  data: Record<string, unknown>
): Promise<void> {
  await fs.writeFile(configPath, JSON5.stringify(data, null, 2), 'utf-8');
}

async function readConfig(
  configPath: string
): Promise<Record<string, unknown>> {
  return JSON5.parse(await fs.readFile(configPath, 'utf-8')) as Record<
    string,
    unknown
  >;
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
  workspaceFiles: Record<string, string> = {}
): Promise<void> {
  const presetDir = path.join(presetsDir, presetName);
  await fs.mkdir(presetDir, { recursive: true });
  await fs.writeFile(
    path.join(presetDir, 'preset.json5'),
    JSON5.stringify(manifest, null, 2),
    'utf-8'
  );

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
  setOpenClawCommandExecutorForTests();
  process.env = { ...originalEnv };
  await Promise.all(
    tempDirs.splice(0).map(async (tempDir) => {
      await fs.rm(tempDir, { recursive: true, force: true });
    })
  );
});

beforeEach(() => {
  setOpenClawCommandExecutorForTests(async () => ({
    exitCode: 0,
    stderr: '',
    stdout: '',
  }));
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
        agents: {
          defaults: { model: { primary: 'anthropic/claude-sonnet-4-5' } },
        },
        tools: { allow: ['read', 'write'] },
      },
    });

    await applyCommand('merge-preset');

    const merged = await readConfig(env.configPath);
    expect(merged).toEqual({
      agents: {
        defaults: {
          temperature: 0.2,
          model: { primary: 'anthropic/claude-sonnet-4-5' },
        },
        list: [{ id: 'main', identity: { name: 'NewBot', emoji: 'lobster' } }],
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
      }
    );

    await applyCommand('workspace-preset');

    const agents = await fs.readFile(
      path.join(env.workspaceDir, 'AGENTS.md'),
      'utf-8'
    );
    const soul = await fs.readFile(
      path.join(env.workspaceDir, 'SOUL.md'),
      'utf-8'
    );

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
    const configBackups = backupEntries.filter((entry) =>
      entry.endsWith('.bak')
    );

    expect(configBackups.length).toBe(1);

    const backupConfig = JSON5.parse(
      await fs.readFile(path.join(env.backupsDir, configBackups[0]), 'utf-8')
    ) as Record<string, unknown>;
    expect(backupConfig).toEqual(beforeConfig);

    const updated = await readConfig(env.configPath);
    expect(
      (
        (
          (updated.agents as Record<string, unknown>).list as Record<
            string,
            unknown
          >[]
        )[0].identity as Record<string, unknown>
      ).name
    ).toBe('AfterBackup');
  });

  test('--dry-run shows changes without writing', async () => {
    const env = await createTempEnv('openclaw-apply-dry-run-');

    const originalConfig = { identity: { name: 'DryRunOriginal' } };
    await fs.writeFile(
      env.configPath,
      "{\n  // keep this comment\n  identity: { name: 'DryRunOriginal' },\n}\n",
      'utf-8'
    );

    await writeUserPreset(env.presetsDir, 'dry-run-preset', {
      name: 'dry-run-preset',
      description: 'Dry run preset',
      version: '1.0.0',
      openclawPlugins: ['openclaw-memory-auto-recall'],
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
    expect(await fileExists(path.join(env.workspaceDir, 'AGENTS.md'))).toBe(
      false
    );

    const backupEntries = await fs.readdir(env.backupsDir);
    expect(backupEntries.length).toBe(0);

    const combined = logs.join('\n');
    expect(combined).toContain('DRY RUN');
    expect(combined).toContain('dry-run-preset');
    expect(combined).toContain('Dry-run note: detected JSON5 comments');
    expect(combined).toContain(
      'OpenClaw plugins to install: openclaw-memory-auto-recall'
    );
    expect(combined).toContain('remove those comments');
  });

  test('installs declared OpenClaw plugins before writing config', async () => {
    const env = await createTempEnv('openclaw-apply-plugin-install-');
    const commands: string[][] = [];

    setOpenClawCommandExecutorForTests(async (command) => {
      commands.push(command);
      if (
        command.join(' ') ===
        'openclaw plugins install openclaw-memory-auto-recall'
      ) {
        await writeConfig(env.configPath, {
          plugins: {
            installs: {
              'memory-auto-recall': {
                source: 'npm',
                spec: 'openclaw-memory-auto-recall',
                installPath: '/tmp/extensions/memory-auto-recall',
              },
            },
          },
        });
      }

      return {
        exitCode: 0,
        stderr: '',
        stdout: 'installed',
      };
    });

    await writeConfig(env.configPath, { identity: { name: 'PluginBase' } });
    await writeUserPreset(env.presetsDir, 'plugin-preset', {
      name: 'plugin-preset',
      description: 'Plugin install preset',
      version: '1.0.0',
      openclawBootstrap: { memoryIndex: true },
      openclawPlugins: ['openclaw-memory-auto-recall'],
      config: {
        identity: { name: 'PluginEnabled' },
      },
    });

    const logs = await captureLogs(async () => {
      await applyCommand('plugin-preset', { noBackup: true });
    });

    expect(commands).toEqual([
      ['openclaw', 'plugins', 'install', 'openclaw-memory-auto-recall'],
      ['openclaw', 'memory', 'index'],
    ]);
    expect(logs.join('\n')).toContain(
      'OK OpenClaw plugins ready: openclaw-memory-auto-recall'
    );
    expect(logs.join('\n')).toContain('OK OpenClaw memory indexed.');

    const updated = await readConfig(env.configPath);
    expect(updated).toHaveProperty(
      'plugins.installs.memory-auto-recall.spec',
      'openclaw-memory-auto-recall'
    );
    expect(
      (
        (
          (updated.agents as Record<string, unknown>).list as Record<
            string,
            unknown
          >[]
        )[0].identity as Record<string, unknown>
      ).name
    ).toBe('PluginEnabled');
  });

  test('clean apply preserves plugin install state after cleanup', async () => {
    const env = await createTempEnv('openclaw-apply-plugin-clean-');
    const commands: string[][] = [];

    setOpenClawCommandExecutorForTests(async (command) => {
      commands.push(command);
      if (
        command.join(' ') ===
        'openclaw plugins install openclaw-memory-auto-recall'
      ) {
        await writeConfig(env.configPath, {
          plugins: {
            installs: {
              'memory-auto-recall': {
                source: 'npm',
                spec: 'openclaw-memory-auto-recall',
                installPath: '/tmp/extensions/memory-auto-recall',
              },
            },
          },
        });
      }

      return {
        exitCode: 0,
        stderr: '',
        stdout: 'installed',
      };
    });

    await writeConfig(env.configPath, { identity: { name: 'BeforeClean' } });
    await writeUserPreset(env.presetsDir, 'plugin-clean-preset', {
      name: 'plugin-clean-preset',
      description: 'Plugin clean preset',
      version: '1.0.0',
      openclawBootstrap: { memoryIndex: true },
      openclawPlugins: ['openclaw-memory-auto-recall'],
      config: {
        identity: { name: 'AfterClean' },
      },
    });

    await applyCommand('plugin-clean-preset', {
      clean: true,
      noBackup: true,
    });

    expect(commands).toEqual([
      ['openclaw', 'plugins', 'install', 'openclaw-memory-auto-recall'],
      ['openclaw', 'memory', 'index'],
    ]);

    const updated = await readConfig(env.configPath);
    expect(updated).toHaveProperty(
      'plugins.installs.memory-auto-recall.spec',
      'openclaw-memory-auto-recall'
    );
    expect(
      (
        (
          (updated.agents as Record<string, unknown>).list as Record<
            string,
            unknown
          >[]
        )[0].identity as Record<string, unknown>
      ).name
    ).toBe('AfterClean');
  });

  test('plugin install failure aborts apply before config changes', async () => {
    const env = await createTempEnv('openclaw-apply-plugin-fail-');
    const beforeConfig = { identity: { name: 'PluginBase' } };

    setOpenClawCommandExecutorForTests(async () => ({
      exitCode: 1,
      stderr: 'registry unavailable',
      stdout: '',
    }));

    await writeConfig(env.configPath, beforeConfig);
    await writeUserPreset(env.presetsDir, 'plugin-fail-preset', {
      name: 'plugin-fail-preset',
      description: 'Plugin failure preset',
      version: '1.0.0',
      openclawBootstrap: { memoryIndex: true },
      openclawPlugins: ['openclaw-memory-auto-recall'],
      config: {
        identity: { name: 'ShouldNotApply' },
      },
      workspaceFiles: ['AGENTS.md'],
    });

    await expect(applyCommand('plugin-fail-preset')).rejects.toThrow(
      "Failed to install OpenClaw plugin 'openclaw-memory-auto-recall': registry unavailable"
    );

    expect(await readConfig(env.configPath)).toEqual(beforeConfig);
    expect(await fileExists(path.join(env.workspaceDir, 'AGENTS.md'))).toBe(
      false
    );

    const backupEntries = await fs.readdir(env.backupsDir);
    const configBackups = backupEntries.filter((entry) =>
      entry.endsWith('.bak')
    );
    expect(configBackups).toHaveLength(1);

    const backupConfig = JSON5.parse(
      await fs.readFile(path.join(env.backupsDir, configBackups[0]), 'utf-8')
    ) as Record<string, unknown>;
    expect(backupConfig).toEqual(beforeConfig);
  });

  test('warns when apply rewrites existing JSON5 comments', async () => {
    const env = await createTempEnv('openclaw-apply-comment-warning-');

    await fs.writeFile(
      env.configPath,
      "{\n  // comment to preserve manually\n  identity: { name: 'Before' },\n}\n",
      'utf-8'
    );

    await writeUserPreset(env.presetsDir, 'comment-warning-preset', {
      name: 'comment-warning-preset',
      description: 'Comment warning preset',
      version: '1.0.0',
      config: {
        identity: { name: 'After' },
      },
    });

    const logs = await captureLogs(async () => {
      await applyCommand('comment-warning-preset', { noBackup: true });
    });

    const combined = logs.join('\n');
    expect(combined).toContain('Warning: detected JSON5 comments');
    expect(combined).toContain('removes those comments');
  });

  test('--verbose prints detailed operation logs', async () => {
    const env = await createTempEnv('openclaw-apply-verbose-');

    await writeConfig(env.configPath, { identity: { name: 'VerboseBase' } });
    await writeUserPreset(env.presetsDir, 'verbose-preset', {
      name: 'verbose-preset',
      description: 'Verbose apply test',
      version: '1.0.0',
      config: {
        identity: { name: 'VerboseUpdated' },
      },
    });

    const logs = await captureLogs(async () => {
      await applyCommand('verbose-preset', { noBackup: true, verbose: true });
    });

    const combined = logs.join('\n');
    expect(combined).toContain('[verbose]');
    expect(combined).toContain('Resolved paths:');
    expect(combined).toContain('Apply flow completed');
  });

  test('filters sensitive fields from preset config before merge', async () => {
    const env = await createTempEnv('openclaw-apply-sensitive-');

    await writeConfig(env.configPath, {
      identity: { name: 'BaseBot' },
      env: { BASE_ONLY: 'keep-me' },
      gateway: { port: 18_789, auth: { token: 'base-token' } },
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
          port: 19_000,
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
      agents: {
        defaults: {},
        list: [{ id: 'main', identity: { name: 'SafeBot' } }],
      },
      env: { BASE_ONLY: 'keep-me' },
      gateway: { port: 19_000, auth: { token: 'base-token' } },
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
    expect(combined).toContain('openclaw gateway restart');
    expect(combined).toContain("Preset 'apex' applied");

    const config = await readConfig(env.configPath);
    expect(
      (
        (config.agents as Record<string, unknown>).list as Record<
          string,
          unknown
        >[]
      )[0].identity
    ).toEqual({
      name: 'Apex',
      theme: 'all-in-one power assistant',
      emoji: '⚡',
    });
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
      }
    );

    await applyCommand('md-only-preset');

    const afterConfig = await readConfig(env.configPath);
    expect(afterConfig).toEqual(beforeConfig);

    const agents = await fs.readFile(
      path.join(env.workspaceDir, 'AGENTS.md'),
      'utf-8'
    );
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
      agents: {
        defaults: {},
        list: [{ id: 'main', identity: { name: 'ConfigOnlyUpdated' } }],
      },
      tools: { allow: ['read', 'write'] },
    });

    expect(await fileExists(path.join(env.workspaceDir, 'AGENTS.md'))).toBe(
      false
    );
  });

  test('throws when existing config is invalid JSON5', async () => {
    const env = await createTempEnv('openclaw-apply-invalid-config-');

    await fs.writeFile(env.configPath, '{ invalid', 'utf-8');
    await writeUserPreset(env.presetsDir, 'valid-preset', {
      name: 'valid-preset',
      description: 'Valid preset used against invalid config',
      version: '1.0.0',
      config: {
        identity: { name: 'ShouldNotApply' },
      },
    });

    await expect(applyCommand('valid-preset')).rejects.toThrow(
      `Invalid JSON5 in ${env.configPath}:`
    );

    const raw = await fs.readFile(env.configPath, 'utf-8');
    expect(raw).toBe('{ invalid');
  });

  test('throws when user preset exists but manifest is invalid', async () => {
    const env = await createTempEnv('openclaw-apply-invalid-user-preset-');

    await writeConfig(env.configPath, { identity: { name: 'BaseBot' } });
    const brokenPresetDir = path.join(env.presetsDir, 'apex');
    await fs.mkdir(brokenPresetDir, { recursive: true });
    await fs.writeFile(
      path.join(brokenPresetDir, 'preset.json5'),
      '{',
      'utf-8'
    );

    await expect(applyCommand('apex')).rejects.toThrow(
      INVALID_PRESET_JSON_PATTERN
    );
  });

  test('--clean removes config and workspace files before applying', async () => {
    const env = await createTempEnv('openclaw-apply-clean-');

    await writeConfig(env.configPath, {
      identity: { name: 'OldBot' },
      untouched: { keep: true },
    });
    await fs.writeFile(
      path.join(env.workspaceDir, 'AGENTS.md'),
      '# Old Agents',
      'utf-8'
    );
    await fs.writeFile(
      path.join(env.workspaceDir, 'SOUL.md'),
      '# Old Soul',
      'utf-8'
    );

    const logs = await captureLogs(async () => {
      await applyCommand('apex', { clean: true, noBackup: true });
    });

    // Config is fresh (not merged with OldBot — 'untouched' key must be gone)
    const config = await readConfig(env.configPath);
    expect(
      (
        (
          (config.agents as Record<string, unknown>).list as Record<
            string,
            unknown
          >[]
        )[0].identity as Record<string, unknown>
      ).name
    ).toBe('Apex');
    expect(config.untouched).toBeUndefined();

    // Workspace files are overwritten by apex preset files
    const agentsContent = await fs.readFile(
      path.join(env.workspaceDir, 'AGENTS.md'),
      'utf-8'
    );
    expect(agentsContent).not.toBe('# Old Agents');

    const combined = logs.join('\n');
    expect(combined).toContain('Clean install');
  });

  test('--clean creates backup before wiping', async () => {
    const env = await createTempEnv('openclaw-apply-clean-backup-');

    const beforeConfig = { identity: { name: 'BackupMe' } };
    await writeConfig(env.configPath, beforeConfig);

    await applyCommand('apex', { clean: true });

    const backupEntries = await fs.readdir(env.backupsDir);
    const configBackups = backupEntries.filter((entry) =>
      entry.endsWith('.bak')
    );
    expect(configBackups.length).toBeGreaterThanOrEqual(1);

    const backupConfig = JSON5.parse(
      await fs.readFile(path.join(env.backupsDir, configBackups[0]), 'utf-8')
    ) as Record<string, unknown>;
    expect(backupConfig).toEqual(beforeConfig);
  });

  test('--clean with --dry-run does not delete anything', async () => {
    const env = await createTempEnv('openclaw-apply-clean-dry-');

    await writeConfig(env.configPath, { identity: { name: 'DryClean' } });
    await fs.writeFile(
      path.join(env.workspaceDir, 'AGENTS.md'),
      'original content',
      'utf-8'
    );

    const logs = await captureLogs(async () => {
      await applyCommand('apex', { clean: true, dryRun: true });
    });

    const config = await readConfig(env.configPath);
    expect((config.identity as Record<string, unknown>).name).toBe('DryClean');

    const agentsContent = await fs.readFile(
      path.join(env.workspaceDir, 'AGENTS.md'),
      'utf-8'
    );
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
    expect(
      (
        (
          (config.agents as Record<string, unknown>).list as Record<
            string,
            unknown
          >[]
        )[0].identity as Record<string, unknown>
      ).name
    ).toBe('Apex');
    expect(
      (
        (
          (config.agents as Record<string, unknown>).list as Record<
            string,
            unknown
          >[]
        )[0].identity as Record<string, unknown>
      ).theme
    ).toBe('all-in-one power assistant');
  });

  test('rejects invalid local preset names', async () => {
    const invalidNames = ['', 'bad$name', 'bad name', 'bad\\name'];
    for (const name of invalidNames) {
      await expect(applyCommand(name)).rejects.toThrow(
        `Invalid preset name '${name}'. Only letters, numbers, '_' and '-' are allowed.`
      );
    }
  });
});

describe('remote apply', () => {
  test('applies remote preset via owner/repo shorthand', async () => {
    const env = await createTempEnv('openclaw-apply-remote-shorthand-');

    await writeConfig(env.configPath, { identity: { name: 'BaseBot' } });

    await applyCommand('minpeter/demo-researcher', { noBackup: true });

    // Should have cached the preset
    const cachePath = path.join(env.presetsDir, 'minpeter--demo-researcher');
    expect(await fileExists(cachePath)).toBe(true);

    // Should have applied config (researcher preset has config changes)
    const config = await readConfig(env.configPath);
    expect(config).not.toEqual({ identity: { name: 'BaseBot' } }); // config changed

    // Should have copied workspace files (researcher has AGENTS.md, SOUL.md)
    expect(await fileExists(path.join(env.workspaceDir, 'AGENTS.md'))).toBe(
      true
    );
  }, 60_000);

  test('applies remote preset via full GitHub URL', async () => {
    const env = await createTempEnv('openclaw-apply-remote-url-');

    await writeConfig(env.configPath, { identity: { name: 'BaseBot' } });

    await applyCommand('https://github.com/minpeter/demo-researcher', {
      noBackup: true,
    });

    const cachePath = path.join(env.presetsDir, 'minpeter--demo-researcher');
    expect(await fileExists(cachePath)).toBe(true);
  }, 60_000);

  test('uses cached preset on second apply (no re-download)', async () => {
    const env = await createTempEnv('openclaw-apply-remote-cached-');

    await writeConfig(env.configPath, { identity: { name: 'BaseBot' } });

    // First apply — clones
    await applyCommand('minpeter/demo-researcher', { noBackup: true });

    // Second apply — should use cache
    const logs = await captureLogs(async () => {
      await applyCommand('minpeter/demo-researcher', { noBackup: true });
    });

    const combined = logs.join('\n');
    expect(combined).toContain('cached');
  }, 60_000);

  test('--force re-downloads cached preset', async () => {
    const env = await createTempEnv('openclaw-apply-remote-force-');

    await writeConfig(env.configPath, { identity: { name: 'BaseBot' } });

    // First apply — clone
    await applyCommand('minpeter/demo-researcher', { noBackup: true });

    // Force re-download — no "cached" message
    const logs = await captureLogs(async () => {
      await applyCommand('minpeter/demo-researcher', {
        noBackup: true,
        force: true,
      });
    });

    const combined = logs.join('\n');
    expect(combined).not.toContain('Using cached');

    // Should still work after force re-download
    const cachePath = path.join(env.presetsDir, 'minpeter--demo-researcher');
    expect(await fileExists(cachePath)).toBe(true);
  }, 60_000);

  test('--dry-run with remote preset shows changes without applying', async () => {
    const env = await createTempEnv('openclaw-apply-remote-dry-');

    const originalConfig = { identity: { name: 'DryBaseBot' } };
    await writeConfig(env.configPath, originalConfig);

    const logs = await captureLogs(async () => {
      await applyCommand('minpeter/demo-researcher', {
        dryRun: true,
        noBackup: true,
      });
    });

    // Config should NOT be changed (dry-run)
    const config = await readConfig(env.configPath);
    expect(config).toEqual(originalConfig);

    // No workspace files copied (dry-run)
    expect(await fileExists(path.join(env.workspaceDir, 'AGENTS.md'))).toBe(
      false
    );

    // Dry-run output shown
    const combined = logs.join('\n');
    expect(combined).toContain('DRY RUN');
  }, 60_000);

  test('throws on non-existent remote repository', async () => {
    const env = await createTempEnv('openclaw-apply-remote-notfound-');

    await writeConfig(env.configPath, { identity: { name: 'BaseBot' } });

    await expect(
      applyCommand('nonexistent-owner-xyz-abc/nonexistent-repo-xyz-abc', {
        noBackup: true,
      })
    ).rejects.toThrow(FAILED_TO_CLONE_PATTERN);
  }, 60_000);
});

async function writeUserPresetWithSkills(
  presetsDir: string,
  presetName: string,
  manifest: Record<string, unknown>,
  skillFiles: Record<string, Record<string, string>> = {}
): Promise<void> {
  const presetDir = path.join(presetsDir, presetName);
  await fs.mkdir(presetDir, { recursive: true });
  await fs.writeFile(
    path.join(presetDir, 'preset.json5'),
    JSON5.stringify(manifest, null, 2),
    'utf-8'
  );

  for (const [skillName, files] of Object.entries(skillFiles)) {
    const skillDir = path.join(presetDir, 'skills', skillName);
    await fs.mkdir(skillDir, { recursive: true });
    for (const [filename, content] of Object.entries(files)) {
      await fs.writeFile(path.join(skillDir, filename), content, 'utf-8');
    }
  }
}

describe('skill deployment', () => {
  // Skills install to os.homedir()/.agents/skills/ — Bun compiles native calls so
  // homedir() can't be redirected. We use unique names + afterEach cleanup instead.
  const installedSkillNames: string[] = [];
  const skillsBaseDir = path.join(os.homedir(), '.agents', 'skills');
  let skillCounter = 0;

  function uniqueSkillName(prefix: string): string {
    skillCounter++;
    return `${prefix}-${Date.now()}-${skillCounter}`;
  }

  afterEach(async () => {
    for (const name of installedSkillNames.splice(0)) {
      await fs.rm(path.join(skillsBaseDir, name), {
        recursive: true,
        force: true,
      });
    }
  });

  test('apply copies skills to target directory', async () => {
    const env = await createTempEnv('openclaw-skill-copy-');
    await writeConfig(env.configPath, { identity: { name: 'SkillBot' } });

    const skillName = uniqueSkillName('skill-copy');
    installedSkillNames.push(skillName);

    await writeUserPresetWithSkills(
      env.presetsDir,
      'skill-preset',
      {
        name: 'skill-preset',
        description: 'Skill deployment test',
        version: '1.0.0',
        skills: [skillName],
      },
      { [skillName]: { 'SKILL.md': '# Test Skill\nThis is a test skill.' } }
    );

    const logs = await captureLogs(async () => {
      await applyCommand('skill-preset', { noBackup: true });
    });

    const skillFile = path.join(skillsBaseDir, skillName, 'SKILL.md');
    expect(await fileExists(skillFile)).toBe(true);
    const content = await fs.readFile(skillFile, 'utf-8');
    expect(content).toBe('# Test Skill\nThis is a test skill.');
    expect(logs.join('\n')).toContain(`OK Skills installed: ${skillName}`);
  });

  test('apply shows skills in dry-run output', async () => {
    const env = await createTempEnv('openclaw-skill-dryrun-');
    await writeConfig(env.configPath, { identity: { name: 'DryRunSkillBot' } });

    const skillName = uniqueSkillName('skill-dryrun');
    // No push to installedSkillNames — dry-run won't install

    await writeUserPresetWithSkills(
      env.presetsDir,
      'skill-dryrun-preset',
      {
        name: 'skill-dryrun-preset',
        description: 'Skill dry-run test',
        version: '1.0.0',
        skills: [skillName],
      },
      { [skillName]: { 'SKILL.md': '# Demo Skill' } }
    );

    const logs = await captureLogs(async () => {
      await applyCommand('skill-dryrun-preset', {
        dryRun: true,
        noBackup: true,
      });
    });

    const combined = logs.join('\n');
    expect(combined).toContain('Skills to install');
    expect(combined).toContain('DRY RUN');
    expect(
      await fileExists(path.join(skillsBaseDir, skillName, 'SKILL.md'))
    ).toBe(false);
  });

  test('apply with --force overwrites existing skills', async () => {
    const env = await createTempEnv('openclaw-skill-force-');
    await writeConfig(env.configPath, { identity: { name: 'ForceSkillBot' } });

    const skillName = uniqueSkillName('skill-force');
    installedSkillNames.push(skillName);

    const skillDir = path.join(skillsBaseDir, skillName);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      '# Old Content',
      'utf-8'
    );

    await writeUserPresetWithSkills(
      env.presetsDir,
      'force-skill-preset',
      {
        name: 'force-skill-preset',
        description: 'Force skill overwrite test',
        version: '1.0.0',
        skills: [skillName],
      },
      { [skillName]: { 'SKILL.md': '# New Content' } }
    );

    const logs = await captureLogs(async () => {
      await applyCommand('force-skill-preset', { noBackup: true, force: true });
    });

    const content = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf-8');
    expect(content).toBe('# New Content');
    expect(logs.join('\n')).toContain(`OK Skill '${skillName}' installed.`);
  });

  test('apply skips existing skills without force in non-TTY', async () => {
    const env = await createTempEnv('openclaw-skill-skip-');
    await writeConfig(env.configPath, { identity: { name: 'SkipSkillBot' } });

    const skillName = uniqueSkillName('skill-skip');
    installedSkillNames.push(skillName);

    const skillDir = path.join(skillsBaseDir, skillName);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      '# Original Content',
      'utf-8'
    );

    await writeUserPresetWithSkills(
      env.presetsDir,
      'skip-skill-preset',
      {
        name: 'skip-skill-preset',
        description: 'Skill skip test',
        version: '1.0.0',
        skills: [skillName],
      },
      { [skillName]: { 'SKILL.md': '# Override Content' } }
    );

    const logs = await captureLogs(async () => {
      await applyCommand('skip-skill-preset', { noBackup: true });
    });

    const content = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf-8');
    expect(content).toBe('# Original Content');
    expect(logs.join('\n')).toContain(`Skipped skill '${skillName}'`);
  });

  test('apply without skills field works normally', async () => {
    const env = await createTempEnv('openclaw-skill-none-');
    await writeConfig(env.configPath, { identity: { name: 'NoSkillBot' } });

    await writeUserPreset(env.presetsDir, 'no-skill-preset', {
      name: 'no-skill-preset',
      description: 'No skills preset',
      version: '1.0.0',
      config: {
        identity: { name: 'NoSkillUpdated' },
      },
    });

    const logs = await captureLogs(async () => {
      await applyCommand('no-skill-preset', { noBackup: true });
    });

    const combined = logs.join('\n');
    expect(combined).not.toContain('Skills');

    const config = await readConfig(env.configPath);
    // identity is migrated to agents.list[].identity by migrateLegacyKeys
    const agentsList = (config.agents as Record<string, unknown>)
      ?.list as Record<string, unknown>[];
    expect(agentsList?.[0]?.identity).toEqual({ name: 'NoSkillUpdated' });
  });

  describe('apply edge cases', () => {
    test('--no-backup skips backup creation', async () => {
      const env = await createTempEnv('openclaw-apply-nobackup-');

      await writeConfig(env.configPath, { identity: { name: 'NoBackupBot' } });

      await writeUserPreset(env.presetsDir, 'nobackup-preset', {
        name: 'nobackup-preset',
        description: 'No backup preset',
        version: '1.0.0',
        config: {
          identity: { name: 'Updated' },
        },
      });

      await applyCommand('nobackup-preset', { noBackup: true });

      const backupEntries = await fs.readdir(env.backupsDir);
      const configBackups = backupEntries.filter((entry) =>
        entry.endsWith('.bak')
      );

      expect(configBackups.length).toBe(0);

      // Config should still be updated
      const config = await readConfig(env.configPath);
      const agentsList = (config.agents as Record<string, unknown>)
        ?.list as Record<string, unknown>[];
      expect((agentsList?.[0]?.identity as Record<string, unknown>)?.name).toBe(
        'Updated'
      );
    });

    test('apply to non-existent config creates new file from preset', async () => {
      const env = await createTempEnv('openclaw-apply-newconfig-');

      // Do NOT create config file — it should be created by apply
      expect(await fileExists(env.configPath)).toBe(false);

      await writeUserPreset(env.presetsDir, 'newconfig-preset', {
        name: 'newconfig-preset',
        description: 'New config preset',
        version: '1.0.0',
        config: {
          identity: { name: 'FreshBot' },
          tools: { allow: ['read'] },
        },
      });

      const logs = await captureLogs(async () => {
        await applyCommand('newconfig-preset', { noBackup: true });
      });

      expect(await fileExists(env.configPath)).toBe(true);

      const config = await readConfig(env.configPath);
      const agentsList = (config.agents as Record<string, unknown>)
        ?.list as Record<string, unknown>[];
      expect((agentsList?.[0]?.identity as Record<string, unknown>)?.name).toBe(
        'FreshBot'
      );
      expect(config.tools).toEqual({ allow: ['read'] });

      const combined = logs.join('\n');
      expect(combined).toContain('config file not found');
    });

    test('apply preset not found throws descriptive error', async () => {
      const env = await createTempEnv('openclaw-apply-notfound-');

      await writeConfig(env.configPath, { identity: { name: 'Bot' } });

      await expect(applyCommand('nonexistent-preset-xyz-abc')).rejects.toThrow(
        "Preset 'nonexistent-preset-xyz-abc' not found."
      );
    });

    test('--clean + --no-backup removes config without backup', async () => {
      const env = await createTempEnv('openclaw-apply-clean-nobackup-');

      await writeConfig(env.configPath, {
        identity: { name: 'CleanNoBackup' },
      });

      await writeUserPreset(env.presetsDir, 'clean-nobackup-preset', {
        name: 'clean-nobackup-preset',
        description: 'Clean no backup',
        version: '1.0.0',
        config: {
          identity: { name: 'Fresh' },
        },
      });

      await applyCommand('clean-nobackup-preset', {
        clean: true,
        noBackup: true,
      });

      // No backups should exist
      const backupEntries = await fs.readdir(env.backupsDir);
      expect(backupEntries.length).toBe(0);

      // Config should be freshly created from preset (no merge)
      const config = await readConfig(env.configPath);
      expect(config.untouched).toBeUndefined();
    });
  });
});
