export interface ChatMessage {
  id: string;
  eventId: string;
  threadId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  isOwn: boolean;
  synced: boolean;
}

const DB_NAME = 'spm_chat_db';
const DB_VERSION = 1;
const STORE_NAME = 'messages';

let dbPromise: Promise<IDBDatabase> | null = null;

export function getChatDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('eventId_threadId', ['eventId', 'threadId'], { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

export async function saveMessage(message: ChatMessage): Promise<void> {
  const db = await getChatDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(message);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMessages(eventId: string, threadId: string): Promise<ChatMessage[]> {
  const db = await getChatDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('eventId_threadId');
    const request = index.getAll([eventId, threadId]);

    request.onsuccess = () => {
      const msgs = request.result as ChatMessage[];
      msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      resolve(msgs);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMessage(id: string): Promise<void> {
  const db = await getChatDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
