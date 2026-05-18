// src/components/ui/Sheet.jsx – reusable slide-up bottom sheet
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function Sheet({ open, title, subtitle, onClose, children, maxH = '92vh' }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 flex flex-col"
            style={{ maxHeight: maxH }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b shrink-0">
              <div>
                <h2 className="font-bold text-lg leading-tight">{title}</h2>
                {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="p-1.5 bg-gray-100 rounded-full shrink-0">
                <X size={18} />
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
