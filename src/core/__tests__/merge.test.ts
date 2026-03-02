import { describe, expect, test } from 'bun:test';

import { deepMerge } from '../merge';

describe('deepMerge', () => {
  test('simple scalar override', () => {
    const result = deepMerge({ a: 1 }, { a: 2 });

    expect(result).toEqual({ a: 2 });
  });

  test('nested object merge', () => {
    const result = deepMerge({ a: { b: 1, c: 2 } }, { a: { b: 3 } });

    expect(result).toEqual({ a: { b: 3, c: 2 } });
  });

  test('array replacement (not append)', () => {
    const result = deepMerge({ a: [1, 2] }, { a: [3, 4, 5] });

    expect(result).toEqual({ a: [3, 4, 5] });
  });

  test('null deletes key', () => {
    const result = deepMerge({ a: 1, b: 2 }, { a: null });

    expect(result).toEqual({ b: 2 });
    expect('a' in result).toBe(false);
  });

  test('undefined preserves base value', () => {
    const result = deepMerge({ a: 1 }, { a: undefined });

    expect(result).toEqual({ a: 1 });
  });

  test('override adds new key not in base', () => {
    const result = deepMerge({ a: 1 }, { b: 2 });

    expect(result).toEqual({ a: 1, b: 2 });
  });

  test('base key not in override stays untouched', () => {
    const result = deepMerge({ a: 1, b: 2 }, { a: 3 });

    expect(result).toEqual({ a: 3, b: 2 });
  });

  test('3-level deep merge', () => {
    const result = deepMerge(
      { a: { b: { c: 1, d: 2 } } },
      { a: { b: { c: 99 } } }
    );

    expect(result).toEqual({ a: { b: { c: 99, d: 2 } } });
  });

  test('inputs are never mutated with frozen objects', () => {
    const base = Object.freeze({
      a: Object.freeze({ b: 1 }),
      arr: Object.freeze([1, 2]),
    });
    const override = Object.freeze({
      a: Object.freeze({ b: 2 }),
      arr: Object.freeze([3]),
      skip: undefined,
    });

    expect(() => deepMerge(base, override)).not.toThrow();
    expect(base).toEqual({ a: { b: 1 }, arr: [1, 2] });
    expect(override).toEqual({ a: { b: 2 }, arr: [3], skip: undefined });
  });

  test('mixed scenario merges nested object and replaces array', () => {
    const result = deepMerge(
      {
        identity: { name: 'Bot', emoji: '🦞' },
        tools: { allow: ['read'] },
      },
      {
        identity: { name: 'DevBot' },
        tools: { allow: ['read', 'write', 'exec'] },
      }
    );

    expect(result).toEqual({
      identity: { name: 'DevBot', emoji: '🦞' },
      tools: { allow: ['read', 'write', 'exec'] },
    });
  });

  test('empty base + empty override returns empty object', () => {
    const result = deepMerge({}, {});

    expect(result).toEqual({});
  });

  test('empty base + populated override returns override values', () => {
    const result = deepMerge({}, { a: 1, b: { c: 2 } });

    expect(result).toEqual({ a: 1, b: { c: 2 } });
  });

  test('populated base + empty override returns base values', () => {
    const result = deepMerge({ a: 1, b: { c: 2 } }, {});

    expect(result).toEqual({ a: 1, b: { c: 2 } });
  });

  test('override replaces object with scalar', () => {
    const result = deepMerge({ a: { nested: 'object' } }, { a: 'scalar' });

    expect(result).toEqual({ a: 'scalar' });
  });

  test('override replaces scalar with object', () => {
    const result = deepMerge({ a: 'scalar' }, { a: { nested: 'object' } });

    expect(result).toEqual({ a: { nested: 'object' } });
  });

  test('override replaces array with object', () => {
    const result = deepMerge({ a: [1, 2, 3] }, { a: { key: 'value' } });

    expect(result).toEqual({ a: { key: 'value' } });
  });

  test('override replaces object with array', () => {
    const result = deepMerge({ a: { key: 'value' } }, { a: [1, 2, 3] });

    expect(result).toEqual({ a: [1, 2, 3] });
  });

  test('nested null deletes deep key', () => {
    const result = deepMerge(
      { a: { b: 1, c: { d: 2, e: 3 } } },
      { a: { c: { d: null } } }
    );

    expect(result).toEqual({ a: { b: 1, c: { e: 3 } } });
    expect(
      'd' in
        ((result.a as Record<string, unknown>).c as Record<string, unknown>)
    ).toBe(false);
  });

  test('mixed null + valid values in same override level', () => {
    const result = deepMerge({ a: 1, b: 2, c: 3 }, { a: null, b: 99, d: 4 });

    expect(result).toEqual({ b: 99, c: 3, d: 4 });
    expect('a' in result).toBe(false);
  });

  test('null on non-existent key is a no-op (nothing to delete)', () => {
    const result = deepMerge({ a: 1 }, { nonExistent: null });

    expect(result).toEqual({ a: 1 });
    expect('nonExistent' in result).toBe(false);
  });

  test('null keys are stripped when adding a new nested object branch', () => {
    const result = deepMerge(
      {},
      { agents: { defaults: { tools: null, model: { primary: 'x' } } } }
    );

    expect(result).toEqual({
      agents: {
        defaults: {
          model: { primary: 'x' },
        },
      },
    });
    expect(result).not.toHaveProperty('agents.defaults.tools');
  });

  test('new branch with tombstones only is treated as no-op', () => {
    const result = deepMerge({}, { agents: { defaults: { tools: null } } });

    expect(result).toEqual({});
    expect(result).not.toHaveProperty('agents');
  });

  test('array replacement preserves nested null fields verbatim', () => {
    const result = deepMerge(
      {},
      {
        arr: [
          { keep: 1, maybeNull: null },
          { maybeUndefined: undefined, ok: 2 },
        ],
      }
    );

    expect(result).toEqual({
      arr: [
        { keep: 1, maybeNull: null },
        { maybeUndefined: undefined, ok: 2 },
      ],
    });
  });

  test('boolean false is treated as valid override (not deleted)', () => {
    const result = deepMerge({ enabled: true }, { enabled: false });

    expect(result).toEqual({ enabled: false });
  });

  test('numeric zero is treated as valid override', () => {
    const result = deepMerge({ count: 5 }, { count: 0 });

    expect(result).toEqual({ count: 0 });
  });

  test('empty string is treated as valid override', () => {
    const result = deepMerge({ name: 'Bot' }, { name: '' });

    expect(result).toEqual({ name: '' });
  });

  test('empty array replaces non-empty array', () => {
    const result = deepMerge({ items: [1, 2, 3] }, { items: [] });

    expect(result).toEqual({ items: [] });
  });

  test('throws clear error when base contains circular reference', () => {
    const baseChild: Record<string, unknown> = {};
    baseChild.self = baseChild;
    const base = { nested: baseChild };

    expect(() => deepMerge(base, { nested: { self: {} } })).toThrow(
      'Circular reference detected in deepMerge base at nested.self'
    );
  });

  test('throws clear error when override contains circular reference', () => {
    const overrideChild: Record<string, unknown> = {};
    overrideChild.self = overrideChild;
    const override = { nested: overrideChild };

    expect(() => deepMerge({ nested: { self: {} } }, override)).toThrow(
      'Circular reference detected in deepMerge override at nested.self'
    );
  });
});
