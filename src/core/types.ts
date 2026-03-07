export interface OpenClawBootstrapOptions {
  memoryIndex?: boolean;
}

export interface PresetManifest {
  author?: string;
  builtin?: boolean;
  config?: Record<string, unknown>;
  description: string;
  name: string;
  openclawBootstrap?: OpenClawBootstrapOptions;
  openclawPlugins?: string[];
  skills?: string[];
  tags?: string[];
  version: string;
  workspaceFiles?: string[];
}

export interface ResolvedPaths {
  backupsDir: string;
  configPath: string;
  presetsDir: string;
  stateDir: string;
  workspaceDir: string;
}

export interface ConfigSnapshot {
  parsed: Record<string, unknown>;
  path: string;
  raw: string;
}
