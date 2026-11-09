// src/components/ui/Sheet.jsx – reusable slide-up bottom sheet
import { useEffect, useId } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

export default function Sheet({ open, title, subtitle, onClose, children, maxH = '92vh' }) {
  const titleId = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            aria-hidden="true"
            onClick={onClose}
          />
          <motion.div
            initial={reduceMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            transition={reduceMotion ? { duration: 0.01 } : { type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 flex flex-col border border-b-0 border-gray-200 shadow-xl pb-safe"
            style={{ maxHeight: maxH }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : 'Panel'}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b shrink-0">
              <div>
                {title && <h2 id={titleId} className="font-bold text-lg leading-tight">{title}</h2>}
                {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close panel" className="min-w-11 min-h-11 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full shrink-0">
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
