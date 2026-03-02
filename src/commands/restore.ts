import path from 'node:path';

import pc from 'picocolors';

import { listBackups, restoreBackup } from '../core/backup';
import { resolveOpenClawPaths } from '../core/config-path';

interface RestoreOptions {
  backup?: string;
  list?: boolean;
}

const BACKUP_FILENAME_PATTERN =
  /openclaw\.json\.(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.bak$/;
const TIMESTAMP_SEPARATOR_PATTERN =
  /(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3}Z)/;

function parseTimestamp(filename: string): string {
  const match = filename.match(BACKUP_FILENAME_PATTERN);
  if (!match) {
    return filename;
  }
  const isoString = match[1].replace(
    TIMESTAMP_SEPARATOR_PATTERN,
    '$1:$2:$3.$4'
  );
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return filename;
  }
  return date.toLocaleString();
}

async function listAvailableBackups(backupsDir: string): Promise<void> {
  const backups = await listBackups(backupsDir);

  if (backups.length === 0) {
    console.log(pc.dim('No backups found.'));
    return;
  }

  console.log(pc.bold('Available backups:\n'));

  for (const backupPath of backups) {
    const filename = path.basename(backupPath);
    const timestamp = parseTimestamp(filename);
    console.log(`  ${pc.bold(filename)}`);
    console.log(`    ${pc.dim(timestamp)}`);
    console.log();
  }

  console.log(
    pc.dim(`${backups.length} backup(s) found. Newest listed first.`)
  );
}

async function restoreByName(
  backupsDir: string,
  configPath: string,
  backupName: string
): Promise<void> {
  const backups = await listBackups(backupsDir);
  const match = backups.find(
    (backupPath) => path.basename(backupPath) === backupName
  );

  if (!match) {
    throw new Error(
      `Backup '${backupName}' not found. Run 'apex restore --list' to see available backups.`
    );
  }

  await restoreBackup(match, configPath);
  console.log(pc.green(`Restored from: ${backupName}`));
  console.log(
    pc.bold(pc.yellow("Run 'openclaw gateway restart' to activate changes."))
  );
}

async function restoreLatest(
  backupsDir: string,
  configPath: string
): Promise<void> {
  const backups = await listBackups(backupsDir);

  if (backups.length === 0) {
    throw new Error(
      "No backups available. Run 'apex apply' first to create a backup."
    );
  }

  const latest = backups[0];
  const filename = path.basename(latest);

  await restoreBackup(latest, configPath);
  console.log(pc.green(`Restored from: ${filename}`));
  console.log(
    pc.bold(pc.yellow("Run 'openclaw gateway restart' to activate changes."))
  );
}

export async function restoreCommand(
  options: RestoreOptions = {}
): Promise<void> {
  const paths = await resolveOpenClawPaths();

  if (options.list) {
    await listAvailableBackups(paths.backupsDir);
    return;
  }

  if (options.backup) {
    await restoreByName(paths.backupsDir, paths.configPath, options.backup);
    return;
  }

  await restoreLatest(paths.backupsDir, paths.configPath);
}
