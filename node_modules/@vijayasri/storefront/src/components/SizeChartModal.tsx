import { Modal } from '@vijayasri/ui';

interface SizeChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  gender?: string;
}

const MEN_WOMEN_CHART = [
  { uk: '4', ind: '4', cm: '23.0' },
  { uk: '5', ind: '5', cm: '23.8' },
  { uk: '6', ind: '6', cm: '24.5' },
  { uk: '7', ind: '7', cm: '25.2' },
  { uk: '8', ind: '8', cm: '26.0' },
  { uk: '9', ind: '9', cm: '26.8' },
  { uk: '10', ind: '10', cm: '27.5' },
];

export function SizeChartModal({ isOpen, onClose, gender }: SizeChartModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
        Size Guide — UK / India
      </h3>
      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1.25rem' }}>
        {gender === 'Kids'
          ? 'Kids sizes vary by brand. WhatsApp us a foot length (cm) photo for the best fit.'
          : 'Measure foot length in cm. Stand on paper, mark heel to longest toe, then match below.'}
      </p>
      {gender !== 'Kids' && (
        <div style={{ overflowX: 'auto' }}>
          <table className="vsf-size-table">
            <thead>
              <tr>
                <th>UK / IND Size</th>
                <th>Foot Length (cm)</th>
                <th>Best For</th>
              </tr>
            </thead>
            <tbody>
              {MEN_WOMEN_CHART.map(row => (
                <tr key={row.uk}>
                  <td><strong>{row.uk}</strong></td>
                  <td>{row.cm} cm</td>
                  <td>{parseInt(row.uk) <= 5 ? 'Women / narrow' : parseInt(row.uk) >= 8 ? 'Men / wide' : 'Unisex'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: '1rem', padding: '0.85rem', background: '#f9fafb', borderRadius: '8px', fontSize: '0.8rem', color: '#4b5563' }}>
        <strong>Fit tip:</strong> For slippers &amp; sandals, if between sizes choose the larger size for comfort.
        Still unsure? Message us on WhatsApp with your usual shoe size — we&apos;ll recommend the perfect fit.
      </div>
    </Modal>
  );
}
