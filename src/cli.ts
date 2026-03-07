#!/usr/bin/env bun

import { Command } from 'commander';
import packageJson from '../package.json';
import { applyCommand } from './commands/apply';
import { diffCommand } from './commands/diff';
import { exportCommand } from './commands/export';
import { listCommand } from './commands/list';
import { restoreCommand } from './commands/restore';
import { uploadCommand } from './commands/upload';

const program = new Command();

program
  .name('apex')
  .description('OpenClaw configuration preset manager')
  .version(packageJson.version);

program
  .command('list')
  .description('List available presets')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    try {
      await listCommand({ json: options.json });
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  });

program
  .command('apply')
  .description('Apply a preset to your OpenClaw configuration')
  .argument('<preset>', 'Preset name to apply')
  .option('--dry-run', 'Show what would change without applying')
  .option('--verbose', 'Enable detailed operation logging')
  .option('--no-backup', 'Skip creating a backup (use with caution)')
  .option(
    '--clean',
    'Remove existing config and workspace files before applying (clean install)'
  )
  .option('--force', 'Re-download remote preset even if cached')
  .action(
    async (
      preset: string,
      options: {
        dryRun?: boolean;
        verbose?: boolean;
        backup?: boolean;
        clean?: boolean;
        force?: boolean;
      }
    ) => {
      try {
        await applyCommand(preset, {
          dryRun: options.dryRun,
          verbose: options.verbose,
          noBackup: !options.backup,
          clean: options.clean,
          force: options.force,
        });
      } catch (err) {
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`
        );
        process.exit(1);
      }
    }
  );

program
  .command('export')
  .description('Export current OpenClaw configuration as a preset')
  .argument('<name>', 'Name for the new preset')
  .option('--description <desc>', 'Preset description')
  .option('--version <ver>', 'Preset version', '1.0.0')
  .option('--verbose', 'Enable detailed operation logging')
  .option('--force', 'Overwrite existing preset')
  .action(
    async (
      name: string,
      options: {
        description?: string;
        version: string;
        verbose?: boolean;
        force?: boolean;
      }
    ) => {
      try {
        await exportCommand(name, {
          description: options.description,
          version: options.version,
          verbose: options.verbose,
          force: options.force,
        });
      } catch (err) {
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`
        );
        process.exit(1);
      }
    }
  );

program
  .command('diff')
  .description('Show diff between current config and a preset')
  .argument('<preset>', 'Preset name to compare against')
  .option('--json', 'Output as JSON')
  .option('--verbose', 'Enable detailed operation logging')
  .action(
    async (preset: string, options: { json?: boolean; verbose?: boolean }) => {
      try {
        await diffCommand(preset, {
          json: options.json,
          verbose: options.verbose,
        });
      } catch (err) {
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`
        );
        process.exit(1);
      }
    }
  );

program
  .command('install')
  .description('Install the apex preset (shortcut for: apply apex)')
  .option('--dry-run', 'Show what would change without applying')
  .option('--verbose', 'Enable detailed operation logging')
  .option('--no-backup', 'Skip creating a backup (use with caution)')
  .option(
    '--clean',
    'Remove existing config and workspace files before applying (clean install)'
  )
  .action(
    async (options: {
      dryRun?: boolean;
      verbose?: boolean;
      backup?: boolean;
      clean?: boolean;
    }) => {
      try {
        await applyCommand('apex', {
          dryRun: options.dryRun,
          verbose: options.verbose,
          noBackup: !options.backup,
          clean: options.clean,
        });
      } catch (err) {
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`
        );
        process.exit(1);
      }
    }
  );

program
  .command('restore')
  .description('Restore OpenClaw configuration from a backup')
  .option('--list', 'List available backups sorted by date')
  .option('--backup <name>', 'Restore a specific backup by filename')
  .action(async (options: { list?: boolean; backup?: string }) => {
    try {
      await restoreCommand({
        list: options.list,
        backup: options.backup,
      });
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  });

program
  .command('upload')
  .description('Upload workspace files to a GitHub repo as a preset')
  .argument('<github-repo>', 'GitHub repository (e.g., owner/repo)')
  .option('--create', 'Create the repository if it does not exist')
  .option('--force', 'Force-push to main (dangerous: rewrites history)')
  .option('--private', 'Make the repository private (used with --create)')
  .option('--description <desc>', 'Repository description (used with --create)')
  .action(
    async (
      githubRepo: string,
      options: {
        create?: boolean;
        force?: boolean;
        private?: boolean;
        description?: string;
      }
    ) => {
      try {
        await uploadCommand(githubRepo, {
          create: options.create,
          force: options.force,
          private: options.private,
          description: options.description,
        });
      } catch (err) {
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`
        );
        process.exit(1);
      }
    }
  );

program.parse();
