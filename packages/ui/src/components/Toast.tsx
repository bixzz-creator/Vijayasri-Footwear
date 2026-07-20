import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextProps {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    
    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast, toasts, dismissToast }}>
      {children}
      {/* Toast Render Overlay */}
      <div
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: '380px',
          width: 'calc(100vw - 4rem)'
        }}
      >
        {toasts.map((toast) => {
          const typeColors = {
            success: 'rgb(16, 185, 129)',
            info: 'hsl(var(--primary))',
            warning: 'rgb(245, 158, 11)',
            error: 'hsl(var(--destructive))'
          };
          const accentColor = typeColors[toast.type];
          return (
            <div
              key={toast.id}
              onClick={() => dismissToast(toast.id)}
              style={{
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                borderLeft: `5px solid ${accentColor}`,
                boxShadow: 'var(--shadow-lg), 0 4px 12px rgba(0, 0, 0, 0.1)',
                padding: '0.85rem 1.2rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                border: '1px solid hsl(var(--border) / 0.5)',
                animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <span style={{ fontSize: '0.875rem', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                {toast.message}
              </span>
              <span style={{ opacity: 0.6, fontSize: '1.25rem', lineHeight: 1 }}>&times;</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
