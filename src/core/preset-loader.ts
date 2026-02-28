import path from 'node:path';
import fs from 'node:fs/promises';
import { readJson5, writeJson5 } from './json5-utils.ts';
import { PRESET_MANIFEST_FILENAME } from './constants.ts';
import type { PresetManifest } from './types.ts';

// Reads preset.json5 from a preset directory, validates required fields
export async function loadPreset(presetPath: string): Promise<PresetManifest> {
  const manifestPath = path.join(presetPath, PRESET_MANIFEST_FILENAME);

  let snapshot;
  try {
    snapshot = await readJson5(manifestPath);
  } catch {
    throw new Error(`Preset not found: ${manifestPath}`);
  }

  const manifest = snapshot.parsed as Partial<PresetManifest>;

  if (!manifest.name) throw new Error(`Preset missing required field: name (in ${manifestPath})`);
  if (!manifest.description)
    throw new Error(`Preset missing required field: description (in ${manifestPath})`);
  if (!manifest.version)
    throw new Error(`Preset missing required field: version (in ${manifestPath})`);

  return manifest as PresetManifest;
}

// Scans presetsDir for user presets + merges with built-in presets
// User presets take precedence over built-in presets with same name
export async function listPresets(
  presetsDir: string,
  builtinPresets: PresetManifest[],
): Promise<PresetManifest[]> {
  const userPresets: PresetManifest[] = [];

  try {
    const entries = await fs.readdir(presetsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const preset = await loadPreset(path.join(presetsDir, entry.name));
          userPresets.push(preset);
        } catch {
          // Skip invalid preset directories
        }
      }
    }
  } catch {
    // presetsDir doesn't exist, return only built-ins
  }

  // User presets override built-ins with same name
  const userPresetNames = new Set(userPresets.map((p) => p.name));
  const filteredBuiltins = builtinPresets.filter((p) => !userPresetNames.has(p.name));

  return [...filteredBuiltins, ...userPresets];
}

// Writes preset.json5 + copies workspace files to preset directory
export async function savePreset(
  presetDir: string,
  manifest: PresetManifest,
  workspaceFiles?: Map<string, string>,
): Promise<void> {
  await fs.mkdir(presetDir, { recursive: true });

  const manifestPath = path.join(presetDir, PRESET_MANIFEST_FILENAME);
  await writeJson5(manifestPath, manifest as unknown as Record<string, unknown>);

  if (workspaceFiles) {
    for (const [filename, content] of workspaceFiles) {
      await fs.writeFile(path.join(presetDir, filename), content, 'utf-8');
    }
  }
}
