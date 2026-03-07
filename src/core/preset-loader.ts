import fs from 'node:fs/promises';
import path from 'node:path';
import { PRESET_MANIFEST_FILENAME } from './constants';
import { isFileNotFoundError, readJson5, writeJson5 } from './json5-utils';
import type { ConfigSnapshot, PresetManifest } from './types';

function isSkippablePresetError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.startsWith('Preset not found:') ||
    error.message.startsWith('Preset invalid field:') ||
    error.message.startsWith('Preset missing required field:') ||
    error.message.startsWith('Invalid JSON5 in ')
  );
}

function throwInvalidField(
  field: string,
  manifestPath: string,
  reason: string
): never {
  throw new Error(
    `Preset invalid field: ${field} (${reason}) (in ${manifestPath})`
  );
}

function validateStringArrayField(
  field: string,
  value: unknown,
  manifestPath: string
): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    throwInvalidField(field, manifestPath, 'expected an array of strings');
  }

  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      throwInvalidField(
        field,
        manifestPath,
        'array entries must be non-empty strings'
      );
    }
  }
}

function validateOpenClawBootstrapField(
  value: unknown,
  manifestPath: string
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throwInvalidField('openclawBootstrap', manifestPath, 'expected an object');
  }

  const bootstrap = value as Record<string, unknown>;
  if (
    bootstrap.memoryIndex !== undefined &&
    typeof bootstrap.memoryIndex !== 'boolean'
  ) {
    throwInvalidField(
      'openclawBootstrap.memoryIndex',
      manifestPath,
      'expected a boolean'
    );
  }
}

// Reads preset.json5 from a preset directory, validates required fields
export async function loadPreset(presetPath: string): Promise<PresetManifest> {
  const manifestPath = path.join(presetPath, PRESET_MANIFEST_FILENAME);

  let snapshot: ConfigSnapshot;
  try {
    snapshot = await readJson5(manifestPath);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      throw new Error(`Preset not found: ${manifestPath}`);
    }

    throw error;
  }

  const manifest = snapshot.parsed as Partial<PresetManifest>;

  if (!manifest.name) {
    throw new Error(`Preset missing required field: name (in ${manifestPath})`);
  }
  if (!manifest.description) {
    throw new Error(
      `Preset missing required field: description (in ${manifestPath})`
    );
  }
  if (!manifest.version) {
    throw new Error(
      `Preset missing required field: version (in ${manifestPath})`
    );
  }

  validateStringArrayField(
    'openclawPlugins',
    manifest.openclawPlugins,
    manifestPath
  );
  validateOpenClawBootstrapField(manifest.openclawBootstrap, manifestPath);

  return manifest as PresetManifest;
}

// Scans presetsDir for user presets + merges with built-in presets
// User presets take precedence over built-in presets with same name
export async function listPresets(
  presetsDir: string,
  builtinPresets: PresetManifest[]
): Promise<PresetManifest[]> {
  const userPresets: PresetManifest[] = [];

  try {
    const entries = await fs.readdir(presetsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const preset = await loadPreset(path.join(presetsDir, entry.name));
          userPresets.push(preset);
        } catch (error) {
          if (!isSkippablePresetError(error)) {
            throw error;
          }

          // Skip invalid preset directories
        }
      }
    }
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }

    // presetsDir doesn't exist, return only built-ins
  }

  // User presets override built-ins with same name
  const userPresetNames = new Set(userPresets.map((p) => p.name));
  const filteredBuiltins = builtinPresets.filter(
    (p) => !userPresetNames.has(p.name)
  );

  return [...filteredBuiltins, ...userPresets];
}

// Writes preset.json5 + copies workspace files to preset directory
export async function savePreset(
  presetDir: string,
  manifest: PresetManifest,
  workspaceFiles?: Map<string, string>
): Promise<void> {
  await fs.mkdir(presetDir, { recursive: true });

  const manifestPath = path.join(presetDir, PRESET_MANIFEST_FILENAME);
  await writeJson5(
    manifestPath,
    manifest as unknown as Record<string, unknown>
  );

  if (workspaceFiles) {
    for (const [filename, content] of workspaceFiles) {
      await fs.writeFile(path.join(presetDir, filename), content, 'utf-8');
    }
  }
}
