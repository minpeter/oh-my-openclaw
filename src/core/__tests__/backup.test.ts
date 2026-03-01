import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  createBackup,
  createWorkspaceBackup,
  listBackups,
  restoreBackup,
} from '../backup';

const tempDirs: string[] = [];
const BACKUP_FILE_NAME_PATTERN = /^openclaw\.json\..+\.bak$/;
const WORKSPACE_BACKUP_DIR_PATTERN = /^workspace\./;

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    })
  );
});

describe('backup manager', () => {
  test('creates timestamped backup file', async () => {
    const tempDir = await createTempDir('backup-test-');
    const configPath = path.join(tempDir, 'openclaw.json');
    const backupsDir = path.join(tempDir, 'backups');

    await writeFile(configPath, '{"name":"test"}');

    const backupPath = await createBackup(configPath, backupsDir);

    expect(backupPath.startsWith(backupsDir)).toBe(true);
    expect(path.basename(backupPath)).toMatch(BACKUP_FILE_NAME_PATTERN);
  });

  test('backup content matches original byte-for-byte', async () => {
    const tempDir = await createTempDir('backup-bytes-');
    const configPath = path.join(tempDir, 'openclaw.json');
    const backupsDir = path.join(tempDir, 'backups');
    const sourceBytes = Buffer.from([0, 255, 1, 2, 16, 32, 64, 128]);

    await writeFile(configPath, sourceBytes);

    const backupPath = await createBackup(configPath, backupsDir);
    const backupBytes = await readFile(backupPath);

    expect(backupBytes.equals(sourceBytes)).toBe(true);
  });

  test('auto-creates backupsDir when missing', async () => {
    const tempDir = await createTempDir('backup-mkdir-');
    const configPath = path.join(tempDir, 'openclaw.json');
    const backupsDir = path.join(tempDir, 'nested', 'backups');

    await writeFile(configPath, '{"auto":true}');

    const backupPath = await createBackup(configPath, backupsDir);
    const backupContent = await readFile(backupPath, 'utf-8');

    expect(backupPath.startsWith(backupsDir)).toBe(true);
    expect(backupContent).toBe('{"auto":true}');
  });

  test('listBackups returns sorted backups (newest first)', async () => {
    const tempDir = await createTempDir('backup-list-');

    const oldest = path.join(
      tempDir,
      'openclaw.json.2025-01-01T00-00-00-000Z.bak'
    );
    const middle = path.join(
      tempDir,
      'openclaw.json.2025-06-01T00-00-00-000Z.bak'
    );
    const newest = path.join(
      tempDir,
      'openclaw.json.2025-12-31T23-59-59-999Z.bak'
    );
    const nonBackup = path.join(tempDir, 'openclaw.json');

    await writeFile(oldest, '1');
    await writeFile(middle, '2');
    await writeFile(newest, '3');
    await writeFile(nonBackup, 'ignored');

    const backups = await listBackups(tempDir);

    expect(backups).toEqual([newest, middle, oldest]);
  });

  describe('restoreBackup', () => {
    test('restores backup content to config path', async () => {
      const tempDir = await createTempDir('restore-test-');
      const configPath = path.join(tempDir, 'openclaw.json');
      const backupsDir = path.join(tempDir, 'backups');

      await writeFile(configPath, '{"original":true}');
      const backupPath = await createBackup(configPath, backupsDir);

      // Overwrite the config with something else
      await writeFile(configPath, '{"modified":true}');

      await restoreBackup(backupPath, configPath);

      const restored = await readFile(configPath, 'utf-8');
      expect(restored).toBe('{"original":true}');
    });

    test('creates config file if it was deleted before restore', async () => {
      const tempDir = await createTempDir('restore-deleted-');
      const configPath = path.join(tempDir, 'openclaw.json');
      const backupsDir = path.join(tempDir, 'backups');

      await writeFile(configPath, '{"backup-data":true}');
      const backupPath = await createBackup(configPath, backupsDir);

      await rm(configPath);

      await restoreBackup(backupPath, configPath);

      const restored = await readFile(configPath, 'utf-8');
      expect(restored).toBe('{"backup-data":true}');
    });
  });

  describe('createWorkspaceBackup', () => {
    test('copies workspace files to timestamped backup subdirectory', async () => {
      const tempDir = await createTempDir('ws-backup-');
      const workspaceDir = path.join(tempDir, 'workspace');
      const backupsDir = path.join(tempDir, 'backups');

      const { mkdir } = await import('node:fs/promises');
      await mkdir(workspaceDir, { recursive: true });
      await writeFile(path.join(workspaceDir, 'AGENTS.md'), '# Agents');
      await writeFile(path.join(workspaceDir, 'SOUL.md'), '# Soul');

      const backupSubDir = await createWorkspaceBackup(
        workspaceDir,
        backupsDir,
        ['AGENTS.md', 'SOUL.md']
      );

      expect(backupSubDir.startsWith(backupsDir)).toBe(true);
      expect(path.basename(backupSubDir)).toMatch(WORKSPACE_BACKUP_DIR_PATTERN);

      const agentsContent = await readFile(
        path.join(backupSubDir, 'AGENTS.md'),
        'utf-8'
      );
      const soulContent = await readFile(
        path.join(backupSubDir, 'SOUL.md'),
        'utf-8'
      );

      expect(agentsContent).toBe('# Agents');
      expect(soulContent).toBe('# Soul');
    });

    test('silently skips missing source files (ENOENT)', async () => {
      const tempDir = await createTempDir('ws-backup-missing-');
      const workspaceDir = path.join(tempDir, 'workspace');
      const backupsDir = path.join(tempDir, 'backups');

      const { mkdir } = await import('node:fs/promises');
      await mkdir(workspaceDir, { recursive: true });
      await writeFile(path.join(workspaceDir, 'AGENTS.md'), '# Agents');

      // Request backup of AGENTS.md (exists) and SOUL.md (missing)
      const backupSubDir = await createWorkspaceBackup(
        workspaceDir,
        backupsDir,
        ['AGENTS.md', 'SOUL.md']
      );

      const agentsContent = await readFile(
        path.join(backupSubDir, 'AGENTS.md'),
        'utf-8'
      );
      expect(agentsContent).toBe('# Agents');

      // SOUL.md should not exist in backup (source was missing)
      let soulExists = false;
      try {
        const { access } = await import('node:fs/promises');
        await access(path.join(backupSubDir, 'SOUL.md'));
        soulExists = true;
      } catch {
        // expected
      }
      expect(soulExists).toBe(false);
    });

    test('auto-creates backups directory', async () => {
      const tempDir = await createTempDir('ws-backup-mkdir-');
      const workspaceDir = path.join(tempDir, 'workspace');
      const backupsDir = path.join(tempDir, 'nested', 'deep', 'backups');

      const { mkdir } = await import('node:fs/promises');
      await mkdir(workspaceDir, { recursive: true });
      await writeFile(path.join(workspaceDir, 'AGENTS.md'), '# Agents');

      const backupSubDir = await createWorkspaceBackup(
        workspaceDir,
        backupsDir,
        ['AGENTS.md']
      );

      expect(backupSubDir.startsWith(backupsDir)).toBe(true);
      const content = await readFile(
        path.join(backupSubDir, 'AGENTS.md'),
        'utf-8'
      );
      expect(content).toBe('# Agents');
    });
  });

  describe('listBackups edge cases', () => {
    test('returns empty array for non-existent directory', async () => {
      const tempDir = await createTempDir('backup-nonexist-');
      const nonExistentDir = path.join(tempDir, 'does-not-exist');

      const backups = await listBackups(nonExistentDir);

      expect(backups).toEqual([]);
    });

    test('returns empty array when directory has no .bak files', async () => {
      const tempDir = await createTempDir('backup-nobak-');

      await writeFile(path.join(tempDir, 'readme.txt'), 'not a backup');
      await writeFile(path.join(tempDir, 'config.json'), '{}');

      const backups = await listBackups(tempDir);

      expect(backups).toEqual([]);
    });
  });
});
