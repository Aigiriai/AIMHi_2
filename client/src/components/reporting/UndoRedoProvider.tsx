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
  console.log('🔄 UNDO_REDO: Provider initializing with state:', initialState);
  
  const [undoRedoState, setUndoRedoState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState as T,
    future: []
  });

  console.log('🔄 UNDO_REDO: Current undoRedoState:', undoRedoState);

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

export function useUndoRedo<T>(): UndoRedoContextValue<T> | null {
  const context = useContext(UndoRedoContext);
  console.log('🔄 UNDO_REDO: useUndoRedo hook called, context:', context ? 'available' : 'null');
  if (!context) {
    console.error('🚨 UNDO_REDO: useUndoRedo must be used within an UndoRedoProvider');
    return null;
  }
  return context;
}