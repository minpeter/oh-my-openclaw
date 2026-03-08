import os from 'node:os';
import path from 'node:path';

export const SENSITIVE_FIELDS = [
  'auth',
  'env',
  'meta',
  'gateway.auth',
  'hooks.token',
  'models.providers.**.apiKey',
  'channels.*.botToken',
  'channels.*.token',
  '**.apiKey',
  '**.apiSecret',
  '**.secretKey',
  '**.accessToken',
  '**.refreshToken',
  'hooks.**.token',
  'brave.apiKey',
  'tools.**.apiKey',
  'tools.**.token',
  'tools.**.secret',
] as const;

/**
 * Config paths that should not be overwritten by preset apply
 * when the user has already set them. This prevents silent model
 * drift when applying a preset to an existing configuration.
 */
export const PRESERVE_IF_SET_FIELDS = [
  'agents.defaults.model.primary',
  'agents.defaults.model.secondary',
  'agents.defaults.model.fast',
] as const;

export const WORKSPACE_FILES = [
  'AGENTS.md',
  'MEMORY.md',
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

export const APEX_DIR = 'apex';
export const PRESET_MANIFEST_FILENAME = 'preset.json5';
