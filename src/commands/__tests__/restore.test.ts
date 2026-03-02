import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { restoreCommand } from '../restore';

describe('restoreCommand', () => {
  let output: string[] = [];
  let errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  let tempStateDir: string;

  beforeEach(async () => {
    output = [];
    errors = [];
    console.log = (...args: unknown[]) => {
      const stripped = stripVTControlCharacters(args.map(String).join(' '));
      output.push(stripped);
    };
    console.error = (...args: unknown[]) => {
      const stripped = stripVTControlCharacters(args.map(String).join(' '));
      errors.push(stripped);
    };

    tempStateDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'openclaw-restore-test-')
    );
    process.env.OPENCLAW_STATE_DIR = tempStateDir;
    Reflect.deleteProperty(process.env, 'OPENCLAW_CONFIG_PATH');
  });

  afterEach(async () => {
    console.log = originalLog;
    console.error = originalError;

    Reflect.deleteProperty(process.env, 'OPENCLAW_STATE_DIR');
    Reflect.deleteProperty(process.env, 'OPENCLAW_CONFIG_PATH');

    if (tempStateDir) {
      await fs.rm(tempStateDir, { recursive: true, force: true });
    }
  });

  describe('--list', () => {
    test('shows "No backups found" when no backups exist', async () => {
      await restoreCommand({ list: true });

      const combined = output.join('\n');
      expect(combined).toContain('No backups found');
    });

    test('lists available backups sorted newest first', async () => {
      const backupsDir = path.join(tempStateDir, 'apex', 'backups');
      await fs.mkdir(backupsDir, { recursive: true });

      await fs.writeFile(
        path.join(backupsDir, 'openclaw.json.2025-01-01T00-00-00-000Z.bak'),
        '{"old":true}'
      );
      await fs.writeFile(
        path.join(backupsDir, 'openclaw.json.2025-12-31T23-59-59-999Z.bak'),
        '{"new":true}'
      );

      await restoreCommand({ list: true });

      const combined = output.join('\n');
      expect(combined).toContain('Available backups:');
      expect(combined).toContain('openclaw.json.2025-12-31T23-59-59-999Z.bak');
      expect(combined).toContain('openclaw.json.2025-01-01T00-00-00-000Z.bak');
      expect(combined).toContain('2 backup(s) found');

      // Newest should appear before oldest
      const newestIdx = combined.indexOf(
        'openclaw.json.2025-12-31T23-59-59-999Z.bak'
      );
      const oldestIdx = combined.indexOf(
        'openclaw.json.2025-01-01T00-00-00-000Z.bak'
      );
      expect(newestIdx).toBeLessThan(oldestIdx);
    });
  });

  describe('default (restore latest)', () => {
    test('restores the most recent backup', async () => {
      const backupsDir = path.join(tempStateDir, 'apex', 'backups');
      await fs.mkdir(backupsDir, { recursive: true });

      const configPath = path.join(tempStateDir, 'openclaw.json');
      await fs.writeFile(configPath, '{"current":true}');

      await fs.writeFile(
        path.join(backupsDir, 'openclaw.json.2025-01-01T00-00-00-000Z.bak'),
        '{"old":true}'
      );
      await fs.writeFile(
        path.join(backupsDir, 'openclaw.json.2025-12-31T23-59-59-999Z.bak'),
        '{"newest":true}'
      );

      await restoreCommand();

      const restored = await fs.readFile(configPath, 'utf-8');
      expect(restored).toBe('{"newest":true}');

      const combined = output.join('\n');
      expect(combined).toContain('Restored from:');
      expect(combined).toContain('openclaw.json.2025-12-31T23-59-59-999Z.bak');
      expect(combined).toContain('openclaw gateway restart');
    });

    test('throws when no backups available', async () => {
      await expect(restoreCommand()).rejects.toThrow('No backups available');
    });
  });

  describe('--backup <name>', () => {
    test('restores a specific backup by filename', async () => {
      const backupsDir = path.join(tempStateDir, 'apex', 'backups');
      await fs.mkdir(backupsDir, { recursive: true });

      const configPath = path.join(tempStateDir, 'openclaw.json');
      await fs.writeFile(configPath, '{"current":true}');

      const targetName = 'openclaw.json.2025-06-15T12-00-00-000Z.bak';
      await fs.writeFile(
        path.join(backupsDir, targetName),
        '{"specific":true}'
      );
      await fs.writeFile(
        path.join(backupsDir, 'openclaw.json.2025-12-31T23-59-59-999Z.bak'),
        '{"newest":true}'
      );

      await restoreCommand({ backup: targetName });

      const restored = await fs.readFile(configPath, 'utf-8');
      expect(restored).toBe('{"specific":true}');

      const combined = output.join('\n');
      expect(combined).toContain(`Restored from: ${targetName}`);
      expect(combined).toContain('openclaw gateway restart');
    });

    test('throws when specified backup not found', async () => {
      await expect(
        restoreCommand({ backup: 'nonexistent.bak' })
      ).rejects.toThrow("Backup 'nonexistent.bak' not found");
    });
  });
});
