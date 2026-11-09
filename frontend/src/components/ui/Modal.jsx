import React, { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Responsive Modal Component
 * Full-width on mobile with slide-up animation, centered on desktop
 * @param {boolean} isOpen - Modal visibility
 * @param {function} onClose - Close handler
 * @param {string} title - Modal title
 * @param {ReactNode} children - Modal content
 * @param {ReactNode} footer - Footer actions
 * @param {boolean} fullWidth - Force full width on all sizes
 */
export default function Modal({
  isOpen = false,
  onClose,
  title,
  children,
  footer,
  fullWidth = false,
}) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const bottomSheet = isMobile && !fullWidth;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => setIsMobile(mediaQuery.matches);
    updateViewport();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateViewport);
      return () => mediaQuery.removeEventListener('change', updateViewport);
    }
    mediaQuery.addListener(updateViewport);
    return () => mediaQuery.removeListener(updateViewport);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="modal-backdrop"
            aria-hidden="true"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            onClick={() => onClose?.()}
          />

          {/* Modal */}
          <motion.div
            className={`fixed z-50 modal-content ${
              bottomSheet
                ? 'bottom-0 left-0 right-0 rounded-t-2xl rounded-b-none max-h-[92dvh] flex flex-col'
                : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md max-h-[90vh]'
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : 'Dialog'}
            initial={reduceMotion ? false : bottomSheet
              ? { y: '100%', opacity: 0 }
              : { scale: 0.96, opacity: 0, y: -12 }}
            animate={bottomSheet ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : bottomSheet
              ? { y: '100%', opacity: 0 }
              : { scale: 0.96, opacity: 0, y: -12 }}
            transition={reduceMotion ? { duration: 0.01 } : { type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Handle bar for bottom sheet */}
            {bottomSheet && <div className="sheet-handle" />}

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
                <h2 id={titleId} className="text-xl font-semibold text-gray-900">{title}</h2>
                <button
                  type="button"
                  onClick={() => onClose?.()}
                  aria-label="Close dialog"
                  className="min-w-11 min-h-11 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className={`p-4 sm:p-6 overflow-y-auto overscroll-contain ${bottomSheet ? 'flex-1' : 'max-h-[80vh]'}`}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex gap-3 flex-row-reverse">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
