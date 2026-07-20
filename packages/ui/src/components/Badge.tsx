import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
  glow?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  glow = false,
  className = '',
  style,
  ...props
}) => {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.25rem 0.6rem',
    borderRadius: '9999px',
    userSelect: 'none',
    gap: '0.25rem'
  };

  const variants = {
    primary: {
      backgroundColor: 'hsl(var(--primary) / 0.15)',
      color: 'hsl(var(--primary))',
      border: '1px solid hsl(var(--primary) / 0.2)'
    },
    secondary: {
      backgroundColor: 'hsl(var(--secondary))',
      color: 'hsl(var(--secondary-foreground))',
      border: '1px solid hsl(var(--border))'
    },
    success: {
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      color: 'rgb(16, 185, 129)',
      border: '1px solid rgba(16, 185, 129, 0.2)'
    },
    warning: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      color: 'rgb(245, 158, 11)',
      border: '1px solid rgba(245, 158, 11, 0.2)'
    },
    destructive: {
      backgroundColor: 'hsl(var(--destructive) / 0.15)',
      color: 'hsl(var(--destructive))',
      border: '1px solid hsl(var(--destructive) / 0.2)'
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'hsl(var(--foreground))',
      border: '1px solid hsl(var(--border))'
    }
  };

  const appliedVariant = variants[variant];
  const combinedGlow = glow ? '0 0 10px 1px rgba(16, 185, 129, 0.25)' : undefined;

  return (
    <span
      style={{
        ...baseStyle,
        ...appliedVariant,
        boxShadow: combinedGlow,
        ...style
      }}
      className={`ui-badge ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
