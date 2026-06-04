import React from 'react';
import { useUndoRedo } from '../contexts/UndoRedoContext';

interface UndoRedoToolbarProps {
  className?: string;
  variant?: 'floating' | 'inline';
}

export function UndoRedoToolbar({ className = '', variant = 'floating' }: UndoRedoToolbarProps) {
  const { canUndo, canRedo, undo, redo, historyLength } = useUndoRedo();

  const baseClasses = variant === 'floating'
    ? 'absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20'
    : '';

  return (
    <div className={`${baseClasses} flex items-center gap-1 bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 p-1 ${className}`}>
      <button
        onClick={undo}
        disabled={!canUndo}
        className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
        </svg>
      </button>
      {historyLength > 0 && (
        <span className="text-xs text-gray-400 ml-1 px-1">
          {historyLength}
        </span>
      )}
    </div>
  );
}

export default UndoRedoToolbar;