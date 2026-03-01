import fs from 'node:fs/promises';
import path from 'node:path';

import pc from 'picocolors';

const PLIST_PATH = path.join(
  process.env.HOME || '~',
  'Library',
  'LaunchAgents',
  'ai.openclaw.gateway.plist'
);

const NVM_PATTERN = /\/(\.nvm|\.fnm|\.volta)\/[^<]+\/node/;
const NODE_STRING_PATTERN = /<string>([^<]*\/node)<\/string>/;

/**
 * Detect if the LaunchAgent plist uses a version-managed Node path (nvm/fnm/volta)
 * and replace it with the system Homebrew node if available.
 */
export async function fixNodePathIfNeeded(): Promise<void> {
  if (process.platform !== 'darwin') {
    return;
  }

  let plist: string;
  try {
    plist = await fs.readFile(PLIST_PATH, 'utf-8');
  } catch {
    return; // no plist, nothing to fix
  }

  const match = plist.match(NVM_PATTERN);
  if (!match) {
    return;
  }

  // Find system node
  let systemNode: string | null = null;
  for (const candidate of ['/opt/homebrew/bin/node', '/usr/local/bin/node']) {
    try {
      await fs.access(candidate);
      systemNode = candidate;
      break;
    } catch {
      // not found, try next
    }
  }

  if (!systemNode) {
    console.log(
      pc.yellow(
        'Warning: LaunchAgent uses version-managed Node but no system node found.'
      )
    );
    console.log(pc.yellow('Run: brew install node'));
    return;
  }

  const oldPath = plist.match(NODE_STRING_PATTERN)?.[1];
  if (!oldPath || oldPath === systemNode) {
    return;
  }

  const updated = plist.replace(oldPath, systemNode);
  await fs.writeFile(PLIST_PATH, updated, 'utf-8');
  console.log(
    pc.green(`OK Node path fixed: ${pc.dim(oldPath)} → ${systemNode}`)
  );
}
