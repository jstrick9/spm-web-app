import { useState, useCallback } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface HistoryOptions {
  maxHistory?: number;
}

export function useHistory<T>(
  initialPresent: T,
  options: HistoryOptions = {}
) {
  const { maxHistory = 50 } = options;
  
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initialPresent,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const set = useCallback((newPresent: T | ((prev: T) => T)) => {
    setState((prevState) => {
      const newPresentValue = typeof newPresent === 'function' 
        ? (newPresent as (prev: T) => T)(prevState.present)
        : newPresent;
      
      // Don't add to history if value hasn't changed
      if (JSON.stringify(newPresentValue) === JSON.stringify(prevState.present)) {
        return prevState;
      }

      const newPast = [...prevState.past, prevState.present];
      
      // Limit history size
      if (newPast.length > maxHistory) {
        newPast.shift();
      }

      return {
        past: newPast,
        present: newPresentValue,
        future: [],
      };
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    setState((prevState) => {
      if (prevState.past.length === 0) return prevState;

      const previous = prevState.past[prevState.past.length - 1];
      const newPast = prevState.past.slice(0, -1);

      return {
        past: newPast,
        present: previous,
        future: [prevState.present, ...prevState.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prevState) => {
      if (prevState.future.length === 0) return prevState;

      const next = prevState.future[0];
      const newFuture = prevState.future.slice(1);

      return {
        past: [...prevState.past, prevState.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const reset = useCallback((newPresent: T) => {
    setState({
      past: [],
      present: newPresent,
      future: [],
    });
  }, []);

  return {
    state: state.present,
    set,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
    historyLength: state.past.length,
    futureLength: state.future.length,
  };
}