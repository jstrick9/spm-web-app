export type CollaborationEvent =
  | {
      type: 'layout-saved';
      layoutId: string;
      revision: number;
      actorName?: string;
    }
  | {
      type: 'layout-session-started';
      layoutId: string;
      editorId: string;
      editorName: string;
    }
  | {
      type: 'layout-session-ended';
      layoutId: string;
      editorId: string;
    };

const CHANNEL_NAME = 'spm-collaboration';

// Reuse a single channel instance
let sharedChannel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }

  if (sharedChannel) {
    return sharedChannel;
  }

  try {
    sharedChannel = new BroadcastChannel(CHANNEL_NAME);
    return sharedChannel;
  } catch {
    return null;
  }
}

export function publishCollaborationEvent(event: CollaborationEvent): void {
  const channel = getChannel();
  if (!channel) return;

  try {
    channel.postMessage(event);
  } catch {
    // Silently fail if channel is closed
  }
}

export function subscribeToCollaborationEvents(
  handler: (event: CollaborationEvent) => void,
): () => void {
  const channel = getChannel();
  if (!channel) return () => undefined;

  const listener = (message: MessageEvent) => {
    handler(message.data);
  };

  channel.addEventListener('message', listener);

  return () => {
    channel.removeEventListener('message', listener);
    // Don't close the shared channel - others may be using it
  };
}

// Cleanup function for module unload
export function closeCollaborationChannel(): void {
  if (sharedChannel) {
    sharedChannel.close();
    sharedChannel = null;
  }
}