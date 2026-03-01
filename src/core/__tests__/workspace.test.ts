import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { WORKSPACE_FILES } from '../constants';
import {
  copyWorkspaceFiles,
  exportWorkspaceFiles,
  listWorkspaceFiles,
  resolveWorkspaceDir,
} from '../workspace';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(
    path.join(tmpdir(), 'oh-my-openclaw-workspace-test-')
  );
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('resolveWorkspaceDir', () => {
  test('resolves agents.defaults.workspace from config', () => {
    const config = {
      agents: {
        defaults: {
          workspace: '/tmp/custom-ws',
        },
      },
    };
    const result = resolveWorkspaceDir(config, '/home/user/.openclaw');
    expect(result).toBe('/tmp/custom-ws');
  });

  test('falls back to {stateDir}/workspace when not in config', () => {
    const result = resolveWorkspaceDir({}, '/home/user/.openclaw');
    expect(result).toBe('/home/user/.openclaw/workspace');
  });

  test('falls back to {stateDir}/workspace when agents is undefined', () => {
    const config = { models: {} };
    const result = resolveWorkspaceDir(config, '/state/dir');
    expect(result).toBe('/state/dir/workspace');
  });

  test('falls back to {stateDir}/workspace when agents.defaults is undefined', () => {
    const config = { agents: {} };
    const result = resolveWorkspaceDir(config, '/state/dir');
    expect(result).toBe('/state/dir/workspace');
  });

  test('falls back to {stateDir}/workspace when agents.defaults.workspace is undefined', () => {
    const config = { agents: { defaults: {} } };
    const result = resolveWorkspaceDir(config, '/state/dir');
    expect(result).toBe('/state/dir/workspace');
  });
});

describe('listWorkspaceFiles', () => {
  test('lists only existing MD files from WORKSPACE_FILES', async () => {
    // Create some but not all workspace files
    await writeFile(path.join(tempDir, 'AGENTS.md'), 'agents content');
    await writeFile(path.join(tempDir, 'SOUL.md'), 'soul content');
    // Leave other files missing

    const result = await listWorkspaceFiles(tempDir);
    expect(result).toEqual(['AGENTS.md', 'SOUL.md']);
  });

  test('returns empty array when workspace dir has no MD files', async () => {
    const result = await listWorkspaceFiles(tempDir);
    expect(result).toEqual([]);
  });

  test('handles missing workspace dir gracefully (returns empty array, no crash)', async () => {
    const nonExistentDir = path.join(tempDir, 'does-not-exist');
    const result = await listWorkspaceFiles(nonExistentDir);
    expect(result).toEqual([]);
  });

  test('skips files not in WORKSPACE_FILES even if they exist', async () => {
    await writeFile(path.join(tempDir, 'AGENTS.md'), 'agents content');
    await writeFile(path.join(tempDir, 'RANDOM.md'), 'random content');

    const result = await listWorkspaceFiles(tempDir);
    expect(result).toEqual(['AGENTS.md']);
    expect(result).not.toContain('RANDOM.md');
  });

  test('returns all files when all WORKSPACE_FILES exist', async () => {
    for (const filename of WORKSPACE_FILES) {
      await writeFile(path.join(tempDir, filename), `content of ${filename}`);
    }

    const result = await listWorkspaceFiles(tempDir);
    expect(result).toEqual([...WORKSPACE_FILES]);
  });
});

describe('copyWorkspaceFiles', () => {
  test('copies files byte-exact from src to dest', async () => {
    const srcDir = path.join(tempDir, 'src');
    const destDir = path.join(tempDir, 'dest');
    await mkdtemp(`${srcDir}-`);
    // Use mkdtemp pattern but let copyWorkspaceFiles create destDir

    // Create src directory and file manually
    const { mkdir } = await import('node:fs/promises');
    await mkdir(srcDir, { recursive: true });
    const content = 'Hello, World! Binary: \x00\x01\x02\xff';
    await writeFile(path.join(srcDir, 'AGENTS.md'), content);

    await copyWorkspaceFiles(srcDir, destDir, ['AGENTS.md']);

    const copiedContent = await readFile(
      path.join(destDir, 'AGENTS.md'),
      'utf8'
    );
    expect(copiedContent).toBe(content);
  });

  test('creates dest directory if it does not exist', async () => {
    const srcDir = path.join(tempDir, 'src');
    const destDir = path.join(tempDir, 'new', 'nested', 'dest');

    const { mkdir } = await import('node:fs/promises');
    await mkdir(srcDir, { recursive: true });
    await writeFile(path.join(srcDir, 'SOUL.md'), 'soul content');

    await copyWorkspaceFiles(srcDir, destDir, ['SOUL.md']);

    const copiedContent = await readFile(path.join(destDir, 'SOUL.md'), 'utf8');
    expect(copiedContent).toBe('soul content');
  });

  test('copies multiple files', async () => {
    const srcDir = path.join(tempDir, 'src');
    const destDir = path.join(tempDir, 'dest');

    const { mkdir } = await import('node:fs/promises');
    await mkdir(srcDir, { recursive: true });
    await writeFile(path.join(srcDir, 'AGENTS.md'), 'agents');
    await writeFile(path.join(srcDir, 'SOUL.md'), 'soul');
    await writeFile(path.join(srcDir, 'IDENTITY.md'), 'identity');

    await copyWorkspaceFiles(srcDir, destDir, [
      'AGENTS.md',
      'SOUL.md',
      'IDENTITY.md',
    ]);

    expect(await readFile(path.join(destDir, 'AGENTS.md'), 'utf8')).toBe(
      'agents'
    );
    expect(await readFile(path.join(destDir, 'SOUL.md'), 'utf8')).toBe('soul');
    expect(await readFile(path.join(destDir, 'IDENTITY.md'), 'utf8')).toBe(
      'identity'
    );
  });
});

describe('exportWorkspaceFiles', () => {
  test('copies existing MD files into preset directory and returns their names', async () => {
    const workspaceDir = path.join(tempDir, 'workspace');
    const presetDir = path.join(tempDir, 'preset');

    const { mkdir } = await import('node:fs/promises');
    await mkdir(workspaceDir, { recursive: true });
    await writeFile(path.join(workspaceDir, 'AGENTS.md'), 'agents content');
    await writeFile(path.join(workspaceDir, 'SOUL.md'), 'soul content');

    const result = await exportWorkspaceFiles(workspaceDir, presetDir);

    expect(result).toEqual(['AGENTS.md', 'SOUL.md']);
    expect(await readFile(path.join(presetDir, 'AGENTS.md'), 'utf8')).toBe(
      'agents content'
    );
    expect(await readFile(path.join(presetDir, 'SOUL.md'), 'utf8')).toBe(
      'soul content'
    );
  });

  test('returns empty array when no workspace files exist', async () => {
    const workspaceDir = path.join(tempDir, 'workspace');
    const presetDir = path.join(tempDir, 'preset');

    const { mkdir } = await import('node:fs/promises');
    await mkdir(workspaceDir, { recursive: true });

    const result = await exportWorkspaceFiles(workspaceDir, presetDir);
    expect(result).toEqual([]);
  });

  test('handles missing workspace dir gracefully (returns empty array, no crash)', async () => {
    const workspaceDir = path.join(tempDir, 'nonexistent-workspace');
    const presetDir = path.join(tempDir, 'preset');

    const result = await exportWorkspaceFiles(workspaceDir, presetDir);
    expect(result).toEqual([]);
  });

  test('does not create presetDir when no files to copy', async () => {
    const workspaceDir = path.join(tempDir, 'workspace');
    const presetDir = path.join(tempDir, 'preset-should-not-exist');

    const { mkdir, access } = await import('node:fs/promises');
    await mkdir(workspaceDir, { recursive: true });

    await exportWorkspaceFiles(workspaceDir, presetDir);

    // presetDir should not have been created since there were no files
    await expect(access(presetDir)).rejects.toThrow();
  });
});
