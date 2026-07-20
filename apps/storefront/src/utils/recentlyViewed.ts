const STORAGE_KEY = 'vsf_recently_viewed';
const MAX_ITEMS = 8;

export function loadRecentlyViewedIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function pushRecentlyViewed(productId: string): string[] {
  const prev = loadRecentlyViewedIds().filter(id => id !== productId);
  const next = [productId, ...prev].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
