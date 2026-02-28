import pc from 'picocolors';
import path from 'node:path';
import { resolveOpenClawPaths } from '../core/config-path.ts';
import { readJson5 } from '../core/json5-utils.ts';
import { resolveWorkspaceDir, listWorkspaceFiles } from '../core/workspace.ts';
import { loadPreset } from '../core/preset-loader.ts';
import { BUILTIN_PRESETS } from '../presets/index.ts';

interface DiffOptions {
  json?: boolean;
}

interface DiffEntry {
  path: string;
  type: 'added' | 'changed' | 'removed';
  currentValue?: unknown;
  presetValue?: unknown;
}

// Recursively compute diff between current and preset config
function computeDiff(
  current: Record<string, unknown>,
  preset: Record<string, unknown>,
  prefix = '',
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const allKeys = new Set([...Object.keys(current), ...Object.keys(preset)]);

  for (const key of allKeys) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const currentVal = current[key];
    const presetVal = preset[key];

    if (!(key in preset)) {
      // Key only in current — not changed by preset (skip)
      continue;
    }

    if (!(key in current)) {
      // Key only in preset — would be added
      entries.push({ path: fullPath, type: 'added', presetValue: presetVal });
      continue;
    }

    if (presetVal === null) {
      // Null in preset means delete
      entries.push({ path: fullPath, type: 'removed', currentValue: currentVal });
      continue;
    }

    if (
      typeof currentVal === 'object' && currentVal !== null && !Array.isArray(currentVal) &&
      typeof presetVal === 'object' && presetVal !== null && !Array.isArray(presetVal)
    ) {
      // Both objects — recurse
      entries.push(...computeDiff(
        currentVal as Record<string, unknown>,
        presetVal as Record<string, unknown>,
        fullPath,
      ));
    } else if (JSON.stringify(currentVal) !== JSON.stringify(presetVal)) {
      entries.push({ path: fullPath, type: 'changed', currentValue: currentVal, presetValue: presetVal });
    }
  }

  return entries;
}

export async function diffCommand(presetName: string, options: DiffOptions = {}): Promise<void> {
  const paths = await resolveOpenClawPaths();

  // Load preset
  let preset;
  const userPresetPath = path.join(paths.presetsDir, presetName);
  try {
    preset = await loadPreset(userPresetPath);
  } catch {
    const builtin = BUILTIN_PRESETS.find(p => p.name === presetName);
    if (!builtin) {
      throw new Error(`Preset '${presetName}' not found.`);
    }
    preset = builtin;
  }

  // Read current config
  let currentConfig: Record<string, unknown> = {};
  try {
    const snapshot = await readJson5(paths.configPath);
    currentConfig = snapshot.parsed;
  } catch {
    // No config
  }

  const presetConfig = (preset.config ?? {}) as Record<string, unknown>;
  const configDiff = computeDiff(currentConfig, presetConfig);

  // Workspace diff
  const workspaceDir = resolveWorkspaceDir(currentConfig, paths.stateDir);
  const currentWsFiles = await listWorkspaceFiles(workspaceDir);
  const presetWsFiles = preset.workspaceFiles ?? [];
  const wsFilesToAdd = presetWsFiles.filter(f => !currentWsFiles.includes(f));
  const wsFilesToReplace = presetWsFiles.filter(f => currentWsFiles.includes(f));

  if (options.json) {
    console.log(JSON.stringify({
      preset: presetName,
      changes: configDiff,
      workspaceFiles: { toAdd: wsFilesToAdd, toReplace: wsFilesToReplace },
    }, null, 2));
    return;
  }

  if (configDiff.length === 0 && wsFilesToAdd.length === 0 && wsFilesToReplace.length === 0) {
    console.log(pc.green('✓ No differences — current config matches preset.'));
    return;
  }

  console.log(pc.bold(`Diff: current config vs '${presetName}' preset\n`));

  for (const entry of configDiff) {
    if (entry.type === 'added') {
      console.log(pc.green(`  + ${entry.path}: ${JSON.stringify(entry.presetValue)}`));
    } else if (entry.type === 'removed') {
      console.log(pc.red(`  - ${entry.path}: ${JSON.stringify(entry.currentValue)}`));
    } else {
      console.log(pc.yellow(`  ~ ${entry.path}: ${JSON.stringify(entry.currentValue)} → ${JSON.stringify(entry.presetValue)}`));
    }
  }

  if (wsFilesToAdd.length > 0) {
    console.log(pc.green(`\n  + Workspace files to add: ${wsFilesToAdd.join(', ')}`));
  }
  if (wsFilesToReplace.length > 0) {
    console.log(pc.yellow(`  ~ Workspace files to replace: ${wsFilesToReplace.join(', ')}`));
  }
}
