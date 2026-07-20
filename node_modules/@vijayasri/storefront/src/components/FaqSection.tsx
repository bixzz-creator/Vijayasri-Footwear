import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { STORE_PHONE_DISPLAY } from '../config/contact';

const FAQ_ITEMS = [
  {
    q: 'Can I order online with home delivery or COD?',
    a: 'No. This website is for browsing only. We do not offer home delivery or cash-on-delivery. Please call or WhatsApp us to check availability, then visit our Ayyempettai store to purchase.',
  },
  {
    q: 'How do I enquire about a product?',
    a: `Tap "WhatsApp Enquiry" or "Call Store" on any product, or contact us at ${STORE_PHONE_DISPLAY}. Share the product name, color, and size — we will confirm stock and guide you to visit the showroom.`,
  },
  {
    q: 'Can I try footwear before buying?',
    a: 'Yes! Visit our Ayyempettai showroom and try any pair in-store. Our staff will help you find the perfect size and style for Men, Women, and Kids.',
  },
  {
    q: 'What is your exchange policy?',
    a: 'Unused footwear with original bill can be exchanged for a different size within 7 days at our store. Exchanges are subject to stock availability.',
  },
  {
    q: 'Do you sell genuine branded footwear?',
    a: 'Absolutely. We stock authentic Walkaroo, Paragon, VKC, and other trusted Indian brands — the same quality you expect from premium retail.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'Cash, UPI (GPay, PhonePe, Paytm), and card payments are accepted at our physical store when you visit. There is no online payment on this website.',
  },
  {
    q: 'What are your store timings?',
    a: 'Open Monday to Sunday, 9:30 AM to 9:30 PM. We are located on Main Road, Ayyempettai, Thanjavur.',
  },
];

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="container vsf-faq" id="faq">
      <h3 className="vsf-section-title">Frequently Asked Questions</h3>
      <p className="vsf-section-subtitle">Browse online, enquire by call or WhatsApp, and visit our store to buy.</p>
      <div className="vsf-faq-list">
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div key={idx} className={`vsf-faq-item ${isOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="vsf-faq-question"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                aria-expanded={isOpen}
              >
                {item.q}
                <ChevronDown size={18} className="vsf-faq-chevron" />
              </button>
              {isOpen && <p className="vsf-faq-answer">{item.a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
