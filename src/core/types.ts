export interface PresetManifest {
  name: string;
  description: string;
  version: string;
  author?: string;
  tags?: string[];
  builtin?: boolean;
  config?: Record<string, unknown>;
  workspaceFiles?: string[];
  skills?: string[];
}

export interface ResolvedPaths {
  configPath: string;
  stateDir: string;
  workspaceDir: string;
  presetsDir: string;
  backupsDir: string;
}

export interface ConfigSnapshot {
  raw: string;
  parsed: Record<string, unknown>;
  path: string;
}
