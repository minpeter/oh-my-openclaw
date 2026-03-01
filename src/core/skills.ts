import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import readline from 'node:readline';

export interface CopySkillsOptions {
  force?: boolean;
  dryRun?: boolean;
  targetBaseDir?: string;
}

function isYes(input: string): boolean {
  return input.trim().toLowerCase() === 'y';
}

export function promptOverwrite(skillName: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`Skill '${skillName}' already exists. Overwrite? [y/N] `, (answer) => {
      rl.close();
      resolve(isYes(answer));
    });
  });
}

async function sourceSkillDirExists(sourceDir: string): Promise<boolean> {
  return fs
    .stat(sourceDir)
    .then((stats) => stats.isDirectory())
    .catch(() => false);
}

async function targetSkillExists(targetDir: string): Promise<boolean> {
  return fs
    .stat(targetDir)
    .then(() => true)
    .catch(() => false);
}

export async function copySkills(
  presetDir: string,
  skills: string[],
  options?: CopySkillsOptions,
): Promise<void> {
  if (skills.length === 0) {
    return;
  }

  const sourceBaseDir = path.join(presetDir, 'skills');
  const homeDir = process.env.HOME ?? os.homedir();
  const targetBaseDir = options?.targetBaseDir ?? path.join(homeDir, '.agents', 'skills');
  const isDryRun = options?.dryRun === true;
  const forceOverwrite = options?.force === true;
  let targetBaseEnsured = false;

  for (const name of skills) {
    const srcDir = path.join(sourceBaseDir, name);
    const destDir = path.join(targetBaseDir, name);
    const sourceExists = await sourceSkillDirExists(srcDir);

    if (!sourceExists) {
      throw new Error(`Skill '${name}' not found in preset at ${srcDir}`);
    }

    if (isDryRun) {
      console.log(`Would install skill: ${name}`);
      continue;
    }

    const alreadyExists = await targetSkillExists(destDir);

    if (alreadyExists && !forceOverwrite) {
      if (!process.stdin.isTTY) {
        console.log(`Skipped skill '${name}' (already exists. Use --force to overwrite).`);
        continue;
      }

      const overwrite = await promptOverwrite(name);
      if (!overwrite) {
        console.log(`Skipped skill '${name}' (already exists. Use --force to overwrite).`);
        continue;
      }
    }

    if (alreadyExists) {
      await fs.rm(destDir, { recursive: true, force: true });
    }

    if (!targetBaseEnsured) {
      await fs.mkdir(targetBaseDir, { recursive: true });
      targetBaseEnsured = true;
    }

    await fs.cp(srcDir, destDir, { recursive: true });
    console.log(`OK Skill '${name}' installed.`);
  }
}
