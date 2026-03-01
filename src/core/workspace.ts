import fs from 'node:fs/promises';
import path from 'node:path';
import { WORKSPACE_FILES } from './constants';

// Reads agents.defaults.workspace from parsed config, falls back to {stateDir}/workspace
export function resolveWorkspaceDir(
  config: Record<string, unknown>,
  stateDir: string
): string {
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const workspace = defaults?.workspace as string | undefined;
  return workspace ?? path.join(stateDir, 'workspace');
}

// Returns list of existing MD files from WORKSPACE_FILES constant
export async function listWorkspaceFiles(
  workspaceDir: string
): Promise<string[]> {
  const existing: string[] = [];
  for (const filename of WORKSPACE_FILES) {
    const filePath = path.join(workspaceDir, filename);
    try {
      await fs.access(filePath);
      existing.push(filename);
    } catch {
      // File doesn't exist, skip
    }
  }
  return existing;
}

// Copies specified MD files from src to dest directory
export async function copyWorkspaceFiles(
  srcDir: string,
  destDir: string,
  files: string[]
): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  for (const filename of files) {
    const src = path.join(srcDir, filename);
    const dest = path.join(destDir, filename);
    await fs.copyFile(src, dest);
  }
}

// Copies current workspace MD files into preset directory, returns list of copied files
export async function exportWorkspaceFiles(
  workspaceDir: string,
  presetDir: string
): Promise<string[]> {
  const existingFiles = await listWorkspaceFiles(workspaceDir);
  if (existingFiles.length > 0) {
    await copyWorkspaceFiles(workspaceDir, presetDir, existingFiles);
  }
  return existingFiles;
}
