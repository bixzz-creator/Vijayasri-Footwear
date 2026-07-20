import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: '400px',
    md: '620px',
    lg: '840px',
    xl: '1100px',
    full: '100vw'
  };

  const width = sizeClasses[size];

  return (
    <div
      data-lenis-prevent="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: size === 'full' ? 0 : '1rem',
        touchAction: 'none',
      }}
      onClick={onClose}
      className="animate-fade-in"
    >
      <div
        data-lenis-prevent="true"
        style={{
          backgroundColor: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
          borderRadius: size === 'full' ? 0 : 'var(--radius)',
          border: '1px solid hsl(var(--border) / 0.5)',
          width: '100%',
          maxWidth: width,
          height: size === 'full' ? '100vh' : 'auto',
          maxHeight: size === 'full' ? '100vh' : 'calc(100vh - 2rem)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid hsl(var(--border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'hsl(var(--card))'
          }}
        >
          {title ? (
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {title}
            </h3>
          ) : (
            <div></div>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.5rem',
              color: 'hsl(var(--muted-foreground))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              transition: 'background-color var(--transition-fast)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'hsl(var(--muted))';
              e.currentTarget.style.color = 'hsl(var(--foreground))';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
            }}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div
          data-lenis-prevent="true"
          style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, overscrollBehavior: 'contain' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
