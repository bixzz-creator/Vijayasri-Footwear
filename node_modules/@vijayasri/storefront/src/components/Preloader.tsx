import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Footprints } from 'lucide-react';

interface PreloaderProps {
  onComplete: () => void;
}

export function Preloader({ onComplete }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Smooth progress counter from 0 to 100% over 1.8s
    const startTime = Date.now();
    const duration = 1800; // ms

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const current = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(current);

      if (current >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsExiting(true);
          setTimeout(onComplete, 600); // Trigger complete after exit curtain
        }, 300);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          className={`preloader-overlay ${isExiting ? 'exiting' : ''}`}
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            y: -20,
            transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
          }}
          style={{ pointerEvents: isExiting ? 'none' : 'auto' }}
        >
          {/* Ambient Spotlight & Radial Glow */}
          <div className="preloader-spotlight" />

          {/* Center Brand Sequence */}
          <div className="preloader-content">
            {/* Logo Image Reveal */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0, filter: 'blur(16px)' }}
              animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="preloader-logo-wrap"
            >
              <img src="/logo.png" alt="VijayaSri Footwear Logo" className="preloader-logo-img" />
            </motion.div>

            {/* Brand Name & Slogan Stagger */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="preloader-text-group"
            >
              <h2 className="preloader-brand-title">VIJAYASRI FOOTWEAR</h2>
              <p className="preloader-slogan">
                <span>Walk Better. Live Better.</span>
              </p>
            </motion.div>

            {/* Footwear Silhouette / Icon Slide */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 0.6, x: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="preloader-icon-slide"
            >
              <Footprints size={18} />
            </motion.div>

            {/* Apple-Style Thin Glowing Progress Bar */}
            <div className="preloader-progress-track">
              <motion.div
                className="preloader-progress-fill"
                style={{ width: `${progress}%` }}
                transition={{ ease: 'linear' }}
              />
            </div>

            {/* Percentage Indicator */}
            <div className="preloader-meta">
              <span className="preloader-percent">{progress}%</span>
              <span className="preloader-quality">AYYEMPETTAI · THANJAVUR</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
