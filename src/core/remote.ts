import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const GITHUB_OWNER_REPO_REGEX = /^[a-zA-Z0-9._-]+$/;
const TRAILING_SLASH_PATTERN = /\/+$/;

function hasValidGitHubOwnerRepo(owner: string, repo: string): boolean {
  return (
    owner.length > 0 &&
    repo.length > 0 &&
    GITHUB_OWNER_REPO_REGEX.test(owner) &&
    GITHUB_OWNER_REPO_REGEX.test(repo)
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function isPathTraversalAttempt(input: string): boolean {
  return input === '..' || input.startsWith('../') || input.includes('/../');
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (value instanceof Uint8Array) {
    const normalized = new TextDecoder().decode(value).trim();
    return normalized.length > 0 ? normalized : null;
  }
  return null;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'stderr' in error) {
    const stderrText = toNonEmptyString(error.stderr);
    if (stderrText) {
      return stderrText;
    }
  }
  if (error instanceof Error) {
    const messageText = toNonEmptyString(error.message);
    if (messageText) {
      return messageText;
    }
  }

  const stringText = toNonEmptyString(error);
  if (stringText) {
    return stringText;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isGitHubRef(input: string): boolean {
  if (!input) {
    return false;
  }
  if (isPathTraversalAttempt(input)) {
    return false;
  }

  if (input.startsWith('https://github.com/')) {
    return true;
  }

  const parts = input.split('/');
  if (parts.length !== 2) {
    return false;
  }

  const [owner, repo] = parts;
  return owner.length > 0 && repo.length > 0;
}

export function parseGitHubRef(input: string): { owner: string; repo: string } {
  const errorMessage = `Invalid GitHub reference: '${input}'. Expected format: 'owner/repo' or 'https://github.com/owner/repo'`;
  const normalizedInput = input.replace(TRAILING_SLASH_PATTERN, '');

  if (!normalizedInput || isPathTraversalAttempt(normalizedInput)) {
    throw new Error(errorMessage);
  }

  let owner = '';
  let repo = '';

  if (normalizedInput.startsWith('https://github.com/')) {
    const withoutPrefix = normalizedInput.slice('https://github.com/'.length);
    const parts = withoutPrefix.split('/');

    if (parts.length !== 2) {
      throw new Error(errorMessage);
    }

    [owner, repo] = parts;
  } else {
    const parts = normalizedInput.split('/');

    if (parts.length !== 2) {
      throw new Error(errorMessage);
    }

    [owner, repo] = parts;
  }

  if (!(owner && repo)) {
    throw new Error(errorMessage);
  }

  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -'.git'.length);
  }

  if (!(owner && repo)) {
    throw new Error(errorMessage);
  }

  if (!hasValidGitHubOwnerRepo(owner, repo)) {
    throw new Error(errorMessage);
  }

  return { owner, repo };
}

export async function cloneToCache(
  owner: string,
  repo: string,
  presetsDir: string,
  options?: { force?: boolean }
): Promise<string> {
  if (!hasValidGitHubOwnerRepo(owner, repo)) {
    throw new Error(
      `Invalid GitHub owner/repo: '${owner}/${repo}'. Only letters, numbers, '.', '_', and '-' are allowed.`
    );
  }

  const cachePath = path.join(presetsDir, `${owner}--${repo}`);
  const cacheExists = await fs
    .stat(cachePath)
    .then((stats) => stats.isDirectory())
    .catch(() => false);

  if (cacheExists && options?.force !== true) {
    console.log(`Using cached preset: ${owner}/${repo}`);
    return cachePath;
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-remote-'));

  try {
    await withTimeout(
      Bun.$`git clone --depth 1 https://github.com/${owner}/${repo}.git ${tmpDir}`.quiet(),
      30_000
    );
    await fs.rm(path.join(tmpDir, '.git'), { recursive: true, force: true });
    await fs.rm(cachePath, { recursive: true, force: true });
    await fs.rename(tmpDir, cachePath);
    return cachePath;
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    throw new Error(
      `Failed to clone '${owner}/${repo}'. Ensure the repository exists and is public. Details: ${errorMessage}`,
      {
        cause: error,
      }
    );
  } finally {
    await fs
      .rm(tmpDir, { recursive: true, force: true })
      .catch((error: unknown) => {
        if (!(error instanceof Error)) {
          return;
        }
      });
  }
}
