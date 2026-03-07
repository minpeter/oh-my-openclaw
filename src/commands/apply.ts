import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pc from 'picocolors';

import { createBackup, createWorkspaceBackup } from '../core/backup';
import { resolveOpenClawPaths } from '../core/config-path';
import { PRESERVE_IF_SET_FIELDS, WORKSPACE_FILES } from '../core/constants';
import { fixNodePathIfNeeded } from '../core/fix-node-path';
import {
  hasJson5Comments,
  isFileNotFoundError,
  readJson5,
  writeJson5,
} from '../core/json5-utils';
import { migrateLegacyKeys } from '../core/legacy-migration';
import { deepMerge } from '../core/merge';
import {
  installOpenClawPlugins,
  runOpenClawMemoryIndex,
} from '../core/openclaw-plugin';
import { loadPreset } from '../core/preset-loader';
import { assertValidPresetName } from '../core/preset-name';
import { cloneToCache, isGitHubRef, parseGitHubRef } from '../core/remote';
import { filterSensitiveFields } from '../core/sensitive-filter';
import { copySkills } from '../core/skills';
import type { PresetManifest } from '../core/types';
import {
  copyWorkspaceFiles,
  listWorkspaceFiles,
  resolveWorkspaceDir,
} from '../core/workspace';
import { getBuiltinPresets } from '../presets/index';

interface ApplyOptions {
  clean?: boolean;
  dryRun?: boolean;
  force?: boolean;
  noBackup?: boolean;
  verbose?: boolean;
}

interface ResolvedPreset {
  preset: PresetManifest;
  presetDir: string;
}

function isPresetNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.startsWith('Preset not found:')
  );
}

function resolveBuiltinPresetDir(presetName: string): string {
  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  return path.join(commandDir, '..', 'presets', presetName);
}

function hasPresetConfig(preset: PresetManifest): boolean {
  return Boolean(preset.config && Object.keys(preset.config).length > 0);
}

function hasPresetOpenClawPlugins(preset: PresetManifest): boolean {
  return Boolean(preset.openclawPlugins && preset.openclawPlugins.length > 0);
}

function hasOpenClawMemoryBootstrap(preset: PresetManifest): boolean {
  return preset.openclawBootstrap?.memoryIndex === true;
}

function logVerbose(enabled: boolean, message: string): void {
  if (!enabled) {
    return;
  }

  console.log(pc.dim(`[verbose] ${message}`));
}

function getBackupMode(noBackup: boolean | undefined): string {
  if (noBackup) {
    return 'disabled';
  }

  return 'enabled';
}

function describeConfigStatus(
  configExists: boolean,
  configPath: string
): string {
  if (configExists) {
    return `Current config found at ${configPath}`;
  }

  return `Current config not found at ${configPath}`;
}

async function resolvePreset(
  presetName: string,
  presetsDir: string,
  force?: boolean
): Promise<ResolvedPreset> {
  if (isGitHubRef(presetName)) {
    const { owner, repo } = parseGitHubRef(presetName);
    const cachePath = await cloneToCache(owner, repo, presetsDir, { force });
    console.log(pc.green(`Remote preset '${owner}/${repo}' ready.`));
    return {
      preset: await loadPreset(cachePath),
      presetDir: cachePath,
    };
  }

  assertValidPresetName(presetName);

  const userPresetPath = path.join(presetsDir, presetName);
  let userPreset: ResolvedPreset | null = null;
  try {
    const preset = await loadPreset(userPresetPath);
    userPreset = { preset, presetDir: userPresetPath };
  } catch (error) {
    if (!isPresetNotFoundError(error)) {
      throw error;
    }
  }

  if (userPreset) {
    return userPreset;
  }

  const builtinPreset = (await getBuiltinPresets()).find(
    (candidate) => candidate.name === presetName
  );
  if (!builtinPreset) {
    throw new Error(
      `Preset '${presetName}' not found. Run 'apex list' to see available presets.`
    );
  }

  return {
    preset: builtinPreset,
    presetDir: resolveBuiltinPresetDir(presetName),
  };
}

async function loadCurrentConfig(configPath: string): Promise<{
  config: Record<string, unknown>;
  exists: boolean;
  hasJson5Comments: boolean;
}> {
  try {
    const snapshot = await readJson5(configPath);
    return {
      config: snapshot.parsed,
      exists: true,
      hasJson5Comments: hasJson5Comments(snapshot.raw),
    };
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }

    return {
      config: {},
      exists: false,
      hasJson5Comments: false,
    };
  }
}

async function unlinkIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function backupWorkspaceIfNeeded(
  workspaceDir: string,
  backupsDir: string,
  enabled: boolean
): Promise<void> {
  if (!enabled) {
    return;
  }

  const existingWorkspaceFiles = await listWorkspaceFiles(workspaceDir);
  if (existingWorkspaceFiles.length === 0) {
    return;
  }

  const workspaceBackupPath = await createWorkspaceBackup(
    workspaceDir,
    backupsDir,
    existingWorkspaceFiles
  );
  console.log(pc.dim(`Workspace backup created: ${workspaceBackupPath}`));
}

async function runCleanMode(
  workspaceDir: string,
  configPath: string,
  backupsDir: string,
  configExists: boolean,
  noBackup: boolean
): Promise<void> {
  if (!noBackup && configExists) {
    const backupPath = await createBackup(configPath, backupsDir);
    console.log(pc.dim(`Backup created: ${backupPath}`));
  }

  await backupWorkspaceIfNeeded(workspaceDir, backupsDir, !noBackup);
  await removeWorkspaceFiles(workspaceDir);
  await unlinkIfExists(configPath);
}

async function runRegularBackupMode(
  workspaceDir: string,
  configPath: string,
  backupsDir: string,
  configExists: boolean,
  noBackup: boolean,
  hasWorkspaceFiles: boolean
): Promise<void> {
  if (!noBackup && configExists) {
    const backupPath = await createBackup(configPath, backupsDir);
    console.log(pc.dim(`Backup created: ${backupPath}`));
  }

  await backupWorkspaceIfNeeded(
    workspaceDir,
    backupsDir,
    !noBackup && hasWorkspaceFiles
  );
}

async function removeWorkspaceFiles(workspaceDir: string): Promise<void> {
  for (const filename of WORKSPACE_FILES) {
    await unlinkIfExists(path.join(workspaceDir, filename));
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== 'object'
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (
      !(part in current) ||
      typeof current[part] !== 'object' ||
      current[part] === null
    ) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = parts.at(-1);
  if (lastPart !== undefined) {
    current[lastPart] = value;
  }
}

function buildMergedConfig(
  currentConfig: Record<string, unknown>,
  preset: PresetManifest
): {
  applied: string[];
  mergedConfig: Record<string, unknown>;
  preserved: string[];
} {
  if (!hasPresetConfig(preset)) {
    return { applied: [], mergedConfig: currentConfig, preserved: [] };
  }

  // Save user-set values that should not be overwritten
  const savedValues = new Map<string, unknown>();
  for (const field of PRESERVE_IF_SET_FIELDS) {
    const existing = getNestedValue(currentConfig, field);
    if (existing !== undefined) {
      savedValues.set(field, existing);
    }
  }

  const filteredPresetConfig = filterSensitiveFields(
    preset.config as Record<string, unknown>
  );
  const rawMerged = deepMerge(currentConfig, filteredPresetConfig);
  const { config: mergedConfig, applied } = migrateLegacyKeys(rawMerged);

  // Restore preserved values
  const preserved: string[] = [];
  for (const [field, value] of savedValues) {
    const newValue = getNestedValue(mergedConfig, field);
    if (newValue !== value) {
      setNestedValue(mergedConfig, field, value);
      preserved.push(field);
    }
  }

  return { applied, mergedConfig, preserved };
}

function buildJson5CommentLossMessage(
  configPath: string,
  hasExistingJson5Comments: boolean,
  dryRun: boolean
): string {
  if (dryRun) {
    if (hasExistingJson5Comments) {
      return `Dry-run note: detected JSON5 comments in ${configPath}. Applying this preset will rewrite the file as standard JSON and remove those comments.`;
    }

    return `Dry-run note: applying this preset rewrites ${configPath} as standard JSON. JSON5 comments are not preserved.`;
  }

  if (hasExistingJson5Comments) {
    return `Warning: detected JSON5 comments in ${configPath}. Applying this preset rewrites the file as standard JSON and removes those comments.`;
  }

  return `Warning: applying this preset rewrites ${configPath} as standard JSON. JSON5 comments are not preserved.`;
}

function printDryRunInfo(
  preset: PresetManifest,
  options: {
    configExists: boolean;
    configHasJson5Comments: boolean;
    configPath: string;
  }
): void {
  console.log(pc.bold(pc.yellow('DRY RUN - no files will be modified\n')));
  console.log(`Preset: ${pc.bold(preset.name)} (${preset.description})`);
  if (hasPresetConfig(preset)) {
    console.log(
      `Config changes: ${Object.keys(preset.config as Record<string, unknown>).length} top-level keys`
    );
    if (options.configExists) {
      console.log(
        pc.yellow(
          buildJson5CommentLossMessage(
            options.configPath,
            options.configHasJson5Comments,
            true
          )
        )
      );
    } else {
      console.log(
        pc.yellow(
          `Dry-run note: ${options.configPath} does not exist. Applying this preset will create it as standard JSON.`
        )
      );
    }
  }
  if (preset.workspaceFiles?.length) {
    console.log(`Workspace files: ${preset.workspaceFiles.join(', ')}`);
  }
  if (preset.openclawPlugins?.length) {
    console.log(
      `OpenClaw plugins to install: ${preset.openclawPlugins.join(', ')}`
    );
  }
  if (hasOpenClawMemoryBootstrap(preset)) {
    console.log('OpenClaw bootstrap steps: memory index');
  }
  if (preset.skills?.length) {
    console.log(`Skills to install: ${preset.skills.join(', ')}`);
  }
  console.log(pc.dim('\nRun without --dry-run to apply.'));
}

async function ensurePresetOpenClawPlugins(
  preset: PresetManifest,
  verbose: boolean
): Promise<void> {
  if (hasPresetOpenClawPlugins(preset)) {
    logVerbose(
      verbose,
      `Ensuring ${preset.openclawPlugins?.length ?? 0} OpenClaw plugin(s)`
    );
    const ensuredPlugins = await installOpenClawPlugins(
      preset.openclawPlugins ?? []
    );
    if (ensuredPlugins.length > 0) {
      console.log(
        pc.green(`OK OpenClaw plugins ready: ${ensuredPlugins.join(', ')}`)
      );
    }
  }
}

async function runPostApplyOpenClawBootstrap(
  preset: PresetManifest,
  verbose: boolean
): Promise<void> {
  if (!hasOpenClawMemoryBootstrap(preset)) {
    return;
  }

  logVerbose(verbose, 'Running OpenClaw memory index bootstrap');
  await runOpenClawMemoryIndex();
  console.log(pc.green('OK OpenClaw memory indexed.'));
}

export async function applyCommand(
  presetName: string,
  options: ApplyOptions = {}
): Promise<void> {
  const verbose = Boolean(options.verbose);
  const paths = await resolveOpenClawPaths();
  logVerbose(
    verbose,
    `Resolved paths: config=${paths.configPath}, presets=${paths.presetsDir}, backups=${paths.backupsDir}, state=${paths.stateDir}`
  );

  logVerbose(verbose, `Resolving preset '${presetName}'`);
  const { preset, presetDir } = await resolvePreset(
    presetName,
    paths.presetsDir,
    options.force
  );
  logVerbose(verbose, `Loaded preset '${preset.name}' from ${presetDir}`);

  const configSnapshot = await loadCurrentConfig(paths.configPath);
  let currentConfig = configSnapshot.config;
  let configExists = configSnapshot.exists;
  let configHasJson5Comments = configSnapshot.hasJson5Comments;
  const workspaceDir = resolveWorkspaceDir(currentConfig, paths.stateDir);
  logVerbose(verbose, describeConfigStatus(configExists, paths.configPath));
  logVerbose(verbose, `Workspace directory resolved to ${workspaceDir}`);

  if (options.dryRun) {
    const { mergedConfig } = buildMergedConfig(
      options.clean ? {} : currentConfig,
      preset
    );
    logVerbose(
      verbose,
      `Merge complete: ${Object.keys(mergedConfig).length} top-level keys`
    );
    logVerbose(verbose, 'Dry-run requested; skipping backup and write steps');
    if (options.clean) {
      console.log(pc.yellow('Mode: CLEAN INSTALL'));
    }
    printDryRunInfo(preset, {
      configExists,
      configHasJson5Comments,
      configPath: paths.configPath,
    });
    return;
  }

  if (options.clean) {
    logVerbose(
      verbose,
      `Running clean mode with backup ${getBackupMode(options.noBackup)}`
    );
    await runCleanMode(
      workspaceDir,
      paths.configPath,
      paths.backupsDir,
      configExists,
      Boolean(options.noBackup)
    );
    logVerbose(verbose, 'Clean mode completed');
    console.log(
      pc.yellow('Clean install: existing config and workspace files removed.')
    );
  }

  if (!options.clean) {
    logVerbose(
      verbose,
      `Running regular backup mode with backup ${getBackupMode(options.noBackup)}`
    );
    await runRegularBackupMode(
      workspaceDir,
      paths.configPath,
      paths.backupsDir,
      configExists,
      Boolean(options.noBackup),
      Boolean(preset.workspaceFiles?.length)
    );
  }

  await ensurePresetOpenClawPlugins(preset, verbose);

  const postBootstrapSnapshot = await loadCurrentConfig(paths.configPath);
  currentConfig = postBootstrapSnapshot.config;
  configExists = postBootstrapSnapshot.exists;
  configHasJson5Comments = postBootstrapSnapshot.hasJson5Comments;

  const { applied, mergedConfig, preserved } = buildMergedConfig(
    currentConfig,
    preset
  );
  logVerbose(
    verbose,
    `Merge complete: ${Object.keys(mergedConfig).length} top-level keys`
  );
  if (applied.length > 0) {
    console.log(pc.dim(`Legacy key migration: ${applied.join(', ')}`));
  }
  if (preserved.length > 0) {
    console.log(
      pc.dim(`Preserved existing user settings: ${preserved.join(', ')}`)
    );
  }

  if (hasPresetConfig(preset)) {
    logVerbose(verbose, `Writing merged config to ${paths.configPath}`);
    if (configExists) {
      console.log(
        pc.yellow(
          buildJson5CommentLossMessage(
            paths.configPath,
            configHasJson5Comments,
            false
          )
        )
      );
    } else {
      console.log(
        pc.yellow(
          'Warning: config file not found. Creating new config from preset.'
        )
      );
    }
    await fs.mkdir(path.dirname(paths.configPath), { recursive: true });
    await writeJson5(paths.configPath, mergedConfig);
  }

  if (preset.workspaceFiles?.length) {
    logVerbose(
      verbose,
      `Copying ${preset.workspaceFiles.length} workspace file(s) from ${presetDir} to ${workspaceDir}`
    );
    await copyWorkspaceFiles(presetDir, workspaceDir, preset.workspaceFiles);
    console.log(
      pc.green(`OK Workspace files copied: ${preset.workspaceFiles.join(', ')}`)
    );
  }

  if (preset.skills?.length) {
    logVerbose(
      verbose,
      `Installing ${preset.skills.length} skill(s) from ${path.join(presetDir, 'skills')}`
    );
    const installed = await copySkills(presetDir, preset.skills, {
      force: options.force,
    });
    if (installed.length > 0) {
      console.log(pc.green(`OK Skills installed: ${installed.join(', ')}`));
    }
  }

  await runPostApplyOpenClawBootstrap(preset, verbose);

  if (process.platform === 'darwin') {
    logVerbose(verbose, 'Checking Node PATH fix for macOS');
    await fixNodePathIfNeeded();
  }

  logVerbose(verbose, `Apply flow completed for preset '${preset.name}'`);
  console.log(pc.green(`\nOK Preset '${preset.name}' applied.`));
  console.log(
    pc.bold(pc.yellow("Run 'openclaw gateway restart' to activate changes."))
  );
}
