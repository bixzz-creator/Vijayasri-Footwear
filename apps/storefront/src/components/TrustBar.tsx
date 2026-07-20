import { Phone, RefreshCw, Award, MessageCircle, Store, Monitor } from 'lucide-react';

const TRUST_ITEMS = [
  { icon: Monitor, title: 'Browse Online', desc: 'View full catalog on this website' },
  { icon: Phone, title: 'Call to Enquire', desc: 'Check stock & price — no online checkout' },
  { icon: MessageCircle, title: 'WhatsApp Enquiry', desc: 'Quick answers from our team' },
  { icon: Store, title: 'Visit & Try', desc: 'Walk in and feel the comfort before you buy' },
  { icon: RefreshCw, title: 'Easy Exchange', desc: '7-day size exchange with bill at store' },
  { icon: Award, title: 'Genuine Brands', desc: 'Walkaroo, Paragon, VKC & more' },
];

export function TrustBar() {
  return (
    <section className="container vsf-trust-bar">
      <div className="vsf-trust-grid">
        {TRUST_ITEMS.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="vsf-trust-item">
            <div className="vsf-trust-icon"><Icon size={20} /></div>
            <div>
              <strong>{title}</strong>
              <span>{desc}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
