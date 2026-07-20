import { ArrowUpDown } from 'lucide-react';

export type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'name-asc' | 'newest';

interface CatalogToolbarProps {
  count: number;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  variant?: 'default' | 'nike';
}

const SORT_LABELS: Record<SortOption, string> = {
  featured: 'Featured',
  'price-asc': 'Price: Low to High',
  'price-desc': 'Price: High to Low',
  'name-asc': 'Name: A–Z',
  newest: 'Newest First',
};

export function CatalogToolbar({ sortBy, onSortChange, variant = 'nike' }: CatalogToolbarProps) {
  if (variant === 'nike') {
    return (
      <label className="nike-sort-wrap">
        Sort By
        <select
          className="nike-sort-select"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          aria-label="Sort products"
        >
          {(Object.keys(SORT_LABELS) as SortOption[]).map(key => (
            <option key={key} value={key}>{SORT_LABELS[key]}</option>
          ))}
        </select>
        <ArrowUpDown size={14} />
      </label>
    );
  }

  return (
    <div className="vsf-catalog-toolbar">
      <label className="vsf-sort-select-wrap">
        <ArrowUpDown size={14} />
        <select
          className="vsf-sort-select"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          aria-label="Sort products"
        >
          {(Object.keys(SORT_LABELS) as SortOption[]).map(key => (
            <option key={key} value={key}>{SORT_LABELS[key]}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function sortProducts<T extends {
  offer_price: number;
  name: string;
  created_at?: string;
  mrp?: number;
}>(
  items: T[],
  sortBy: SortOption
): T[] {
  const list = [...items];
  switch (sortBy) {
    case 'price-asc':
      return list.sort((a, b) => a.offer_price - b.offer_price);
    case 'price-desc':
      return list.sort((a, b) => b.offer_price - a.offer_price);
    case 'name-asc':
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case 'newest':
      return list.sort((a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      );
    case 'featured':
    default:
      return list.sort((a, b) => {
        const aOffer = (a.mrp ?? a.offer_price) > a.offer_price ? 1 : 0;
        const bOffer = (b.mrp ?? b.offer_price) > b.offer_price ? 1 : 0;
        if (bOffer !== aOffer) return bOffer - aOffer;
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      });
  }
}
