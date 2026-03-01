import os from 'node:os';
import path from 'node:path';

export const SENSITIVE_FIELDS = [
  'auth',
  'env',
  'meta',
  'gateway.auth',
  'hooks.token',
  'models.providers.*.apiKey',
  'channels.*.botToken',
  'channels.*.token',
] as const;

export const WORKSPACE_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'IDENTITY.md',
  'USER.md',
  'TOOLS.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
] as const;

export const DEFAULT_CONFIG_PATH = path.join(
  os.homedir(),
  '.openclaw',
  'openclaw.json'
);

export const OH_MY_OPENCLAW_DIR = 'oh-my-openclaw';
export const PRESET_MANIFEST_FILENAME = 'preset.json5';
