import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPreset } from '../core/preset-loader';
import type { PresetManifest } from '../core/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadBuiltinPresets(): Promise<PresetManifest[]> {
  const presetNames = ['apex'];
  const presets: PresetManifest[] = [];

  for (const name of presetNames) {
    const presetPath = path.join(__dirname, name);
    const preset = await loadPreset(presetPath);
    preset.builtin = true;
    presets.push(preset);
  }

  return presets;
}

let builtinPresetsCache: PresetManifest[] | null = null;

export async function getBuiltinPresets(): Promise<PresetManifest[]> {
  if (builtinPresetsCache) {
    return builtinPresetsCache;
  }

  builtinPresetsCache = await loadBuiltinPresets();
  return builtinPresetsCache;
}
