import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pc from 'picocolors';

import { createBackup, createWorkspaceBackup } from '../core/backup';
import { resolveOpenClawPaths } from '../core/config-path';
import { WORKSPACE_FILES } from '../core/constants';
import { readJson5, writeJson5 } from '../core/json5-utils';
import { deepMerge } from '../core/merge';
import { loadPreset } from '../core/preset-loader';
import { isGitHubRef, parseGitHubRef, cloneToCache } from '../core/remote';
import { filterSensitiveFields } from '../core/sensitive-filter';
import { copyWorkspaceFiles, listWorkspaceFiles, resolveWorkspaceDir } from '../core/workspace';
import { getBuiltinPresets } from '../presets/index';
import type { PresetManifest } from '../core/types';

interface ApplyOptions {
  dryRun?: boolean;
  noBackup?: boolean;
  clean?: boolean;
  force?: boolean;
}

function resolveBuiltinPresetDir(presetName: string): string {
  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  return path.join(commandDir, '..', 'presets', presetName);
}

function hasPresetConfig(preset: PresetManifest): boolean {
  return Boolean(preset.config && Object.keys(preset.config).length > 0);
}

export async function applyCommand(presetName: string, options: ApplyOptions = {}): Promise<void> {
  const paths = await resolveOpenClawPaths();

  let preset: PresetManifest;
  let presetDir: string;

  if (isGitHubRef(presetName)) {
    const { owner, repo } = parseGitHubRef(presetName);
    const cachePath = await cloneToCache(owner, repo, paths.presetsDir, { force: options.force });
    preset = await loadPreset(cachePath);
    presetDir = cachePath;
    console.log(pc.green(`Remote preset '${owner}/${repo}' ready.`));
  } else {
    const userPresetPath = path.join(paths.presetsDir, presetName);
    try {
      preset = await loadPreset(userPresetPath);
      presetDir = userPresetPath;
    } catch {
      const builtinPreset = (await getBuiltinPresets()).find((candidate) => candidate.name === presetName);
      if (!builtinPreset) {
        throw new Error(
          `Preset '${presetName}' not found. Run 'oh-my-openclaw list' to see available presets.`,
        );
      }
      preset = builtinPreset;
      presetDir = resolveBuiltinPresetDir(presetName);
    }
  }

  let currentConfig: Record<string, unknown> = {};
  let configExists = false;
  try {
    const snapshot = await readJson5(paths.configPath);
    currentConfig = snapshot.parsed;
    configExists = true;
  } catch {}

  const workspaceDir = resolveWorkspaceDir(currentConfig, paths.stateDir);

  if (options.clean && !options.dryRun) {
    if (!options.noBackup && configExists) {
      const backupPath = await createBackup(paths.configPath, paths.backupsDir);
      console.log(pc.dim(`Backup created: ${backupPath}`));
    }
    if (!options.noBackup) {
      const existingWorkspaceFiles = await listWorkspaceFiles(workspaceDir);
      if (existingWorkspaceFiles.length > 0) {
        const workspaceBackupPath = await createWorkspaceBackup(
          workspaceDir,
          paths.backupsDir,
          existingWorkspaceFiles,
        );
        console.log(pc.dim(`Workspace backup created: ${workspaceBackupPath}`));
      }
    }

    for (const filename of WORKSPACE_FILES) {
      try {
        await fs.unlink(path.join(workspaceDir, filename));
      } catch {}
    }

    try {
      await fs.unlink(paths.configPath);
    } catch {}

    currentConfig = {};
    configExists = false;
    console.log(pc.yellow('Clean install: existing config and workspace files removed.'));
  }

  let mergedConfig = currentConfig;
  if (hasPresetConfig(preset)) {
    const filteredPresetConfig = filterSensitiveFields(preset.config as Record<string, unknown>);
    mergedConfig = deepMerge(currentConfig, filteredPresetConfig);
  }

  if (options.dryRun) {
    console.log(pc.bold(pc.yellow('DRY RUN - no files will be modified\n')));
    if (options.clean) {
      console.log(pc.yellow('Mode: CLEAN INSTALL'));
    }
    console.log(`Preset: ${pc.bold(preset.name)} (${preset.description})`);
    if (hasPresetConfig(preset)) {
      console.log(`Config changes: ${Object.keys(preset.config as Record<string, unknown>).length} top-level keys`);
    }
    if (preset.workspaceFiles?.length) {
      console.log(`Workspace files: ${preset.workspaceFiles.join(', ')}`);
    }
    console.log(pc.dim('\nRun without --dry-run to apply.'));
    return;
  }

  if (!options.clean) {
    if (!options.noBackup && configExists) {
      const backupPath = await createBackup(paths.configPath, paths.backupsDir);
      console.log(pc.dim(`Backup created: ${backupPath}`));
    }

    if (!options.noBackup && preset.workspaceFiles?.length) {
      const existingWorkspaceFiles = await listWorkspaceFiles(workspaceDir);
      if (existingWorkspaceFiles.length > 0) {
        const workspaceBackupPath = await createWorkspaceBackup(
          workspaceDir,
          paths.backupsDir,
          existingWorkspaceFiles,
        );
        console.log(pc.dim(`Workspace backup created: ${workspaceBackupPath}`));
      }
    }
  }

  if (hasPresetConfig(preset)) {
    if (!configExists) {
      console.log(pc.yellow('Warning: config file not found. Creating new config from preset.'));
    } else {
      console.log(pc.yellow('Warning: JSON5 comments in your config will be lost (known MVP limitation).'));
    }
    await fs.mkdir(path.dirname(paths.configPath), { recursive: true });
    await writeJson5(paths.configPath, mergedConfig);
  }

  if (preset.workspaceFiles?.length) {
    await copyWorkspaceFiles(presetDir, workspaceDir, preset.workspaceFiles);
    console.log(pc.green(`OK Workspace files copied: ${preset.workspaceFiles.join(', ')}`));
  }

  console.log(pc.green(`\nOK Preset '${preset.name}' applied.`));
  console.log(pc.bold(pc.yellow("Run 'openclaw gateway restart' to activate changes.")));
}
