import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSubmissionWorkflow } from './useSubmissionWorkflow';

describe('useSubmissionWorkflow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads legacy raw submissions and rewrites them as versioned storage', () => {
    localStorage.setItem(
      'spm_event_submissions_v1',
      JSON.stringify([
        {
          id: 'sub-1',
          eventName: 'spring-wedding',
          masterUserId: 'u1',
          masterUserName: 'Jane',
          selectedVenueIds: ['venue-1'],
          answers: [],
          status: 'pending',
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          history: [],
        },
      ]),
    );

    const { result } = renderHook(() => useSubmissionWorkflow());

    expect(result.current.submissions).toHaveLength(1);
    expect(result.current.pendingCount).toBe(1);
    expect(
      result.current.getByMasterAndEvent('u1', 'spring-wedding'),
    ).not.toBeNull();

    const stored = JSON.parse(localStorage.getItem('spm_event_submissions_v1') || 'null');
    expect(stored.version).toBe(1);
    expect(stored.data).toHaveLength(1);
  });

  it('submit creates and persists a new submission', async () => {
    const { result } = renderHook(() => useSubmissionWorkflow());

    act(() => {
      result.current.submit({
        eventName: 'autumn-wedding',
        masterUserId: 'u2',
        masterUserName: 'Mark',
        selectedVenueIds: ['venue-2'],
        answers: [],
      });
    });

    expect(result.current.submissions).toHaveLength(1);
    expect(result.current.pendingCount).toBe(1);

    await waitFor(() => {
      const stored = JSON.parse(
        localStorage.getItem('spm_event_submissions_v1') || 'null',
      );
      expect(stored.version).toBe(1);
      expect(stored.data).toHaveLength(1);
      expect(stored.data[0].eventName).toBe('autumn-wedding');
    });
  });

  it('review updates submission status', () => {
    const { result } = renderHook(() => useSubmissionWorkflow());

    act(() => {
      result.current.submit({
        eventName: 'winter-wedding',
        masterUserId: 'u3',
        masterUserName: 'Taylor',
        selectedVenueIds: ['venue-3'],
        answers: [],
      });
    });

    const created = result.current.submissions[0];
    expect(created).toBeTruthy();

    act(() => {
      result.current.review(
        created.id,
        'approve',
        'admin-1',
        'Administrator',
        'Looks good',
      );
    });

    const updated = result.current.submissions[0];
    expect(updated.status).toBe('approved');
    expect(updated.adminComment).toBe('Looks good');
    expect(updated.history).toHaveLength(1);
  });
});