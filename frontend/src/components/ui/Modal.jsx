import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const bottomSheet = isMobile && !fullWidth;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className={`fixed z-50 modal-content ${
              bottomSheet
                ? 'bottom-0 left-0 right-0 rounded-t-2xl rounded-b-none'
                : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md m-4'
            }`}
            initial={
              bottomSheet
                ? { y: '100%', opacity: 0 }
                : { scale: 0.9, opacity: 0, y: -50 }
            }
            animate={
              bottomSheet
                ? { y: 0, opacity: 1 }
                : { scale: 1, opacity: 1, y: 0 }
            }
            exit={
              bottomSheet
                ? { y: '100%', opacity: 0 }
                : { scale: 0.9, opacity: 0, y: -50 }
            }
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Handle bar for bottom sheet */}
            {bottomSheet && <div className="sheet-handle" />}

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X size={24} />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[80vh] sm:max-h-none">
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
