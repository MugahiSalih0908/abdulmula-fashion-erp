// src/components/ui/Sheet.jsx – accessible reusable slide-up sheet
import { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

export default function Sheet({ open, title, subtitle, onClose, children, maxH = '92vh' }) {
  const titleId = useId();
  const subtitleId = useId();
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;

    const getFocusable = () => Array.from(
      dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || []
    ).filter(element => (
      element.getClientRects().length > 0 &&
      element.getAttribute('aria-hidden') !== 'true'
    ));

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        dialogRef.current?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    (closeButtonRef.current || dialogRef.current)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            aria-hidden="true"
            onClick={() => onCloseRef.current?.()}
          />
          <motion.div
            ref={dialogRef}
            initial={reduceMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            transition={reduceMotion ? { duration: 0.01 } : { type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl border border-b-0 border-gray-200 bg-white shadow-xl pb-safe"
            style={{ maxHeight: maxH }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={subtitle ? subtitleId : undefined}
            aria-label={title ? undefined : 'Panel'}
            tabIndex={-1}
          >
            <div className="flex shrink-0 items-center justify-between border-b px-5 pb-3 pt-5">
              <div className="min-w-0">
                {title && <h2 id={titleId} className="text-lg font-bold leading-tight">{title}</h2>}
                {subtitle && <p id={subtitleId} className="text-sm text-gray-500">{subtitle}</p>}
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => onCloseRef.current?.()}
                aria-label="Close panel"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
              >
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
