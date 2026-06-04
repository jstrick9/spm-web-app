import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./collaborationChannel', () => ({
  publishCollaborationEvent: vi.fn(),
}));

import { publishCollaborationEvent } from './collaborationChannel';
import {
  beginLayoutEditSession,
  endLayoutEditSession,
  getConflictingLayoutEditors,
  getLayoutDocumentById,
  getLayoutEditSessions,
  getSavedLayoutDocuments,
  saveLayoutDocumentWithRevisionCheck,
} from './collaboration';

const publishCollaborationEventMock = vi.mocked(publishCollaborationEvent);

describe('collaboration helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('saves a new layout with revision 1', () => {
    const result = saveLayoutDocumentWithRevisionCheck({
      nextLayout: {
        id: 'layout-1',
        name: 'Layout 1',
        venueId: 'venue-1',
        tables: [],
        fixtures: [],
        decor: [],
        guests: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revision: 0,
      },
      expectedRevision: null,
      actor: { id: 'u1', name: 'Jane' },
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.layout.revision).toBe(1);
      expect(result.layout.lastModifiedByName).toBe('Jane');
    }

    expect(getSavedLayoutDocuments()).toHaveLength(1);
    expect(getLayoutDocumentById('layout-1')?.revision).toBe(1);

    expect(publishCollaborationEventMock).toHaveBeenCalledWith({
      type: 'layout-saved',
      layoutId: 'layout-1',
      revision: 1,
      actorName: 'Jane',
    });
  });

  it('increments revision on successful compare-and-swap save', () => {
    const first = saveLayoutDocumentWithRevisionCheck({
      nextLayout: {
        id: 'layout-1',
        name: 'Layout 1',
        venueId: 'venue-1',
        tables: [],
        fixtures: [],
        decor: [],
        guests: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revision: 0,
      },
      expectedRevision: null,
      actor: { id: 'u1', name: 'Jane' },
    });

    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = saveLayoutDocumentWithRevisionCheck({
      nextLayout: {
        ...first.layout,
        name: 'Layout 1 Updated',
      },
      expectedRevision: 1,
      actor: { id: 'u2', name: 'Mark' },
    });

    expect(second.ok).toBe(true);

    if (second.ok) {
      expect(second.layout.revision).toBe(2);
      expect(second.layout.lastModifiedByName).toBe('Mark');
      expect(second.layout.name).toBe('Layout 1 Updated');
    }

    expect(publishCollaborationEventMock).toHaveBeenLastCalledWith({
      type: 'layout-saved',
      layoutId: 'layout-1',
      revision: 2,
      actorName: 'Mark',
    });
  });

  it('rejects stale revision saves', () => {
    const first = saveLayoutDocumentWithRevisionCheck({
      nextLayout: {
        id: 'layout-1',
        name: 'Layout 1',
        venueId: 'venue-1',
        tables: [],
        fixtures: [],
        decor: [],
        guests: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revision: 0,
      },
      expectedRevision: null,
    });

    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const stale = saveLayoutDocumentWithRevisionCheck({
      nextLayout: {
        ...first.layout,
        name: 'Stale Save',
      },
      expectedRevision: 0,
    });

    expect(stale.ok).toBe(false);

    if (!stale.ok) {
      expect(stale.reason).toBe('revision-conflict');
      expect(stale.current?.revision).toBe(1);
    }

    expect(publishCollaborationEventMock).toHaveBeenCalledTimes(1);
  });

  it('tracks and filters edit sessions', () => {
    beginLayoutEditSession({
      layoutId: 'layout-1',
      editorId: 'u1',
      editorName: 'Jane',
      baseRevision: 1,
    });

    beginLayoutEditSession({
      layoutId: 'layout-1',
      editorId: 'u2',
      editorName: 'Mark',
      baseRevision: 1,
    });

    expect(getLayoutEditSessions()).toHaveLength(2);
    expect(getConflictingLayoutEditors('layout-1', 'u1')).toHaveLength(1);

    expect(publishCollaborationEventMock).toHaveBeenNthCalledWith(1, {
      type: 'layout-session-started',
      layoutId: 'layout-1',
      editorId: 'u1',
      editorName: 'Jane',
    });

    expect(publishCollaborationEventMock).toHaveBeenNthCalledWith(2, {
      type: 'layout-session-started',
      layoutId: 'layout-1',
      editorId: 'u2',
      editorName: 'Mark',
    });

    endLayoutEditSession('layout-1', 'u2');

    expect(getConflictingLayoutEditors('layout-1', 'u1')).toHaveLength(0);

    expect(publishCollaborationEventMock).toHaveBeenLastCalledWith({
      type: 'layout-session-ended',
      layoutId: 'layout-1',
      editorId: 'u2',
    });
  });

  it('filters expired edit sessions on read', () => {
    localStorage.setItem(
      'spm_layout_edit_sessions',
      JSON.stringify([
        {
          layoutId: 'layout-1',
          editorId: 'u1',
          editorName: 'Jane',
          baseRevision: 1,
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        },
      ]),
    );

    expect(getLayoutEditSessions()).toEqual([]);
  });
});