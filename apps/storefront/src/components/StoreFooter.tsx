import { MessageCircle, MapPin, Phone, Mail, Star } from 'lucide-react';
import { STORE_PHONE_DISPLAY, storeTelUrl, storeWhatsAppUrl } from '../config/contact';


interface StoreFooterProps {
  onNavigate: (section: 'home' | 'men' | 'women' | 'offers' | 'faq') => void;
}

export function StoreFooter({ onNavigate }: StoreFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="vsf-footer">
      {/* Social proof bar */}
      <div className="vsf-social-proof-bar">
        <div className="container vsf-social-proof-inner">
          <div className="vsf-social-proof-item">
            <strong>300+</strong>
            <span>Products in store</span>
          </div>
          <div className="vsf-social-proof-divider" aria-hidden />
          <div className="vsf-social-proof-item">
            <strong style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Star size={14} fill="currentColor" /> 4.8
            </strong>
            <span>Customer rating</span>
          </div>
          <div className="vsf-social-proof-divider" aria-hidden />
          <div className="vsf-social-proof-item">
            <strong>10+</strong>
            <span>Top brands</span>
          </div>
          <div className="vsf-social-proof-divider" aria-hidden />
          <div className="vsf-social-proof-item">
            <strong>15+</strong>
            <span>Years serving Thanjavur</span>
          </div>
        </div>
      </div>
      <div className="container vsf-footer-grid">
        <div>
          <div className="vsf-footer-brand-wrap">
            <img src="/logo.png" alt="VijayaSri Footwear Logo" className="vsf-footer-logo-img" />
            <h4 className="vsf-footer-brand">VIJAYASRI FOOTWEAR</h4>
          </div>
          <p className="vsf-footer-tagline">
            Browse footwear online, then call or WhatsApp us to enquire. Visit our Ayyempettai showroom to try and buy — no home delivery or COD.
          </p>
          <div className="vsf-footer-contact">
            <span><MapPin size={14} /> Ayyempettai, Thanjavur</span>
            <a href={storeTelUrl()} style={{ color: 'inherit', textDecoration: 'none' }}>
              <span><Phone size={14} /> {STORE_PHONE_DISPLAY}</span>
            </a>
            <span><Mail size={14} /> care@vijayasri-footwear.in</span>
          </div>
        </div>

        <div>
          <h5>Shop</h5>
          <ul>
            <li><button type="button" onClick={() => onNavigate('men')}>Men&apos;s Footwear</button></li>
            <li><button type="button" onClick={() => onNavigate('women')}>Women&apos;s Footwear</button></li>
            <li><button type="button" onClick={() => onNavigate('offers')}>Offers &amp; Deals</button></li>
            <li><button type="button" onClick={() => onNavigate('home')}>New Arrivals</button></li>
          </ul>
        </div>

        <div>
          <h5>Customer Care &amp; Policies</h5>
          <ul>
            <li><button type="button" onClick={() => onNavigate('faq')}>FAQ &amp; Store Information</button></li>
            <li><a href="#faq" onClick={(e) => { e.preventDefault(); alert('VijayaSri Footwear Policy:\n\n• Try & Buy at Showroom (Main Road, Ayyempettai)\n• 7-Day In-Store Size Exchange with Receipt\n• Direct WhatsApp & Call Enquiry\n• 100% Genuine Brand Guarantee (Walkaroo, Paragon, VKC)'); }}>Exchange &amp; Try-Buy Policy</a></li>
            <li><a href="#privacy" onClick={(e) => { e.preventDefault(); alert('VijayaSri Footwear Privacy Policy:\n\nWe respect your privacy. Phone numbers and WhatsApp messages sent to VijayaSri Footwear are used strictly for customer support and order inquiries.'); }}>Privacy &amp; Security Policy</a></li>
            <li>
              <a href={storeWhatsAppUrl()} target="_blank" rel="noopener noreferrer">
                WhatsApp Enquiry
              </a>
            </li>
            <li>
              <a href={storeTelUrl()}>Call {STORE_PHONE_DISPLAY}</a>
            </li>
          </ul>
        </div>

        <div>
          <h5>Visit Our Footwear Store</h5>
          <p style={{ fontSize: '0.82rem', color: '#9ca3af', lineHeight: 1.6, marginBottom: '0.75rem' }}>
            Main Road, Ayyempettai,<br />
            Thanjavur, Tamil Nadu
          </p>
          {/* Real Shop Storefront Photo Card */}
          <div style={{
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(220, 38, 38, 0.4)',
            marginBottom: '0.75rem',
            position: 'relative',
            boxShadow: '0 6px 16px rgba(0,0,0,0.4)'
          }}>
            <img 
              src="/shop-front.jpg" 
              alt="VijayaSri Footwear Showroom Front Ayyempettai" 
              style={{ width: '100%', height: '150px', objectFit: 'cover', objectPosition: 'center 25%', display: 'block' }} 
            />
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              background: '#DC2626',
              color: '#fff',
              fontSize: '0.62rem',
              fontWeight: 800,
              padding: '0.2rem 0.55rem',
              borderRadius: '999px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase'
            }}>
              Walkaroo Storefront
            </div>
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
              padding: '0.4rem 0.6rem',
              fontSize: '0.72rem',
              color: '#fff',
              fontWeight: 600
            }}>
              🏬 VijayaSri Footwear Showroom
            </div>
          </div>
          {/* Map Location iFrame */}
          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '0.75rem' }}>
            <iframe
              title="VijayaSri Footwear Location"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3918.123456789!2d79.18823!3d10.8955943!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3baac5f2003cb19b%3A0x49a3c69e00f6e82a!2sVIJAYA%20SRI%20FOOTWEARS!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
              width="100%"
              height="130"
              style={{ border: 0, display: 'block' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <a
            href="https://www.google.com/maps/place/VIJAYA+SRI+FOOTWEARS/@10.8955943,79.18823,17z/data=!3m1!4b1!4m6!3m5!1s0x3baac5f2003cb19b:0x49a3c69e00f6e82a!8m2!3d10.8955943!4d79.18823!16s%2Fg%2F11ddxl1ydm"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary vsf-footer-map-btn"
          >
            <MapPin size={14} /> Get Directions
          </a>
        </div>
      </div>

      <div className="vsf-footer-bottom">
        <div className="container vsf-footer-bottom-inner">
          <span>© {year} VijayaSri Footwear. Browse online — enquire via call or WhatsApp only.</span>
          <div className="vsf-footer-payments">
            <span>In-store UPI</span>
            <span>Card</span>
            <span>Cash</span>
          </div>
          <div className="vsf-footer-contact-actions">
            <a href={storeTelUrl()} className="vsf-footer-call">
              <Phone size={16} /> Call
            </a>
            <a
              href={storeWhatsAppUrl('Hi VijayaSri Footwear!')}
              className="vsf-footer-wa"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
