import { spawn } from 'node:child_process';

const ALREADY_INSTALLED_PATTERN = /plugin already exists:/i;
const INVALID_PLUGIN_NAME_PATTERN = /\s/;

export interface OpenClawCommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export type OpenClawCommandExecutor = (
  command: string[]
) => Promise<OpenClawCommandResult>;

function isErrnoCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (error as { code?: unknown }).code === code;
}

function validatePluginName(name: string): void {
  if (
    !name ||
    name.trim().length === 0 ||
    INVALID_PLUGIN_NAME_PATTERN.test(name)
  ) {
    throw new Error(
      `Invalid OpenClaw plugin name '${name}'. Plugin names must not be empty or contain whitespace.`
    );
  }
}

async function execCommand(command: string[]): Promise<OpenClawCommandResult> {
  const [file, ...args] = command;
  if (!file) {
    throw new Error('Command must not be empty');
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stderr: stderr.trim(),
        stdout: stdout.trim(),
      });
    });
  });
}

let commandExecutor: OpenClawCommandExecutor = execCommand;

export function setOpenClawCommandExecutorForTests(
  executor?: OpenClawCommandExecutor
): void {
  commandExecutor = executor ?? execCommand;
}

export async function installOpenClawPlugins(
  plugins: string[]
): Promise<string[]> {
  const uniquePlugins = [...new Set(plugins)];
  const installed: string[] = [];

  for (const plugin of uniquePlugins) {
    validatePluginName(plugin);

    try {
      const { exitCode, stderr, stdout } = await commandExecutor([
        'openclaw',
        'plugins',
        'install',
        plugin,
      ]);

      if (exitCode !== 0) {
        const detail = stderr || stdout;
        if (ALREADY_INSTALLED_PATTERN.test(detail)) {
          installed.push(plugin);
          continue;
        }

        throw new Error(
          `Failed to install OpenClaw plugin '${plugin}'${detail ? `: ${detail}` : ''}`
        );
      }
    } catch (error) {
      if (isErrnoCode(error, 'ENOENT')) {
        throw new Error(
          "OpenClaw CLI ('openclaw') is not installed or not in PATH. Install OpenClaw before applying presets that auto-install plugins."
        );
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        `Failed to install OpenClaw plugin '${plugin}': ${String(error)}`
      );
    }

    installed.push(plugin);
  }

  return installed;
}

export async function runOpenClawMemoryIndex(): Promise<void> {
  try {
    const { exitCode, stderr, stdout } = await commandExecutor([
      'openclaw',
      'memory',
      'index',
    ]);

    if (exitCode !== 0) {
      const detail = stderr || stdout;
      throw new Error(
        `Failed to run 'openclaw memory index'${detail ? `: ${detail}` : ''}`
      );
    }
  } catch (error) {
    if (isErrnoCode(error, 'ENOENT')) {
      throw new Error(
        "OpenClaw CLI ('openclaw') is not installed or not in PATH. Install OpenClaw before applying presets that bootstrap memory indexing."
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`Failed to run 'openclaw memory index': ${String(error)}`);
  }
}
