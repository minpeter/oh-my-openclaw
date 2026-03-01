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
});
