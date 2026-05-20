import { describe, it, expect, vi } from 'vitest';
import { emit, on, emitDataChanged } from './appEvents';

describe('appEvents typed bus', () => {
  it('delivers payload-less events to subscribers', () => {
    const handler = vi.fn();
    const off = on('spm_open_vendors', handler);
    emit('spm_open_vendors');
    expect(handler).toHaveBeenCalledTimes(1);
    off();
    emit('spm_open_vendors');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('delivers typed payloads to subscribers', () => {
    const handler = vi.fn();
    const off = on('spm_open_decor_designer', handler);
    emit('spm_open_decor_designer', { arrangementId: 'arr_1' });
    expect(handler).toHaveBeenCalledWith({ arrangementId: 'arr_1' });
    off();
  });

  it('returns an unsubscribe function from on()', () => {
    const handler = vi.fn();
    const off = on('spm_data_changed', handler);
    off();
    emit('spm_data_changed', { type: 'all' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('emitDataChanged() defaults the detail type to "all"', () => {
    const handler = vi.fn();
    const off = on('spm_data_changed', handler);
    emitDataChanged();
    expect(handler).toHaveBeenCalledWith({ type: 'all' });
    off();
  });

  it('is interoperable with raw window listeners (legacy callers)', () => {
    const legacyHandler = vi.fn();
    const wrapped = (e: Event) => legacyHandler((e as CustomEvent).detail);
    window.addEventListener('spm_open_timeline', wrapped);
    emit('spm_open_timeline');
    expect(legacyHandler).toHaveBeenCalled();
    window.removeEventListener('spm_open_timeline', wrapped);
  });

  it('typed emitters interop with raw dispatched events (gradual migration)', () => {
    const handler = vi.fn();
    const off = on('spm_data_changed', handler);
    window.dispatchEvent(new CustomEvent('spm_data_changed', { detail: { type: 'venues' } }));
    expect(handler).toHaveBeenCalledWith({ type: 'venues' });
    off();
  });
});

describe('spm_storage_error typed payload', () => {
  it('delivers a fully-typed StorageErrorDetail to subscribers', () => {
    const handler = vi.fn();
    const off = on('spm_storage_error', handler);
    emit('spm_storage_error', {
      key: 'spm_layout',
      error: 'QuotaExceededError',
      action: 'save',
      timestamp: '2025-01-01T00:00:00.000Z',
    });
    expect(handler).toHaveBeenCalledWith({
      key: 'spm_layout',
      error: 'QuotaExceededError',
      action: 'save',
      timestamp: '2025-01-01T00:00:00.000Z',
    });
    off();
  });
});
