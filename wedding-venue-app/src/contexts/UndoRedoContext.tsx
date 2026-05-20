import React, { createContext, useContext, useCallback, useEffect, useState, ReactNode } from 'react';
import { on } from '../utils/appEvents';

interface LayoutSnapshot {
  tables: any[];
  fixtures: any[];
  decor: any[];
  timestamp: number;
}

interface UndoRedoContextType {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushSnapshot: (snapshot: LayoutSnapshot) => void;
  clearHistory: () => void;
  historyLength: number;
}

const UndoRedoContext = createContext<UndoRedoContextType | null>(null);

const MAX_HISTORY = 50;

export function useUndoRedo(): UndoRedoContextType {
  const context = useContext(UndoRedoContext);
  if (!context) {
    throw new Error('useUndoRedo must be used within UndoRedoProvider');
  }
  return context;
}

interface UndoRedoProviderProps {
  children: ReactNode;
  onRestore: (snapshot: LayoutSnapshot) => void;
}

export function UndoRedoProvider({ children, onRestore }: UndoRedoProviderProps) {
  const [past, setPast] = useState<LayoutSnapshot[]>([]);
  const [future, setFuture] = useState<LayoutSnapshot[]>([]);
  const [currentSnapshot, setCurrentSnapshot] = useState<LayoutSnapshot | null>(null);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const pushSnapshot = useCallback((snapshot: LayoutSnapshot) => {
    setCurrentSnapshot((prev) => {
      // Push current state to past before updating
      if (prev) {
        setPast((p) => {
          const newPast = [...p, prev];
          if (newPast.length > MAX_HISTORY) {
            newPast.shift();
          }
          return newPast;
        });
      }
      // Clear future when new action is taken
      setFuture([]);
      return snapshot;
    });
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;

    setPast((prev) => {
      if (prev.length === 0) return prev;

      const previous = prev[prev.length - 1];
      const newPast = prev.slice(0, -1);

      // Push current to future
      setFuture((f) => [currentSnapshot!, ...f].filter(Boolean));

      // Restore previous
      setCurrentSnapshot(previous);
      onRestore(previous);

      return newPast;
    });
  }, [past, currentSnapshot, onRestore]);

  const redo = useCallback(() => {
    if (future.length === 0) return;

    setFuture((prev) => {
      if (prev.length === 0) return prev;

      const next = prev[0];
      const newFuture = prev.slice(1);

      // Push current to past
      setPast((p) => [...p, currentSnapshot!].filter(Boolean));

      // Restore next
      setCurrentSnapshot(next);
      onRestore(next);

      return newFuture;
    });
  }, [future, currentSnapshot, onRestore]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  // Listen for snapshot events from the app
  useEffect(() => {
    return on('spm_push_undo_snapshot', (snapshot) => {
      pushSnapshot(snapshot);
    });
  }, [pushSnapshot]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      
      if (isCtrlOrMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (isCtrlOrMeta && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (isCtrlOrMeta && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <UndoRedoContext.Provider
      value={{
        canUndo,
        canRedo,
        undo,
        redo,
        pushSnapshot,
        clearHistory,
        historyLength: past.length,
      }}
    >
      {children}
    </UndoRedoContext.Provider>
  );
}