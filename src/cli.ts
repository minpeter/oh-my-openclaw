#!/usr/bin/env bun

import { Command } from 'commander';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCommand } from './commands/apply';
import { diffCommand } from './commands/diff';
import { exportCommand } from './commands/export';
import { listCommand } from './commands/list';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require(join(__dirname, '..', 'package.json')) as { version: string };

const program = new Command();

program
  .name('oh-my-openclaw')
  .description('OpenClaw configuration preset manager')
  .version(pkg.version);

program
  .command('list')
  .description('List available presets')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    try {
      await listCommand({ json: options.json });
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command('apply')
  .description('Apply a preset to your OpenClaw configuration')
  .argument('<preset>', 'Preset name to apply')
  .option('--dry-run', 'Show what would change without applying')
  .option('--no-backup', 'Skip creating a backup (use with caution)')
  .option('--clean', 'Remove existing config and workspace files before applying (clean install)')
  .action(async (preset: string, options: { dryRun?: boolean; backup?: boolean; clean?: boolean }) => {
    try {
      await applyCommand(preset, {
        dryRun: options.dryRun,
        noBackup: !options.backup,
        clean: options.clean,
      });
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('Export current OpenClaw configuration as a preset')
  .argument('<name>', 'Name for the new preset')
  .option('--description <desc>', 'Preset description')
  .option('--version <ver>', 'Preset version', '1.0.0')
  .option('--force', 'Overwrite existing preset')
  .action(
    async (
      name: string,
      options: { description?: string; version: string; force?: boolean },
    ) => {
      try {
        await exportCommand(name, {
          description: options.description,
          version: options.version,
          force: options.force,
        });
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    },
  );

program
  .command('diff')
  .description('Show diff between current config and a preset')
  .argument('<preset>', 'Preset name to compare against')
  .option('--json', 'Output as JSON')
  .action(async (preset: string, options: { json?: boolean }) => {
    try {
      await diffCommand(preset, { json: options.json });
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command('install')
  .description('Install the apex preset (shortcut for: apply apex)')
  .option('--dry-run', 'Show what would change without applying')
  .option('--no-backup', 'Skip creating a backup (use with caution)')
  .option('--clean', 'Remove existing config and workspace files before applying (clean install)')
  .action(async (options: { dryRun?: boolean; backup?: boolean; clean?: boolean }) => {
    try {
      await applyCommand('apex', {
        dryRun: options.dryRun,
        noBackup: !options.backup,
        clean: options.clean,
      });
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parse();
