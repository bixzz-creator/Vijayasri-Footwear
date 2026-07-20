import { Monitor, Phone, RotateCcw, ShieldCheck } from 'lucide-react';
import { STORE_PHONE_DISPLAY } from '../config/contact';

export function AnnouncementBar() {
  return (
    <div className="vsf-announcement">
      <div className="container vsf-announcement-inner">
        <span><Monitor size={14} /> Browse our catalog online — no shipping or COD</span>
        <span className="vsf-announcement-divider" />
        <span><Phone size={14} /> Enquire via call or WhatsApp: {STORE_PHONE_DISPLAY}</span>
        <span className="vsf-announcement-divider desktop-only" />
        <span className="desktop-only"><RotateCcw size={14} /> Easy size exchange within 7 days at store</span>
        <span className="vsf-announcement-divider desktop-only" />
        <span className="desktop-only"><ShieldCheck size={14} /> 100% genuine branded footwear</span>
      </div>
    </div>
  );
}
