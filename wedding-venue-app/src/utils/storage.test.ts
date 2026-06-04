import { beforeEach, describe, expect, it } from 'vitest';
import { loadVersionedStorage, saveVersionedStorage } from './storage';
import { on } from './appEvents';
import { vi } from 'vitest';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function getAllStorageKeys(): string[] {
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(
    (key): key is string => Boolean(key),
  );
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
});

describe('versioned storage', () => {
  it('saves data in a versioned envelope', () => {
    saveVersionedStorage('test_key', 2, { value: 123 });
    const raw = localStorage.getItem('test_key');

    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(2);
    expect(parsed.data).toEqual({ value: 123 });
    expect(parsed.savedAt).toBeTruthy();
  });

  it('loads current-version envelope data', () => {
    saveVersionedStorage('test_key', 2, ['a', 'b']);

    const result = loadVersionedStorage({
      key: 'test_key',
      defaultValue: [] as string[],
      currentVersion: 2,
    });

    expect(result).toEqual(['a', 'b']);
  });

  it('migrates legacy raw storage using migration 0', () => {
    localStorage.setItem('legacy_key', JSON.stringify({ old: true }));

    const result = loadVersionedStorage({
      key: 'legacy_key',
      defaultValue: { migrated: false },
      currentVersion: 2,
      migrations: {
        0: (input) => ({ migrated: Boolean((input as { old?: boolean }).old) }),
      },
    });

    expect(result).toEqual({ migrated: true });

    const rewritten = JSON.parse(localStorage.getItem('legacy_key')!);
    expect(rewritten.version).toBe(2);
    expect(rewritten.data).toEqual({ migrated: true });
  });

  it('migrates an older envelope version using the registered migration', () => {
    localStorage.setItem(
      'versioned_key',
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        data: { value: 10 },
      }),
    );

    const result = loadVersionedStorage({
      key: 'versioned_key',
      defaultValue: { value: 0 },
      currentVersion: 2,
      migrations: {
        1: (input) => ({ value: (input as { value: number }).value + 1 }),
      },
    });

    expect(result).toEqual({ value: 11 });

    const rewritten = JSON.parse(localStorage.getItem('versioned_key')!);
    expect(rewritten.version).toBe(2);
    expect(rewritten.data).toEqual({ value: 11 });
  });

  it('uses legacy keys when the primary key is absent', () => {
    localStorage.setItem('legacy_a', JSON.stringify(['x', 'y']));

    const result = loadVersionedStorage({
      key: 'primary_key',
      legacyKeys: ['legacy_a'],
      defaultValue: [] as string[],
      currentVersion: 1,
      migrations: {
        0: (input) => (Array.isArray(input) ? input : []),
      },
    });

    expect(result).toEqual(['x', 'y']);
  });

  it('returns default value and backs up corrupt storage', () => {
    localStorage.setItem('bad_key', '{not-valid-json');

    const result = loadVersionedStorage({
      key: 'bad_key',
      defaultValue: ['fallback'],
      currentVersion: 1,
    });

    expect(result).toEqual(['fallback']);

    const backupKeys = getAllStorageKeys().filter((key) => key.startsWith('spm_backup_bad_key_'));
    expect(backupKeys.length).toBe(1);
  });


  it('emits a typed spm_storage_error event when load encounters corrupt JSON', () => {
    const handler = vi.fn();
    const off = on('spm_storage_error', handler);
    localStorage.setItem('typed_bad_key', '{not-valid-json');

    loadVersionedStorage({
      key: 'typed_bad_key',
      defaultValue: ['fallback'],
      currentVersion: 1,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    const detail = handler.mock.calls[0][0];
    expect(detail).toMatchObject({ key: 'typed_bad_key', action: 'load' });
    expect(typeof detail.error).toBe('string');
    expect(typeof detail.timestamp).toBe('string');
    off();
  });

  it('applies normalization after loading', () => {
    localStorage.setItem(
      'normalize_key',
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        data: { items: null },
      }),
    );

    const result = loadVersionedStorage({
      key: 'normalize_key',
      defaultValue: { items: [] as string[] },
      currentVersion: 1,
      normalize: (value) => ({
        ...value,
        items: Array.isArray((value as { items: unknown }).items)
          ? (value as { items: string[] }).items
          : [],
      }),
    });

    expect(result).toEqual({ items: [] });
  });
});