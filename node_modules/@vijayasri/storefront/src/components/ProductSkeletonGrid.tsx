import { motion } from 'framer-motion';

interface ProductSkeletonGridProps {
  count?: number;
}

export function ProductSkeletonGrid({ count = 9 }: ProductSkeletonGridProps) {
  return (
    <div className="nike-product-grid" aria-label="Loading catalog products">
      {[...Array(count)].map((_, idx) => (
        <motion.div
          key={idx}
          className="skeleton-product-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: idx * 0.05 }}
        >
          {/* Skeleton Image Box */}
          <div className="skeleton-image-wrap shimmer-box">
            <div className="skeleton-badge-pill shimmer-box" />
          </div>

          {/* Skeleton Info Area */}
          <div className="skeleton-info-wrap">
            <div className="skeleton-line brand shimmer-box" />
            <div className="skeleton-line title shimmer-box" />
            <div className="skeleton-line title-short shimmer-box" />
            <div className="skeleton-line price shimmer-box" />
            
            <div className="skeleton-actions-row">
              <div className="skeleton-btn shimmer-box" />
              <div className="skeleton-btn shimmer-box" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
