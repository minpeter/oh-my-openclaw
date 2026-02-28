import pc from 'picocolors';
import path from 'node:path';
import fs from 'node:fs/promises';

import { resolveOpenClawPaths } from '../core/config-path';
import { readJson5 } from '../core/json5-utils';
import { filterSensitiveFields } from '../core/sensitive-filter';
import { resolveWorkspaceDir, exportWorkspaceFiles } from '../core/workspace';
import { savePreset } from '../core/preset-loader';
import type { PresetManifest } from '../core/types';

interface ExportOptions {
  description?: string;
  version?: string;
  force?: boolean;
}

export async function exportCommand(name: string, options: ExportOptions = {}): Promise<void> {
  const paths = await resolveOpenClawPaths();

  // Check if preset already exists
  const presetDir = path.join(paths.presetsDir, name);
  try {
    await fs.access(presetDir);
    if (!options.force) {
      throw new Error(`Preset '${name}' already exists. Use --force to overwrite.`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) {
      throw err;
    }
    // Preset doesn't exist, that's fine
  }

  // Read current config
  let currentConfig: Record<string, unknown> = {};
  try {
    const snapshot = await readJson5(paths.configPath);
    currentConfig = snapshot.parsed;
  } catch {
    console.log(pc.yellow('⚠ No OpenClaw config found. Exporting empty config.'));
  }

  // Filter sensitive fields
  const filteredConfig = filterSensitiveFields(currentConfig);

  // Resolve workspace dir
  const workspaceDir = resolveWorkspaceDir(currentConfig, paths.stateDir);

  // Build manifest
  const manifest: PresetManifest = {
    name,
    description:
      options.description ??
      `Exported from OpenClaw on ${new Date().toISOString().split('T')[0]}`,
    version: options.version ?? '1.0.0',
    config: filteredConfig,
    workspaceFiles: [],
  };

  // Save preset (creates dir + writes preset.json5)
  await savePreset(presetDir, manifest);

  // Copy workspace MD files
  const copiedFiles = await exportWorkspaceFiles(workspaceDir, presetDir);
  manifest.workspaceFiles = copiedFiles;

  // Update manifest with workspace files list
  await savePreset(presetDir, manifest);

  console.log(pc.green(`\n✓ Preset '${name}' exported to: ${presetDir}`));
  if (copiedFiles.length > 0) {
    console.log(`  Workspace files: ${copiedFiles.join(', ')}`);
  }
  if (Object.keys(filteredConfig).length < Object.keys(currentConfig).length) {
    console.log(pc.dim('  Note: Sensitive fields (auth, env, meta, etc.) were excluded.'));
  }
}
