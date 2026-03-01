import pc from 'picocolors';

import { resolveOpenClawPaths } from '../core/config-path';
import { listPresets } from '../core/preset-loader';
import type { PresetManifest } from '../core/types';
import { getBuiltinPresets } from '../presets/index';

interface ListOptions {
  json?: boolean;
}

function toOutputPreset(preset: PresetManifest): PresetManifest {
  return {
    ...preset,
    builtin: Boolean(preset.builtin),
  };
}

export async function listCommand(options: ListOptions = {}): Promise<void> {
  const paths = await resolveOpenClawPaths();
  const presets = await listPresets(
    paths.presetsDir,
    await getBuiltinPresets()
  );

  if (options.json) {
    console.log(JSON.stringify(presets.map(toOutputPreset), null, 2));
    return;
  }

  if (presets.length === 0) {
    console.log(pc.dim('No presets found.'));
    return;
  }

  console.log(pc.bold('Available presets:\n'));

  for (const preset of presets.map(toOutputPreset)) {
    const source = preset.builtin ? pc.dim('[builtin]') : pc.green('[user]');
    const tags = preset.tags?.length
      ? pc.dim(` (${preset.tags.join(', ')})`)
      : '';
    console.log(`  ${pc.bold(preset.name)} ${source}`);
    console.log(`    ${preset.description}${tags}`);
    console.log(`    ${pc.dim(`v${preset.version}`)}`);
    console.log();
  }
}
