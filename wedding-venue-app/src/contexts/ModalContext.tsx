import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ModalType = 
  | 'vendors' 
  | 'timeline' 
  | 'guests' 
  | 'admin' 
  | 'templates' 
  | 'print' 
  | 'operations' 
  | 'messages' 
  | 'submission' 
  | 'eventQuestions' 
  | 'decorDesigner';

interface ModalContextType {
  modals: Record<ModalType, boolean>;
  editingArrangementId?: string;
  open: (type: ModalType, id?: string) => void;
  close: (type: ModalType) => void;
  toggle: (type: ModalType) => void;
  setEditingArrangementId: (id?: string) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modals, setModals] = useState<Record<ModalType, boolean>>({
    vendors: false,
    timeline: false,
    guests: false,
    admin: false,
    templates: false,
    print: false,
    operations: false,
    messages: false,
    submission: false,
    eventQuestions: false,
    decorDesigner: false,
  });
  const [editingArrangementId, setEditingArrangementId] = useState<string | undefined>();

  const open = useCallback((type: ModalType, id?: string) => {
    setModals(prev => ({ ...prev, [type]: true }));
    if (id) setEditingArrangementId(id);
  }, []);

  const close = useCallback((type: ModalType) => {
    setModals(prev => ({ ...prev, [type]: false }));
    if (type === 'decorDesigner') setEditingArrangementId(undefined);
  }, []);

  const toggle = useCallback((type: ModalType) => {
    setModals(prev => ({ ...prev, [type]: !prev[type] }));
  }, []);

  return (
    <ModalContext.Provider value={{ modals, editingArrangementId, open, close, toggle, setEditingArrangementId }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModals() {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModals must be used within a ModalProvider');
  return context;
}
