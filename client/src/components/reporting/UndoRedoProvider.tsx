import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UndoRedoContextValue<T> {
  state: T;
  setState: (state: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveState: () => void;
}

const UndoRedoContext = createContext<UndoRedoContextValue<any> | null>(null);

interface UndoRedoProviderProps<T> {
  children: ReactNode;
  initialState?: T;
}

export function UndoRedoProvider<T>({ 
  children, 
  initialState 
}: UndoRedoProviderProps<T>) {
  const [undoRedoState, setUndoRedoState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState as T,
    future: []
  });

  const [pendingState, setPendingState] = useState<T | null>(null);

  const setState = useCallback((newState: T) => {
    setPendingState(newState);
  }, []);

  const saveState = useCallback(() => {
    if (pendingState === null) return;
    
    setUndoRedoState(prev => ({
      past: [...prev.past, prev.present],
      present: pendingState,
      future: []
    }));
    setPendingState(null);
  }, [pendingState]);

  const undo = useCallback(() => {
    setUndoRedoState(prev => {
      if (prev.past.length === 0) return prev;
      
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);
      
      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future]
      };
    });
    setPendingState(null);
  }, []);

  const redo = useCallback(() => {
    setUndoRedoState(prev => {
      if (prev.future.length === 0) return prev;
      
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);
      
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture
      };
    });
    setPendingState(null);
  }, []);

  const canUndo = undoRedoState.past.length > 0;
  const canRedo = undoRedoState.future.length > 0;
  const currentState = pendingState !== null ? pendingState : undoRedoState.present;

  const contextValue: UndoRedoContextValue<T> = {
    state: currentState,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    saveState
  };

  return (
    <UndoRedoContext.Provider value={contextValue}>
      {children}
    </UndoRedoContext.Provider>
  );
}

export function useUndoRedo<T>(): UndoRedoContextValue<T> {
  const context = useContext(UndoRedoContext);
  if (!context) {
    throw new Error('useUndoRedo must be used within an UndoRedoProvider');
  }
  return context;
}