import React from 'react';
import { getColorSwatchHex, normalizeColorLabel } from '@vijayasri/shared';

interface ColorFilterChipsProps {
  colors: string[];
  selectedColor: string;
  onSelectColor: (color: string) => void;
  compact?: boolean;
}

export function ColorFilterChips({
  colors,
  selectedColor,
  onSelectColor,
  compact = false,
}: ColorFilterChipsProps) {
  if (colors.length === 0) return null;

  const chipStyle = (isSelected: boolean): React.CSSProperties => ({
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: compact ? '0.35rem 0.65rem' : '0.45rem 0.85rem',
    borderRadius: '999px',
    border: isSelected ? '2px solid hsl(var(--primary))' : '1px solid #e5e7eb',
    background: isSelected ? 'hsl(var(--primary) / 0.08)' : '#fff',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: compact ? '0.72rem' : '0.78rem',
    color: isSelected ? 'hsl(var(--primary))' : '#374151',
    transition: 'all 0.15s ease',
  });

  const swatchStyle = (hex: string): React.CSSProperties => ({
    width: compact ? 12 : 14,
    height: compact ? 12 : 14,
    borderRadius: '50%',
    background: hex,
    border: hex === '#f9fafb' || hex === '#fffff0' || hex === '#fef3c7' ? '1px solid #d1d5db' : '1px solid rgba(0,0,0,0.08)',
    flexShrink: 0,
  });

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <button
        type="button"
        onClick={() => onSelectColor('All')}
        style={chipStyle(selectedColor === 'All')}
      >
        All Colors
      </button>
      {colors.map(raw => {
        const label = normalizeColorLabel(raw);
        const hex = getColorSwatchHex(label);
        const isSelected = selectedColor.toLowerCase() === label.toLowerCase();
        return (
          <button
            key={label}
            type="button"
            title={label}
            onClick={() => onSelectColor(isSelected ? 'All' : label)}
            style={chipStyle(isSelected)}
          >
            <span style={swatchStyle(hex)} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
