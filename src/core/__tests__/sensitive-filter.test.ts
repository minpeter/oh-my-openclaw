import { describe, expect, test } from 'bun:test';

import { filterSensitiveFields } from '../sensitive-filter';

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
});
