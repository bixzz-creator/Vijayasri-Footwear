import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  STOREFRONT_CATEGORY_GROUPS,
  GENDER_FILTER_OPTIONS,
  normalizeColorLabel,
  normalizeCategoryLabel,
  getColorSwatchHex,
  formatCurrency,
} from '@vijayasri/shared';
import { ColorFilterChips } from './ColorFilterChips';

interface FilterSidebarProps {
  brands: string[];
  colors: string[];
  sizes: string[];
  materials: string[];
  absoluteMaxPrice: number;
  selectedBrand: string;
  selectedGender: string;
  selectedCategory: string;
  selectedColor: string;
  selectedSize: string;
  selectedMaterial: string;
  maxPrice: number;
  showOffersOnly: boolean;
  onBrandChange: (v: string) => void;
  onGenderChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onSizeChange: (v: string) => void;
  onMaterialChange: (v: string) => void;
  onMaxPriceChange: (v: number) => void;
  onOffersToggle: (v: boolean) => void;
  onReset: () => void;
  hidden?: boolean;
  extraCategories?: string[];
  disabled?: boolean;
}

function AccordionSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`nike-filter-section ${open ? 'open' : ''}`}>
      <button type="button" className="nike-filter-heading" onClick={() => setOpen(!open)}>
        {title}
        <ChevronDown size={16} />
      </button>
      {open && <div className="nike-filter-body">{children}</div>}
    </div>
  );
}

export function FilterSidebar({
  brands,
  colors,
  sizes,
  materials,
  absoluteMaxPrice,
  selectedBrand,
  selectedGender,
  selectedCategory,
  selectedColor,
  selectedSize,
  selectedMaterial,
  maxPrice,
  showOffersOnly,
  onBrandChange,
  onGenderChange,
  onCategoryChange,
  onColorChange,
  onSizeChange,
  onMaterialChange,
  onMaxPriceChange,
  onOffersToggle,
  onReset,
  hidden = false,
  extraCategories = [],
  disabled = false,
}: FilterSidebarProps) {
  if (hidden) return null;

  return (
    <aside
      className="nike-filter-sidebar"
      style={{
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        cursor: disabled ? 'wait' : 'default',
        transition: 'opacity 0.2s ease',
      }}
      aria-busy={disabled}
    >
      <div className="nike-filter-sidebar-head">
        <span>Filters</span>
        <button type="button" onClick={onReset}>Clear all</button>
      </div>

      <AccordionSection title="Brand" defaultOpen={brands.length > 0}>
        <div className="nike-filter-checks">
          <label>
            <input type="radio" name="brand" checked={selectedBrand === 'All'} onChange={() => onBrandChange('All')} />
            All Brands
          </label>
          {brands.map(brand => (
            <label key={brand}>
              <input type="radio" name="brand" checked={selectedBrand === brand} onChange={() => onBrandChange(brand)} />
              {brand}
            </label>
          ))}
        </div>
      </AccordionSection>

      <AccordionSection title="Offers">
        <label className="nike-filter-toggle">
          <input type="checkbox" checked={showOffersOnly} onChange={e => onOffersToggle(e.target.checked)} />
          On Sale / Offers only
        </label>
      </AccordionSection>

      <AccordionSection title="Gender" defaultOpen>
        <div className="nike-filter-checks">
          {GENDER_FILTER_OPTIONS.map(g => (
            <label key={g.value}>
              <input
                type="radio"
                name="gender"
                checked={selectedGender === g.value}
                onChange={() => onGenderChange(g.value)}
              />
              {g.label}
            </label>
          ))}
        </div>
      </AccordionSection>

      <AccordionSection title="Category">
        <div className="nike-filter-checks">
          <label>
            <input type="radio" name="category" checked={selectedCategory === 'All'} onChange={() => onCategoryChange('All')} />
            All Types
          </label>
          {STOREFRONT_CATEGORY_GROUPS.map(cat => (
            <label key={cat.id}>
              <input
                type="radio"
                name="category"
                checked={selectedCategory === cat.id}
                onChange={() => onCategoryChange(cat.id)}
              />
              {cat.label}
            </label>
          ))}
          {extraCategories.map(cat => (
            <label key={cat}>
              <input
                type="radio"
                name="category"
                checked={selectedCategory === cat}
                onChange={() => onCategoryChange(cat)}
              />
              {normalizeCategoryLabel(cat)}
            </label>
          ))}
        </div>
      </AccordionSection>

      <AccordionSection title="Colour">
        {colors.length > 0 ? (
          <ColorFilterChips
            colors={colors}
            selectedColor={selectedColor}
            onSelectColor={onColorChange}
            compact
          />
        ) : (
          <p className="nike-filter-empty">No colours in catalog</p>
        )}
        {selectedColor !== 'All' && (
          <p className="nike-filter-selected-color">
            <span style={{ background: getColorSwatchHex(normalizeColorLabel(selectedColor)) }} />
            {normalizeColorLabel(selectedColor)}
          </p>
        )}
      </AccordionSection>

      <AccordionSection title="Size (UK/IND)">
        <div className="nike-filter-checks">
          {sizes.map(size => (
            <label key={size}>
              <input type="radio" name="size" checked={selectedSize === size} onChange={() => onSizeChange(size)} />
              {size}
            </label>
          ))}
        </div>
      </AccordionSection>

      {materials.length > 1 && (
        <AccordionSection title="Material">
          <div className="nike-filter-checks">
            {materials.map(mat => (
              <label key={mat}>
                <input type="radio" name="material" checked={selectedMaterial === mat} onChange={() => onMaterialChange(mat)} />
                {mat}
              </label>
            ))}
          </div>
        </AccordionSection>
      )}

      <AccordionSection title="Price">
        <div className="nike-price-filter">
          <div className="nike-price-filter-labels">
            <span>Up to</span>
            <strong>{formatCurrency(maxPrice)}</strong>
          </div>
          <input
            type="range"
            min={200}
            max={absoluteMaxPrice}
            step={50}
            value={maxPrice}
            onChange={e => onMaxPriceChange(parseInt(e.target.value))}
          />
        </div>
      </AccordionSection>
    </aside>
  );
}
