import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import JSON5 from 'json5';

import { applyCommand } from '../commands/apply';
import { diffCommand } from '../commands/diff';
import { exportCommand } from '../commands/export';
import { listCommand } from '../commands/list';
import { listBackups } from '../core/backup';
import { resolveOpenClawPaths } from '../core/config-path';
import { setOpenClawCommandExecutorForTests } from '../core/openclaw-plugin';
import { loadPreset } from '../core/preset-loader';

interface DiffJsonOutput {
  changes: { path: string; type: string }[];
  preset: string;
  workspaceFiles: { toAdd: string[]; toReplace: string[] };
}

describe('integration workflow and edge cases', () => {
  let tempDir: string;
  let configPath: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    setOpenClawCommandExecutorForTests(async () => ({
      exitCode: 0,
      stderr: '',
      stdout: '',
    }));

    tempDir = await mkdtemp(join(tmpdir(), 'openclaw-integration-'));
    const stateDir = join(tempDir, '.openclaw');
    await mkdir(stateDir, { recursive: true });

    configPath = join(stateDir, 'openclaw.json');
    process.env.OPENCLAW_CONFIG_PATH = configPath;
    Reflect.deleteProperty(process.env, 'OPENCLAW_STATE_DIR');
  });

  afterEach(async () => {
    setOpenClawCommandExecutorForTests();
    process.env = { ...originalEnv };
    await rm(tempDir, { recursive: true, force: true });
  });

  async function writeJson5File(
    filePath: string,
    value: Record<string, unknown>
  ): Promise<void> {
    await writeFile(filePath, JSON5.stringify(value, null, 2), 'utf-8');
  }

  async function readJson5File(
    filePath: string
  ): Promise<Record<string, unknown>> {
    const content = await readFile(filePath, 'utf-8');
    return JSON5.parse(content) as Record<string, unknown>;
  }

  async function captureLogs(run: () => Promise<void>): Promise<string> {
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

    return logs.join('\n');
  }

  test('full workflow: export -> list -> diff -> apply -> diff (no diff)', async () => {
    await writeJson5File(configPath, { identity: { name: 'CycleBot' } });

    await exportCommand('cycle-preset', {
      description: 'Cycle integration test preset',
    });

    const listedRaw = await captureLogs(async () => {
      await listCommand({ json: true });
    });
    const listed = JSON.parse(listedRaw) as { name: string }[];
    expect(listed.some((preset) => preset.name === 'cycle-preset')).toBe(true);

    await writeJson5File(configPath, { identity: { name: 'ChangedBot' } });

    const beforeApplyRaw = await captureLogs(async () => {
      await diffCommand('cycle-preset', { json: true });
    });
    const beforeApply = JSON.parse(beforeApplyRaw) as DiffJsonOutput;
    expect(beforeApply.changes.length).toBeGreaterThan(0);

    await applyCommand('cycle-preset', { noBackup: true });

    const afterApplyRaw = await captureLogs(async () => {
      await diffCommand('cycle-preset', { json: true });
    });
    const afterApply = JSON.parse(afterApplyRaw) as DiffJsonOutput;
    expect(afterApply.changes).toHaveLength(0);
    expect(afterApply.workspaceFiles.toAdd).toHaveLength(0);
    expect(afterApply.workspaceFiles.toReplace).toHaveLength(0);
  });

  test('apply to nonexistent config creates new file', async () => {
    await applyCommand('apex', { noBackup: true });

    const createdConfig = await readJson5File(configPath);
    const agents = createdConfig.agents as Record<string, unknown>;
    const list = agents.list as Record<string, unknown>[];
    const identity = list[0].identity as Record<string, unknown>;
    const defaults = agents.defaults as Record<string, unknown>;
    expect(identity.name).toBe('Apex');
    expect(createdConfig).not.toHaveProperty('routing');
    expect(defaults).not.toHaveProperty('tools');
    expect(createdConfig).toHaveProperty(
      'tools.message.crossContext.allowAcrossProviders',
      true
    );
  });

  test('apply apex removes legacy unsupported routing and defaults.tools keys', async () => {
    await writeJson5File(configPath, {
      agents: {
        defaults: {
          tools: {
            message: {
              crossContext: {
                allowAcrossProviders: true,
              },
            },
          },
        },
      },
      routing: {
        defaultModel: 'anthropic/claude-sonnet-4-6',
      },
    });

    await applyCommand('apex', { noBackup: true });

    const updatedConfig = await readJson5File(configPath);
    expect(updatedConfig).not.toHaveProperty('routing');
    expect(updatedConfig).not.toHaveProperty('agents.defaults.tools');
    expect(updatedConfig).toHaveProperty(
      'tools.message.crossContext.allowAcrossProviders',
      true
    );
  });

  test('export from empty workspace stores empty workspaceFiles list', async () => {
    await writeJson5File(configPath, {
      identity: { name: 'EmptyWorkspaceBot' },
    });

    await exportCommand('empty-workspace-preset');

    const paths = await resolveOpenClawPaths();
    const preset = await loadPreset(
      join(paths.presetsDir, 'empty-workspace-preset')
    );
    expect(preset.workspaceFiles).toEqual([]);
  });

  test('apply preset with only MD files leaves config unchanged', async () => {
    const initialConfig = {
      identity: { name: 'OriginalBot' },
      tools: { allow: ['read'] },
    };
    await writeJson5File(configPath, initialConfig);

    const paths = await resolveOpenClawPaths();
    const presetDir = join(paths.presetsDir, 'md-only-preset');
    await mkdir(presetDir, { recursive: true });
    await writeJson5File(join(presetDir, 'preset.json5'), {
      name: 'md-only-preset',
      description: 'Preset with only workspace files',
      version: '1.0.0',
      workspaceFiles: ['AGENTS.md'],
    });
    await writeFile(
      join(presetDir, 'AGENTS.md'),
      '# MD-only\nWorkspace file only',
      'utf-8'
    );

    await applyCommand('md-only-preset', { noBackup: true });

    const afterConfig = await readJson5File(configPath);
    expect(afterConfig).toEqual(initialConfig);

    const copiedAgents = await readFile(
      join(paths.workspaceDir, 'AGENTS.md'),
      'utf-8'
    );
    expect(copiedAgents).toBe('# MD-only\nWorkspace file only');
  });

  test('apply preset with only config updates config without workspace writes', async () => {
    await writeJson5File(configPath, {
      identity: { name: 'OriginalBot' },
      tools: { allow: ['read'] },
    });

    const paths = await resolveOpenClawPaths();
    const presetDir = join(paths.presetsDir, 'config-only-preset');
    await mkdir(presetDir, { recursive: true });
    await writeJson5File(join(presetDir, 'preset.json5'), {
      name: 'config-only-preset',
      description: 'Preset with only config',
      version: '1.0.0',
      config: {
        identity: { name: 'ConfigOnlyBot' },
      },
    });

    await applyCommand('config-only-preset', { noBackup: true });

    const updatedConfig = await readJson5File(configPath);
    const agents = updatedConfig.agents as Record<string, unknown>;
    const list = agents.list as Record<string, unknown>[];
    const identity = list[0].identity as Record<string, unknown>;
    expect(identity.name).toBe('ConfigOnlyBot');

    await expect(
      readFile(join(paths.workspaceDir, 'AGENTS.md'), 'utf-8')
    ).rejects.toThrow();
  });

  test('invalid JSON5 config produces a clear export error', async () => {
    await writeFile(configPath, '{ invalid json5 !!!', 'utf-8');

    await expect(exportCommand('invalid-json5-export')).rejects.toThrow(
      `Invalid JSON5 in ${configPath}:`
    );
  });

  test('empty preset directory fails with clear error', async () => {
    const paths = await resolveOpenClawPaths();
    await mkdir(join(paths.presetsDir, 'empty-preset-dir'), {
      recursive: true,
    });

    await expect(applyCommand('empty-preset-dir')).rejects.toThrow(
      "Preset 'empty-preset-dir' not found"
    );
  });

  test('multiple applies in sequence each create a backup', async () => {
    await writeJson5File(configPath, { identity: { name: 'BackupBot' } });

    await applyCommand('apex');
    await sleep(5);
    await applyCommand('apex');

    const paths = await resolveOpenClawPaths();
    const backups = await listBackups(paths.backupsDir);
    expect(backups.length).toBeGreaterThanOrEqual(2);
  });
});
