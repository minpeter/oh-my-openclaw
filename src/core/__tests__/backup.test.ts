import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createBackup, listBackups } from '../backup';

const tempDirs: string[] = [];

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
    expect(path.basename(backupPath)).toMatch(/^openclaw\.json\..+\.bak$/);
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
});
