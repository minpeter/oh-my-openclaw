import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'bun:test';

import { OH_MY_OPENCLAW_DIR } from '../constants';
import { resolveOpenClawPaths } from '../config-path';

const originalEnv = { ...process.env };
const tempDirs: string[] = [];

afterEach(() => {
  process.env = { ...originalEnv };

  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveOpenClawPaths', () => {
  test('defaults to $HOME/.openclaw/openclaw.json', async () => {
    delete process.env.OPENCLAW_CONFIG_PATH;
    delete process.env.OPENCLAW_STATE_DIR;

    const resolved = await resolveOpenClawPaths();

    expect(resolved.configPath).toBe(path.join(os.homedir(), '.openclaw', 'openclaw.json'));
    expect(resolved.stateDir).toBe(path.join(os.homedir(), '.openclaw'));
  });

  test('uses OPENCLAW_CONFIG_PATH when set', async () => {
    process.env.OPENCLAW_CONFIG_PATH = '/tmp/custom.json';
    delete process.env.OPENCLAW_STATE_DIR;

    const resolved = await resolveOpenClawPaths();

    expect(resolved.configPath).toBe('/tmp/custom.json');
    expect(resolved.stateDir).toBe('/tmp');
  });

  test('uses OPENCLAW_STATE_DIR/openclaw.json when set', async () => {
    process.env.OPENCLAW_STATE_DIR = '/tmp/state';
    delete process.env.OPENCLAW_CONFIG_PATH;

    const resolved = await resolveOpenClawPaths();

    expect(resolved.stateDir).toBe('/tmp/state');
    expect(resolved.configPath).toBe('/tmp/state/openclaw.json');
  });

  test('resolves presetsDir under stateDir/oh-my-openclaw/presets', async () => {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-state-'));
    tempDirs.push(stateDir);
    process.env.OPENCLAW_STATE_DIR = stateDir;
    delete process.env.OPENCLAW_CONFIG_PATH;

    const resolved = await resolveOpenClawPaths();

    expect(resolved.presetsDir).toBe(path.join(stateDir, OH_MY_OPENCLAW_DIR, 'presets'));
    expect(resolved.backupsDir).toBe(path.join(stateDir, OH_MY_OPENCLAW_DIR, 'backups'));
    expect(resolved.workspaceDir).toBe(path.join(stateDir, 'workspace'));
    expect(fs.existsSync(resolved.presetsDir)).toBe(true);
    expect(fs.existsSync(resolved.backupsDir)).toBe(true);
  });
});
