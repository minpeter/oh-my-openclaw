import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import { copySkills, promptOverwrite } from '../skills';

const tempDirs: string[] = [];

async function createTempPreset(skillName: string, files: Record<string, string>): Promise<string> {
  const presetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-preset-'));
  tempDirs.push(presetDir);
  const skillDir = path.join(presetDir, 'skills', skillName);
  await fs.mkdir(skillDir, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(skillDir, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }
  return presetDir;
}

async function createTempTarget(): Promise<string> {
  const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-target-'));
  tempDirs.push(targetDir);
  return targetDir;
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
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

describe('promptOverwrite', () => {
  test('returns false in non-TTY environment', async () => {
    // bun test runs with stdin not a TTY, so promptOverwrite must immediately return false
    const result = await promptOverwrite('test-skill');
    expect(result).toBe(false);
  });
});

describe('copySkills', () => {
  test('copies skill directory to target', async () => {
    const presetDir = await createTempPreset('test-skill', { 'SKILL.md': '# Test Skill' });
    const targetBaseDir = await createTempTarget();

    await copySkills(presetDir, ['test-skill'], { force: true, targetBaseDir });

    const destFile = path.join(targetBaseDir, 'test-skill', 'SKILL.md');
    const content = await fs.readFile(destFile, 'utf-8');
    expect(content).toBe('# Test Skill');
  });

  test('copies skill with subdirectories recursively', async () => {
    const presetDir = await createTempPreset('my-skill', {
      'SKILL.md': '# My Skill',
      'scripts/run.sh': '#!/bin/bash\necho hello',
    });
    const targetBaseDir = await createTempTarget();

    await copySkills(presetDir, ['my-skill'], { force: true, targetBaseDir });

    const scriptFile = path.join(targetBaseDir, 'my-skill', 'scripts', 'run.sh');
    const content = await fs.readFile(scriptFile, 'utf-8');
    expect(content).toBe('#!/bin/bash\necho hello');
  });

  test('creates target parent directory if missing', async () => {
    const presetDir = await createTempPreset('new-skill', { 'SKILL.md': '# New Skill' });
    const baseDir = await createTempTarget();
    const targetBaseDir = path.join(baseDir, 'does-not-exist', 'yet');

    await copySkills(presetDir, ['new-skill'], { force: true, targetBaseDir });

    const destFile = path.join(targetBaseDir, 'new-skill', 'SKILL.md');
    const content = await fs.readFile(destFile, 'utf-8');
    expect(content).toBe('# New Skill');
  });

  test('overwrites existing skill when force is true', async () => {
    const presetDir = await createTempPreset('update-skill', { 'SKILL.md': '# New Content' });
    const targetBaseDir = await createTempTarget();

    // Pre-create old content
    const oldSkillDir = path.join(targetBaseDir, 'update-skill');
    await fs.mkdir(oldSkillDir, { recursive: true });
    await fs.writeFile(path.join(oldSkillDir, 'SKILL.md'), '# Old Content', 'utf-8');

    await copySkills(presetDir, ['update-skill'], { force: true, targetBaseDir });

    const content = await fs.readFile(path.join(oldSkillDir, 'SKILL.md'), 'utf-8');
    expect(content).toBe('# New Content');
  });

  test('skips existing skill in non-TTY without force', async () => {
    const presetDir = await createTempPreset('existing-skill', { 'SKILL.md': '# New Content' });
    const targetBaseDir = await createTempTarget();

    // Pre-create old content
    const oldSkillDir = path.join(targetBaseDir, 'existing-skill');
    await fs.mkdir(oldSkillDir, { recursive: true });
    await fs.writeFile(path.join(oldSkillDir, 'SKILL.md'), '# Old Content', 'utf-8');

    const logs = await captureLogs(async () => {
      await copySkills(presetDir, ['existing-skill'], { targetBaseDir });
    });

    // Original content should be unchanged
    const content = await fs.readFile(path.join(oldSkillDir, 'SKILL.md'), 'utf-8');
    expect(content).toBe('# Old Content');
    expect(logs.some((l) => l.includes('Skipped'))).toBe(true);
  });

  test('does not copy in dry-run mode', async () => {
    const presetDir = await createTempPreset('dry-skill', { 'SKILL.md': '# Dry Run Skill' });
    const targetBaseDir = await createTempTarget();

    const logs = await captureLogs(async () => {
      await copySkills(presetDir, ['dry-skill'], { dryRun: true, targetBaseDir });
    });

    // File must not exist at target
    const destFile = path.join(targetBaseDir, 'dry-skill', 'SKILL.md');
    let exists = false;
    try {
      await fs.access(destFile);
      exists = true;
    } catch {}

    expect(exists).toBe(false);
    expect(logs.some((l) => l.includes('Would install skill'))).toBe(true);
  });

  test('throws on missing skill directory in preset', async () => {
    const presetDir = await createTempPreset('real-skill', { 'SKILL.md': '# Exists' });
    const targetBaseDir = await createTempTarget();

    await expect(
      copySkills(presetDir, ['nonexistent-skill'], { targetBaseDir }),
    ).rejects.toThrow(/not found in preset/);
  });

  test('installs multiple skills in order', async () => {
    const presetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-multi-'));
    tempDirs.push(presetDir);

    for (const name of ['skill-a', 'skill-b']) {
      const skillDir = path.join(presetDir, 'skills', name);
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), `# ${name}`, 'utf-8');
    }

    const targetBaseDir = await createTempTarget();

    await copySkills(presetDir, ['skill-a', 'skill-b'], { force: true, targetBaseDir });

    for (const name of ['skill-a', 'skill-b']) {
      const content = await fs.readFile(path.join(targetBaseDir, name, 'SKILL.md'), 'utf-8');
      expect(content).toBe(`# ${name}`);
    }
  });
});
