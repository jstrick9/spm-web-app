import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAppModals } from './useAppModals';
import { emit } from '../utils/appEvents';

describe('useAppModals', () => {
  it('starts with every modal closed', () => {
    const { result } = renderHook(() => useAppModals());
    expect(Object.values(result.current.modals).every((v) => v === false)).toBe(true);
    expect(result.current.editingArrangementId).toBeUndefined();
  });

  it('open() and close() flip the named modal', () => {
    const { result } = renderHook(() => useAppModals());
    act(() => result.current.open('admin'));
    expect(result.current.modals.admin).toBe(true);
    act(() => result.current.close('admin'));
    expect(result.current.modals.admin).toBe(false);
  });

  it('toggle() flips the named modal', () => {
    const { result } = renderHook(() => useAppModals());
    act(() => result.current.toggle('guests'));
    expect(result.current.modals.guests).toBe(true);
    act(() => result.current.toggle('guests'));
    expect(result.current.modals.guests).toBe(false);
  });

  it('opens the Decor Designer when spm_open_decor_designer fires (regression test)', () => {
    // This is the exact contract that was broken before the fix in the previous
    // turn: dispatching spm_open_decor_designer must flip a state flag.
    const { result } = renderHook(() => useAppModals());
    act(() => emit('spm_open_decor_designer'));
    expect(result.current.modals.decorDesigner).toBe(true);
    expect(result.current.editingArrangementId).toBeUndefined();
  });

  it('captures arrangementId from the event payload', () => {
    const { result } = renderHook(() => useAppModals());
    act(() => emit('spm_open_decor_designer', { arrangementId: 'arr_42' }));
    expect(result.current.modals.decorDesigner).toBe(true);
    expect(result.current.editingArrangementId).toBe('arr_42');
  });

  it('clears editingArrangementId on close', () => {
    const { result } = renderHook(() => useAppModals());
    act(() => emit('spm_open_decor_designer', { arrangementId: 'arr_42' }));
    act(() => result.current.close('decorDesigner'));
    expect(result.current.modals.decorDesigner).toBe(false);
    expect(result.current.editingArrangementId).toBeUndefined();
  });

  it('opens the Vendor and Timeline panels via their events', () => {
    const { result } = renderHook(() => useAppModals());
    act(() => emit('spm_open_vendors'));
    act(() => emit('spm_open_timeline'));
    expect(result.current.modals.vendors).toBe(true);
    expect(result.current.modals.timeline).toBe(true);
  });
});
