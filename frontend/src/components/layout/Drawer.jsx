import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Mobile Drawer/Menu Component
 * Side drawer with smooth slide-in animation and backdrop
 * @param {boolean} isOpen - Drawer visibility
 * @param {function} onClose - Close handler
 * @param {ReactNode} children - Drawer content
 * @param {string} side - 'left' | 'right'
 */
export default function Drawer({
  isOpen = false,
  onClose,
  children,
  side = 'left',
}) {
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

          {/* Drawer */}
          <motion.div
            className={`fixed top-0 bottom-0 z-50 w-64 bg-white shadow-xl flex flex-col ${
              side === 'left' ? 'left-0' : 'right-0'
            }`}
            initial={{
              x: side === 'left' ? '-100%' : '100%',
            }}
            animate={{
              x: 0,
            }}
            exit={{
              x: side === 'left' ? '-100%' : '100%',
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Close button */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Menu</h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
