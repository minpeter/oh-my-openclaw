import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { WORKSPACE_FILES } from '../constants';
import {
  copyWorkspaceFiles,
  copyWorkspaceSkills,
  exportWorkspaceFiles,
  exportWorkspaceSkills,
  listWorkspaceFiles,
  listWorkspaceSkillFiles,
  listWorkspaceSkills,
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

  describe('listWorkspaceSkills', () => {
    test('lists skill directories that contain SKILL.md', async () => {
      const { mkdir } = await import('node:fs/promises');
      const skillsDir = path.join(tempDir, 'skills');
      const skillADir = path.join(skillsDir, 'skill-a');
      const skillBDir = path.join(skillsDir, 'skill-b');

      await mkdir(skillADir, { recursive: true });
      await mkdir(skillBDir, { recursive: true });
      await writeFile(path.join(skillADir, 'SKILL.md'), '# Skill A');
      await writeFile(path.join(skillBDir, 'SKILL.md'), '# Skill B');

      const skills = await listWorkspaceSkills(tempDir);

      expect(skills).toEqual(['skill-a', 'skill-b']);
    });

    test('ignores directories without SKILL.md', async () => {
      const { mkdir } = await import('node:fs/promises');
      const skillsDir = path.join(tempDir, 'skills');
      const validDir = path.join(skillsDir, 'valid-skill');
      const invalidDir = path.join(skillsDir, 'no-skill-md');

      await mkdir(validDir, { recursive: true });
      await mkdir(invalidDir, { recursive: true });
      await writeFile(path.join(validDir, 'SKILL.md'), '# Valid');
      await writeFile(path.join(invalidDir, 'README.md'), '# Not a skill');

      const skills = await listWorkspaceSkills(tempDir);

      expect(skills).toEqual(['valid-skill']);
    });

    test('ignores files in skills directory (not directories)', async () => {
      const { mkdir } = await import('node:fs/promises');
      const skillsDir = path.join(tempDir, 'skills');
      const validDir = path.join(skillsDir, 'real-skill');

      await mkdir(validDir, { recursive: true });
      await writeFile(path.join(validDir, 'SKILL.md'), '# Real Skill');
      await writeFile(path.join(skillsDir, 'stray-file.txt'), 'not a dir');

      const skills = await listWorkspaceSkills(tempDir);

      expect(skills).toEqual(['real-skill']);
    });

    test('returns empty array when skills directory does not exist', async () => {
      const skills = await listWorkspaceSkills(tempDir);

      expect(skills).toEqual([]);
    });

    test('returns sorted skill names', async () => {
      const { mkdir } = await import('node:fs/promises');
      const skillsDir = path.join(tempDir, 'skills');

      for (const name of ['zebra', 'alpha', 'middle']) {
        const dir = path.join(skillsDir, name);
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, 'SKILL.md'), `# ${name}`);
      }

      const skills = await listWorkspaceSkills(tempDir);

      expect(skills).toEqual(['alpha', 'middle', 'zebra']);
    });
  });

  describe('listWorkspaceSkillFiles', () => {
    test('returns relative paths to SKILL.md files', async () => {
      const { mkdir } = await import('node:fs/promises');
      const skillsDir = path.join(tempDir, 'skills');
      const skillDir = path.join(skillsDir, 'my-skill');

      await mkdir(skillDir, { recursive: true });
      await writeFile(path.join(skillDir, 'SKILL.md'), '# My Skill');

      const files = await listWorkspaceSkillFiles(tempDir);

      expect(files).toEqual([path.join('skills', 'my-skill', 'SKILL.md')]);
    });

    test('returns empty array when no skills exist', async () => {
      const files = await listWorkspaceSkillFiles(tempDir);

      expect(files).toEqual([]);
    });
  });

  describe('copyWorkspaceSkills', () => {
    test('copies skill directories recursively', async () => {
      const { mkdir } = await import('node:fs/promises');
      const srcRoot = path.join(tempDir, 'src-root');
      const destRoot = path.join(tempDir, 'dest-root');
      const skillDir = path.join(srcRoot, 'skills', 'my-skill');

      await mkdir(skillDir, { recursive: true });
      await writeFile(path.join(skillDir, 'SKILL.md'), '# My Skill');
      await mkdir(path.join(skillDir, 'scripts'), { recursive: true });
      await writeFile(path.join(skillDir, 'scripts', 'run.sh'), '#!/bin/bash');

      await copyWorkspaceSkills(srcRoot, destRoot, ['my-skill']);

      const destSkillDir = path.join(destRoot, 'skills', 'my-skill');
      expect(await readFile(path.join(destSkillDir, 'SKILL.md'), 'utf8')).toBe(
        '# My Skill'
      );
      expect(
        await readFile(path.join(destSkillDir, 'scripts', 'run.sh'), 'utf8')
      ).toBe('#!/bin/bash');
    });

    test('does nothing when skills array is empty', async () => {
      const { access } = await import('node:fs/promises');
      const srcRoot = path.join(tempDir, 'src-root');
      const destRoot = path.join(tempDir, 'dest-root');

      await copyWorkspaceSkills(srcRoot, destRoot, []);

      // destRoot/skills should not exist
      await expect(access(path.join(destRoot, 'skills'))).rejects.toThrow();
    });

    test('copies multiple skills', async () => {
      const { mkdir } = await import('node:fs/promises');
      const srcRoot = path.join(tempDir, 'src-root');
      const destRoot = path.join(tempDir, 'dest-root');

      for (const name of ['skill-a', 'skill-b']) {
        const dir = path.join(srcRoot, 'skills', name);
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, 'SKILL.md'), `# ${name}`);
      }

      await copyWorkspaceSkills(srcRoot, destRoot, ['skill-a', 'skill-b']);

      expect(
        await readFile(
          path.join(destRoot, 'skills', 'skill-a', 'SKILL.md'),
          'utf8'
        )
      ).toBe('# skill-a');
      expect(
        await readFile(
          path.join(destRoot, 'skills', 'skill-b', 'SKILL.md'),
          'utf8'
        )
      ).toBe('# skill-b');
    });
  });

  describe('exportWorkspaceSkills', () => {
    test('copies existing skills into preset directory and returns their names', async () => {
      const { mkdir } = await import('node:fs/promises');
      const workspaceDir = path.join(tempDir, 'workspace');
      const presetDir = path.join(tempDir, 'preset');
      const skillDir = path.join(workspaceDir, 'skills', 'my-skill');

      await mkdir(skillDir, { recursive: true });
      await writeFile(path.join(skillDir, 'SKILL.md'), '# My Skill');

      const result = await exportWorkspaceSkills(workspaceDir, presetDir);

      expect(result).toEqual(['my-skill']);
      expect(
        await readFile(
          path.join(presetDir, 'skills', 'my-skill', 'SKILL.md'),
          'utf8'
        )
      ).toBe('# My Skill');
    });

    test('returns empty array when no skills exist', async () => {
      const workspaceDir = path.join(tempDir, 'workspace');
      const presetDir = path.join(tempDir, 'preset');

      const result = await exportWorkspaceSkills(workspaceDir, presetDir);

      expect(result).toEqual([]);
    });

    test('handles missing workspace dir gracefully', async () => {
      const workspaceDir = path.join(tempDir, 'nonexistent-workspace');
      const presetDir = path.join(tempDir, 'preset');

      const result = await exportWorkspaceSkills(workspaceDir, presetDir);

      expect(result).toEqual([]);
    });
  });
});
