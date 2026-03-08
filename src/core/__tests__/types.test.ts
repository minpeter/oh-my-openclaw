import { describe, expect, test } from 'bun:test';
import os from 'node:os';
import path from 'node:path';

import {
  APEX_DIR,
  DEFAULT_CONFIG_PATH,
  PRESET_MANIFEST_FILENAME,
  SENSITIVE_FIELDS,
  WORKSPACE_FILES,
} from '../constants';

describe('core constants', () => {
  test('has required sensitive fields', () => {
    expect(SENSITIVE_FIELDS.length).toBeGreaterThanOrEqual(5);

    const required: (typeof SENSITIVE_FIELDS)[number][] = [
      'auth',
      'env',
      'meta',
      'gateway.auth',
      'hooks.token',
      'models.providers.**.apiKey',
      'channels.*.botToken',
      'channels.*.token',
    ];

    for (const field of required) {
      expect(SENSITIVE_FIELDS).toContain(field);
    }
  });

  test('has standard workspace files', () => {
    expect(WORKSPACE_FILES.length).toBe(8);
    expect(WORKSPACE_FILES).toEqual([
      'AGENTS.md',
      'MEMORY.md',
      'SOUL.md',
      'IDENTITY.md',
      'USER.md',
      'TOOLS.md',
      'HEARTBEAT.md',
      'BOOTSTRAP.md',
    ]);
  });

  test('has non-empty constant values', () => {
    expect(DEFAULT_CONFIG_PATH).toBe(
      path.join(os.homedir(), '.openclaw', 'openclaw.json')
    );
    expect(APEX_DIR).toBe('apex');
    expect(PRESET_MANIFEST_FILENAME).toBe('preset.json5');

    expect(DEFAULT_CONFIG_PATH).not.toHaveLength(0);
    expect(APEX_DIR).not.toHaveLength(0);
    expect(PRESET_MANIFEST_FILENAME).not.toHaveLength(0);
  });
});
