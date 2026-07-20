/** VijayaSri Footwear — browse online, enquire via call or WhatsApp only (no shipping / COD). */

export const STORE_PHONE = '8300029513';
export const STORE_PHONE_E164 = '918300029513';
export const STORE_PHONE_DISPLAY = '+91 83000 29513';

export function storeTelUrl(): string {
  return `tel:+${STORE_PHONE_E164}`;
}

export function storeWhatsAppUrl(message?: string): string {
  // Use api.whatsapp.com/send — more reliable than wa.me for pre-filled text
  const base = `https://api.whatsapp.com/send/?phone=${STORE_PHONE_E164}&type=phone_number&app_absent=0`;
  if (!message) return base;
  // Truncate to 1500 chars to stay safely within WhatsApp limits
  const safe = message.length > 1500 ? message.slice(0, 1497) + '...' : message;
  return `${base}&text=${encodeURIComponent(safe)}`;
}
