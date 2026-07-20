import { STOREFRONT_CATEGORY_FAMILIES } from '@vijayasri/shared';

interface CategoryFamilyChipsProps {
  selectedFamily: string;
  onSelectFamily: (familyId: string) => void;
}

export function CategoryFamilyChips({ selectedFamily, onSelectFamily }: CategoryFamilyChipsProps) {
  return (
    <div className="nike-category-chips" role="tablist" aria-label="Shop by type">
      {STOREFRONT_CATEGORY_FAMILIES.map(family => (
        <button
          key={family.id}
          type="button"
          role="tab"
          aria-selected={selectedFamily === family.id}
          className={`nike-category-chip ${selectedFamily === family.id ? 'active' : ''}`}
          onClick={() => onSelectFamily(family.id)}
        >
          {family.label}
        </button>
      ))}
    </div>
  );
}
