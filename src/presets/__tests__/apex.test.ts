import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPreset } from '../../core/preset-loader';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APEX_DESCRIPTION_PATTERN = /all-in-one|power/;
const AUTH_KEY_PATTERN = /(^|\.)auth$/i;
const ENV_KEY_PATTERN = /(^|\.)env$/i;
const META_KEY_PATTERN = /(^|\.)meta$/i;
const API_KEY_PATTERN = /apikey/i;
const TOKEN_KEY_PATTERN = /(^|\.)(token|botToken|accessToken)$/i;

function collectKeyPaths(value: unknown, parent = ''): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectKeyPaths(item, `${parent}[${index}]`)
    );
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const keyPath = parent ? `${parent}.${key}` : key;
    return [keyPath, ...collectKeyPaths(child, keyPath)];
  });
}

describe('apex preset', () => {
  test('loads successfully', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));

    expect(preset.name).toBe('apex');
  });

  test('has expected metadata', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));

    expect(preset.name).toBe('apex');
    expect(preset.version).toBe('1.0.0');
    expect(preset.description.toLowerCase()).toMatch(APEX_DESCRIPTION_PATTERN);
  });

  test('includes exactly four workspace files in expected order', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));

    expect(preset.workspaceFiles).toEqual([
      'AGENTS.md',
      'SOUL.md',
      'USER.md',
      'IDENTITY.md',
    ]);
    expect(preset.workspaceFiles).toHaveLength(4);
  });

  test('includes required skills', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));

    expect(preset.skills).toEqual([
      'prompt-guard',
      'tmux-opencode',
      'agent-browser',
      'image-gen',
    ]);
  });

  test('includes required config sections', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));

    expect(preset.config).toBeDefined();
    expect(preset.config).toHaveProperty('identity');
    expect(preset.config).toHaveProperty('agents');
    expect(preset.config).toHaveProperty('tools');
  });

  test('avoids unsupported OpenClaw schema keys', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));
    const config = preset.config as Record<string, unknown>;
    const agents = config.agents as Record<string, unknown>;
    const defaults = agents.defaults as Record<string, unknown>;

    expect(config).toHaveProperty('routing', null);
    expect(defaults).toHaveProperty('tools', null);
    expect(config).toHaveProperty(
      'tools.message.crossContext.allowAcrossProviders',
      true
    );
  });

  test('does not include restricted sensitive keys', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));
    const keyPaths = collectKeyPaths(preset.config);

    expect(keyPaths.some((key) => AUTH_KEY_PATTERN.test(key))).toBe(false);
    expect(keyPaths.some((key) => ENV_KEY_PATTERN.test(key))).toBe(false);
    expect(keyPaths.some((key) => META_KEY_PATTERN.test(key))).toBe(false);
    expect(keyPaths.some((key) => API_KEY_PATTERN.test(key))).toBe(false);
    expect(keyPaths.some((key) => TOKEN_KEY_PATTERN.test(key))).toBe(false);
  });

  test('marks apex as builtin preset', async () => {
    const preset = await loadPreset(path.join(__dirname, '..', 'apex'));

    expect(preset.builtin).toBe(true);
  });
});
