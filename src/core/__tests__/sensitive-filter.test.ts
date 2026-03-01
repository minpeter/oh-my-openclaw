import { describe, expect, test } from 'bun:test';

import { filterSensitiveFields, isSensitivePath } from '../sensitive-filter';

describe('filterSensitiveFields', () => {
  test('removes top-level auth, env, and meta keys', () => {
    const config = {
      auth: { token: 'secret' },
      env: { API_KEY: 'secret' },
      meta: { version: '1.0.0' },
      identity: { name: 'Bot' },
    };

    const filtered = filterSensitiveFields(config);

    expect(filtered).toEqual({
      identity: { name: 'Bot' },
    });
  });

  test('removes gateway.auth and keeps gateway.port', () => {
    const config = {
      gateway: {
        port: 18_789,
        auth: { token: 'gateway-secret' },
      },
    };

    const filtered = filterSensitiveFields(config);

    expect(filtered).toEqual({
      gateway: {
        port: 18_789,
      },
    });
  });

  test('removes channels.discord.token and keeps channels.discord.guilds', () => {
    const config = {
      channels: {
        discord: {
          token: 'discord-secret',
          guilds: {
            '123': { name: 'Guild' },
          },
        },
      },
    };

    const filtered = filterSensitiveFields(config);

    expect(filtered).toEqual({
      channels: {
        discord: {
          guilds: {
            '123': { name: 'Guild' },
          },
        },
      },
    });
  });

  test('removes models.providers.custom.apiKey and keeps baseUrl', () => {
    const config = {
      models: {
        providers: {
          custom: {
            apiKey: 'provider-secret',
            baseUrl: 'https://api.example.com',
          },
        },
      },
    };

    const filtered = filterSensitiveFields(config);

    expect(filtered).toEqual({
      models: {
        providers: {
          custom: {
            baseUrl: 'https://api.example.com',
          },
        },
      },
    });
  });

  test('does not mutate input object', () => {
    const config = {
      auth: {
        profiles: {
          'anthropic:key': {},
        },
      },
      gateway: {
        port: 18_789,
        auth: {
          token: 'gw-secret',
        },
      },
      channels: {
        discord: {
          token: 'discord-secret',
          guilds: {
            '123': {},
          },
        },
      },
      models: {
        providers: {
          custom: {
            apiKey: 'secret',
            baseUrl: 'https://api.example.com',
          },
        },
      },
    };

    const original = structuredClone(config);
    const filtered = filterSensitiveFields(config);

    expect(config).toEqual(original);
    expect(filtered).not.toBe(config);
    expect(filtered).toEqual({
      gateway: { port: 18_789 },
      channels: { discord: { guilds: { '123': {} } } },
      models: { providers: { custom: { baseUrl: 'https://api.example.com' } } },
    });
  });

  describe('isSensitivePath', () => {
    test('matches top-level auth path', () => {
      expect(isSensitivePath(['auth'])).toBe(true);
    });

    test('matches top-level env path', () => {
      expect(isSensitivePath(['env'])).toBe(true);
    });

    test('matches top-level meta path', () => {
      expect(isSensitivePath(['meta'])).toBe(true);
    });

    test('matches gateway.auth path', () => {
      expect(isSensitivePath(['gateway', 'auth'])).toBe(true);
    });

    test('matches hooks.token path', () => {
      expect(isSensitivePath(['hooks', 'token'])).toBe(true);
    });

    test('matches models.providers.*.apiKey with any provider name', () => {
      expect(isSensitivePath(['models', 'providers', 'openai', 'apiKey'])).toBe(
        true
      );
      expect(
        isSensitivePath(['models', 'providers', 'anthropic', 'apiKey'])
      ).toBe(true);
      expect(isSensitivePath(['models', 'providers', 'custom', 'apiKey'])).toBe(
        true
      );
    });

    test('matches channels.*.botToken with any channel name', () => {
      expect(isSensitivePath(['channels', 'discord', 'botToken'])).toBe(true);
      expect(isSensitivePath(['channels', 'slack', 'botToken'])).toBe(true);
    });

    test('matches channels.*.token with any channel name', () => {
      expect(isSensitivePath(['channels', 'discord', 'token'])).toBe(true);
      expect(isSensitivePath(['channels', 'telegram', 'token'])).toBe(true);
    });

    test('does not match non-sensitive paths', () => {
      expect(isSensitivePath(['identity'])).toBe(false);
      expect(isSensitivePath(['tools'])).toBe(false);
      expect(isSensitivePath(['gateway', 'port'])).toBe(false);
      expect(
        isSensitivePath(['models', 'providers', 'openai', 'baseUrl'])
      ).toBe(false);
    });

    test('does not match paths with wrong length', () => {
      // 'auth' pattern is length 1, so ['auth', 'profiles'] should not match 'auth'
      // but it also should not match 'gateway.auth' which is length 2
      expect(isSensitivePath(['auth', 'profiles'])).toBe(false);
      expect(isSensitivePath(['gateway'])).toBe(false);
    });

    test('returns false for empty path', () => {
      expect(isSensitivePath([])).toBe(false);
    });
  });

  describe('filterSensitiveFields edge cases', () => {
    test('removes hooks.token from config', () => {
      const config = {
        hooks: {
          token: 'hook-secret',
          url: 'https://hooks.example.com',
        },
      };

      const filtered = filterSensitiveFields(config);

      expect(filtered).toEqual({
        hooks: {
          url: 'https://hooks.example.com',
        },
      });
    });

    test('removes channels.*.botToken from config', () => {
      const config = {
        channels: {
          discord: {
            botToken: 'bot-secret',
            guilds: { '123': {} },
          },
        },
      };

      const filtered = filterSensitiveFields(config);

      expect(filtered).toEqual({
        channels: {
          discord: {
            guilds: { '123': {} },
          },
        },
      });
    });

    test('returns empty object for empty config', () => {
      expect(filterSensitiveFields({})).toEqual({});
    });

    test('clones array values (no shared references)', () => {
      const config = {
        tools: { allow: ['read', 'write'] },
      };

      const filtered = filterSensitiveFields(config);

      expect(filtered).toEqual({ tools: { allow: ['read', 'write'] } });
      // Verify it's a different array instance
      expect((filtered.tools as Record<string, unknown>).allow).not.toBe(
        config.tools.allow
      );
    });

    test('handles deeply nested non-sensitive paths without removal', () => {
      const config = {
        deeply: {
          nested: {
            safe: {
              value: 'keep-me',
            },
          },
        },
      };

      const filtered = filterSensitiveFields(config);

      expect(filtered).toEqual(config);
    });
  });
});
