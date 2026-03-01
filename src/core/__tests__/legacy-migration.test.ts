import { describe, expect, test } from 'bun:test';

import { migrateLegacyKeys } from '../legacy-migration';

describe('migrateLegacyKeys', () => {
  test('migrates top-level identity to agents.list[].identity', () => {
    const config = {
      identity: { name: 'MyBot', emoji: '🤖' },
      tools: { allow: ['read'] },
    };

    const result = migrateLegacyKeys(config);

    expect(result.applied).toContain('identity → agents.list[].identity');
    expect(result.config.identity).toBeUndefined();
    expect(result.config.agents).toEqual({
      defaults: {},
      list: [{ id: 'main', identity: { name: 'MyBot', emoji: '🤖' } }],
    });
    expect(result.config.tools).toEqual({ allow: ['read'] });
  });

  test('returns empty applied list when no identity key exists', () => {
    const config = {
      tools: { allow: ['read'] },
      agents: { defaults: { temperature: 0.5 } },
    };

    const result = migrateLegacyKeys(config);

    expect(result.applied).toEqual([]);
    expect(result.config).toEqual(config);
  });

  test('does not mutate the input config', () => {
    const config = Object.freeze({
      identity: Object.freeze({ name: 'Bot' }),
      tools: Object.freeze({ allow: Object.freeze(['read']) }),
    });

    expect(() => migrateLegacyKeys(config)).not.toThrow();
    expect(config.identity).toEqual({ name: 'Bot' });
  });

  test('returns unchanged config when config is empty', () => {
    const result = migrateLegacyKeys({});

    expect(result.applied).toEqual([]);
    expect(result.config).toEqual({});
  });

  test('preserves existing agents.list entries and prepends main', () => {
    const config = {
      identity: { name: 'NewBot' },
      agents: {
        defaults: { temperature: 0.7 },
        list: [{ id: 'secondary', identity: { name: 'Helper' } }],
      },
    };

    const result = migrateLegacyKeys(config);

    const list = result.config.agents as Record<string, unknown>;
    const agentsList = list.list as Record<string, unknown>[];
    expect(agentsList).toHaveLength(2);
    expect(agentsList[0]).toEqual({
      id: 'main',
      identity: { name: 'NewBot' },
    });
    expect(agentsList[1]).toEqual({
      id: 'secondary',
      identity: { name: 'Helper' },
    });
  });

  test('uses existing main entry instead of creating a new one', () => {
    const config = {
      identity: { name: 'NewBot' },
      agents: {
        defaults: {},
        list: [{ id: 'main', model: 'gpt-4' }],
      },
    };

    const result = migrateLegacyKeys(config);

    const list = result.config.agents as Record<string, unknown>;
    const agentsList = list.list as Record<string, unknown>[];
    expect(agentsList).toHaveLength(1);
    expect(agentsList[0]).toEqual({
      id: 'main',
      model: 'gpt-4',
      identity: { name: 'NewBot' },
    });
  });

  test('skips migration when agents.list[].identity already set on main entry', () => {
    const config = {
      identity: { name: 'OverrideBot' },
      agents: {
        defaults: {},
        list: [{ id: 'main', identity: { name: 'ExistingBot' } }],
      },
    };

    const result = migrateLegacyKeys(config);

    expect(result.applied).toContain(
      'identity removed (agents.list[].identity already set)'
    );
    const list = result.config.agents as Record<string, unknown>;
    const agentsList = list.list as Record<string, unknown>[];
    expect(agentsList[0].identity).toEqual({ name: 'ExistingBot' });
    expect(result.config.identity).toBeUndefined();
  });

  test('uses default=true entry as main agent', () => {
    const config = {
      identity: { name: 'DefaultBot' },
      agents: {
        defaults: {},
        list: [{ id: 'custom', default: true }],
      },
    };

    const result = migrateLegacyKeys(config);

    const list = result.config.agents as Record<string, unknown>;
    const agentsList = list.list as Record<string, unknown>[];
    expect(agentsList).toHaveLength(1);
    expect(agentsList[0]).toEqual({
      id: 'custom',
      default: true,
      identity: { name: 'DefaultBot' },
    });
  });

  test('creates agents structure when agents key is not an object', () => {
    const config = {
      identity: { name: 'Bot' },
      agents: 'invalid',
    };

    const result = migrateLegacyKeys(
      config as unknown as Record<string, unknown>
    );

    expect(result.config.identity).toBeUndefined();
    const agents = result.config.agents as Record<string, unknown>;
    expect(agents.defaults).toEqual({});
    const agentsList = agents.list as Record<string, unknown>[];
    expect(agentsList[0]).toEqual({ id: 'main', identity: { name: 'Bot' } });
  });

  test('skips non-object identity values', () => {
    const config = {
      identity: 'not-an-object',
      tools: { allow: ['read'] },
    };

    const result = migrateLegacyKeys(
      config as unknown as Record<string, unknown>
    );

    // identity is a string, not a plain object — migration should not trigger
    expect(result.applied).toEqual([]);
    expect(result.config.identity).toBe('not-an-object');
  });

  test('filters non-object entries from agents.list', () => {
    const config = {
      identity: { name: 'Bot' },
      agents: {
        defaults: {},
        list: ['invalid-entry', 42, { id: 'valid', model: 'gpt-4' }],
      },
    };

    const result = migrateLegacyKeys(
      config as unknown as Record<string, unknown>
    );

    const agents = result.config.agents as Record<string, unknown>;
    const agentsList = agents.list as Record<string, unknown>[];
    // Should filter out non-object entries and prepend main
    expect(agentsList).toHaveLength(2);
    expect(agentsList[0]).toEqual({ id: 'main', identity: { name: 'Bot' } });
    expect(agentsList[1]).toEqual({ id: 'valid', model: 'gpt-4' });
  });
});
