import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  publishCollaborationEvent,
  subscribeToCollaborationEvents,
} from './collaborationChannel';
import type { CollaborationEvent } from './collaborationChannel';

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  static listenersByName = new Map<
    string,
    Set<(event: MessageEvent<CollaborationEvent>) => void>
  >();

  public name: string;
  public closed = false;

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);

    if (!MockBroadcastChannel.listenersByName.has(name)) {
      MockBroadcastChannel.listenersByName.set(name, new Set());
    }
  }

  postMessage(data: CollaborationEvent) {
    const listeners = MockBroadcastChannel.listenersByName.get(this.name);
    if (!listeners) return;

    const event = { data } as MessageEvent<CollaborationEvent>;
    listeners.forEach((listener) => listener(event));
  }

  addEventListener(
    type: string,
    listener: (event: MessageEvent<CollaborationEvent>) => void,
  ) {
    if (type !== 'message') return;
    MockBroadcastChannel.listenersByName.get(this.name)?.add(listener);
  }

  removeEventListener(
    type: string,
    listener: (event: MessageEvent<CollaborationEvent>) => void,
  ) {
    if (type !== 'message') return;
    MockBroadcastChannel.listenersByName.get(this.name)?.delete(listener);
  }

  close() {
    this.closed = true;
  }

  static reset() {
    MockBroadcastChannel.instances = [];
    MockBroadcastChannel.listenersByName.clear();
  }
}

describe('collaborationChannel', () => {
  beforeEach(() => {
    MockBroadcastChannel.reset();

    Object.defineProperty(globalThis, 'BroadcastChannel', {
      value: MockBroadcastChannel,
      configurable: true,
      writable: true,
    });
  });

  it('publishes collaboration events', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToCollaborationEvents(handler);

    publishCollaborationEvent({
      type: 'layout-saved',
      layoutId: 'layout-1',
      revision: 2,
      actorName: 'Jane',
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      type: 'layout-saved',
      layoutId: 'layout-1',
      revision: 2,
      actorName: 'Jane',
    });

    unsubscribe();
  });

  it('unsubscribes collaboration listeners', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToCollaborationEvents(handler);

    unsubscribe();

    publishCollaborationEvent({
      type: 'layout-session-started',
      layoutId: 'layout-1',
      editorId: 'u1',
      editorName: 'Jane',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('gracefully no-ops when BroadcastChannel is unavailable', () => {
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const handler = vi.fn();
    const unsubscribe = subscribeToCollaborationEvents(handler);

    publishCollaborationEvent({
      type: 'layout-session-ended',
      layoutId: 'layout-1',
      editorId: 'u1',
    });

    expect(handler).not.toHaveBeenCalled();

    expect(() => unsubscribe()).not.toThrow();
  });
});