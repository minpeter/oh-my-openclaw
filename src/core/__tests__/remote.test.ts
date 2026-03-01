import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { cloneToCache, isGitHubRef, parseGitHubRef } from '../remote';

const tempDirs: string[] = [];
const INVALID_GITHUB_REFERENCE_PATTERN = /Invalid GitHub reference/;
const INVALID_GITHUB_OWNER_REPO_PATTERN = /Invalid GitHub owner\/repo/;
const FAILED_TO_CLONE_PATTERN = /Failed to clone/;
const FAILED_TO_CLONE_DETAILS_PATTERN = /Details:/;
const FAILED_TO_CLONE_GIT_FATAL_PATTERN = /fatal:/i;

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    })
  );
});

async function makeTempPresetsDir(): Promise<string> {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), 'remote-test-'));
  tempDirs.push(d);
  const presetsDir = path.join(d, 'presets');
  await fs.mkdir(presetsDir, { recursive: true });
  return presetsDir;
}

describe('isGitHubRef', () => {
  test('returns true for owner/repo shorthand', () => {
    expect(isGitHubRef('minpeter/demo-researcher')).toBe(true);
  });

  test('returns true for full GitHub URL', () => {
    expect(isGitHubRef('https://github.com/minpeter/demo-researcher')).toBe(
      true
    );
  });

  test('returns true for URL with .git suffix', () => {
    expect(isGitHubRef('https://github.com/minpeter/demo-researcher.git')).toBe(
      true
    );
  });

  test('returns false for local preset name', () => {
    expect(isGitHubRef('apex')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isGitHubRef('')).toBe(false);
  });

  test('returns false for path traversal', () => {
    expect(isGitHubRef('../malicious')).toBe(false);
  });

  test('returns false for path with multiple segments (not owner/repo format)', () => {
    expect(isGitHubRef('a/b/c')).toBe(false);
  });
});

describe('parseGitHubRef', () => {
  test('parses owner/repo shorthand', () => {
    expect(parseGitHubRef('minpeter/demo-researcher')).toEqual({
      owner: 'minpeter',
      repo: 'demo-researcher',
    });
  });

  test('parses full GitHub URL', () => {
    expect(
      parseGitHubRef('https://github.com/minpeter/demo-researcher')
    ).toEqual({
      owner: 'minpeter',
      repo: 'demo-researcher',
    });
  });

  test('strips .git suffix from repo', () => {
    expect(
      parseGitHubRef('https://github.com/minpeter/demo-researcher.git')
    ).toEqual({
      owner: 'minpeter',
      repo: 'demo-researcher',
    });
  });

  test('strips trailing slash', () => {
    expect(
      parseGitHubRef('https://github.com/minpeter/demo-researcher/')
    ).toEqual({
      owner: 'minpeter',
      repo: 'demo-researcher',
    });
  });

  test('throws on path traversal in owner position', () => {
    expect(() => parseGitHubRef('../etc/passwd')).toThrow();
  });

  test('throws on path traversal in repo position', () => {
    expect(() => parseGitHubRef('owner/../../etc')).toThrow();
  });

  test('throws on invalid characters (spaces)', () => {
    expect(() => parseGitHubRef('owner/repo with spaces')).toThrow();
  });

  test('throws with correct error message format', () => {
    expect(() => parseGitHubRef('../bad')).toThrow(
      INVALID_GITHUB_REFERENCE_PATTERN
    );
  });
});

describe('cloneToCache', () => {
  test('throws on invalid owner characters', async () => {
    const presetsDir = await makeTempPresetsDir();
    await expect(
      cloneToCache('minpeter!', 'demo-researcher', presetsDir)
    ).rejects.toThrow(INVALID_GITHUB_OWNER_REPO_PATTERN);
  });

  test('throws on invalid repo characters', async () => {
    const presetsDir = await makeTempPresetsDir();
    await expect(
      cloneToCache('minpeter', 'demo-researcher;rm', presetsDir)
    ).rejects.toThrow(INVALID_GITHUB_OWNER_REPO_PATTERN);
  });

  test('clones real repo to cache directory', async () => {
    const presetsDir = await makeTempPresetsDir();
    const cachePath = await cloneToCache(
      'minpeter',
      'demo-researcher',
      presetsDir
    );

    expect(cachePath).toBe(path.join(presetsDir, 'minpeter--demo-researcher'));

    const files = await fs.readdir(cachePath);
    expect(files).toContain('preset.json5');
    expect(files).not.toContain('.git');
  }, 60_000);

  test('reuses cached preset on second call', async () => {
    const presetsDir = await makeTempPresetsDir();

    // First call - clones
    const firstPath = await cloneToCache(
      'minpeter',
      'demo-researcher',
      presetsDir
    );

    // Second call - should reuse cache
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };
    try {
      const secondPath = await cloneToCache(
        'minpeter',
        'demo-researcher',
        presetsDir
      );
      expect(secondPath).toBe(firstPath);
      expect(logs.some((l) => l.includes('cached'))).toBe(true);
    } finally {
      console.log = originalLog;
    }
  }, 60_000);

  test('force re-downloads even if cached', async () => {
    const presetsDir = await makeTempPresetsDir();

    // First call - clones
    await cloneToCache('minpeter', 'demo-researcher', presetsDir);

    // Force re-download
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    };
    try {
      await cloneToCache('minpeter', 'demo-researcher', presetsDir, {
        force: true,
      });
      expect(logs.some((l) => l.includes('cached'))).toBe(false); // no "cached" message
    } finally {
      console.log = originalLog;
    }

    const cachePath = path.join(presetsDir, 'minpeter--demo-researcher');
    const files = await fs.readdir(cachePath);
    expect(files).toContain('preset.json5');
  }, 60_000);

  test('throws on non-existent repository', async () => {
    const presetsDir = await makeTempPresetsDir();
    const clonePromise = cloneToCache(
      'nonexistent-owner-xyz-abc',
      'nonexistent-repo-xyz-abc',
      presetsDir
    );
    await expect(clonePromise).rejects.toThrow(FAILED_TO_CLONE_PATTERN);
    await expect(clonePromise).rejects.toThrow(FAILED_TO_CLONE_DETAILS_PATTERN);
    await expect(clonePromise).rejects.toThrow(
      FAILED_TO_CLONE_GIT_FATAL_PATTERN
    );
  }, 60_000);
});
