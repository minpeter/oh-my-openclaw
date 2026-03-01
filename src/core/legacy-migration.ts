/**
 * Post-merge legacy key migration.
 *
 * OpenClaw periodically moves config keys to new locations. When a preset
 * writes a key at the old (legacy) location the merged config will contain
 * it, which triggers doctor warnings or — worse — gateway crash-loops.
 *
 * This module mirrors the relevant OpenClaw migration rules so that the
 * `apply` command always produces a config in the *current* schema, no
 * matter how the preset author structured the override.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface MigrationResult {
  applied: string[];
  config: Record<string, unknown>;
}

/**
 * Migrate known legacy keys in a merged config object.
 * Returns a new object (never mutates the input).
 */
export function migrateLegacyKeys(
  config: Record<string, unknown>
): MigrationResult {
  const result: Record<string, unknown> = structuredClone(config);
  const applied: string[] = [];

  // identity → agents.list[].identity
  if (isPlainObject(result.identity)) {
    const agents: Record<string, unknown> = isPlainObject(result.agents)
      ? { ...result.agents }
      : { defaults: {}, list: [] };

    const list: Record<string, unknown>[] = Array.isArray(agents.list)
      ? (agents.list as unknown[]).filter(isPlainObject)
      : [];

    // Find or create the default agent entry
    let entry = list.find(
      (item) => item.default === true || item.id === 'main'
    );

    if (!entry) {
      entry = { id: 'main' };
      list.unshift(entry);
    }

    if (isPlainObject(entry.identity)) {
      applied.push('identity removed (agents.list[].identity already set)');
    } else {
      entry.identity = result.identity;
      applied.push('identity → agents.list[].identity');
    }

    agents.list = list;
    result.agents = agents;
    delete result.identity;
  }

  return { config: result, applied };
}
