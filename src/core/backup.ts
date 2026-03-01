import fs from 'node:fs/promises';
import path from 'node:path';

export async function createBackup(
  configPath: string,
  backupsDir: string
): Promise<string> {
  await fs.mkdir(backupsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `openclaw.json.${timestamp}.bak`;
  const backupPath = path.join(backupsDir, backupFilename);
  await fs.copyFile(configPath, backupPath);
  return backupPath;
}

export async function createWorkspaceBackup(
  workspaceDir: string,
  backupsDir: string,
  files: string[]
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupSubDir = path.join(backupsDir, `workspace.${timestamp}`);
  await fs.mkdir(backupSubDir, { recursive: true });

  for (const filename of files) {
    const src = path.join(workspaceDir, filename);
    const dest = path.join(backupSubDir, filename);

    try {
      await fs.copyFile(src, dest);
    } catch {}
  }

  return backupSubDir;
}

export async function listBackups(backupsDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(backupsDir);
    const backups = entries
      .filter((entry) => entry.endsWith('.bak'))
      .sort()
      .reverse();
    return backups.map((backup) => path.join(backupsDir, backup));
  } catch {
    return [];
  }
}

export async function restoreBackup(
  backupPath: string,
  configPath: string
): Promise<void> {
  await fs.copyFile(backupPath, configPath);
}
