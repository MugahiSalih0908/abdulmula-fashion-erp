import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import useCartStore from '../../store/cartStore';
import { calculateInvoiceTotals } from '../../../../shared/invoiceCalculations.mjs';
import {
  ArrowLeft, ArrowRight, Banknote, Check, CreditCard, Minus, Package,
  Plus, ShoppingBag, Smartphone, Tag, Trash2, UserRound, X
} from 'lucide-react';

const PAYMENT_METHODS = [
  { id: 'Cash', icon: Banknote, label: 'Cash' },
  { id: 'Credit', icon: CreditCard, label: 'Credit' },
  { id: 'Mobile Transfer', icon: Smartphone, label: 'Mobile transfer' }
];

const money = value => `$${Number(value || 0).toFixed(2)}`;

export default function CartDrawer({ open, onClose, customers, onCheckout, isCheckingOut }) {
  const cart = useCartStore();
  const [step, setStep] = useState('items');
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      ).filter(element => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        closeButtonRef.current?.focus();
      } else if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  const items = cart.items;
  const itemCount = cart.itemCount();
  const subtotal = cart.subtotal();
  const discountTotal = cart.discountTotal();
  const taxAmount = cart.taxAmount();
  const grandTotal = cart.grandTotal();
  const changeAmount = cart.changeAmount();

  const handleClose = () => {
    setStep('items');
    onClose();
  };

  const handleCheckout = () => {
    if (!items.length) {
      toast.error('Cart is empty.');
      return;
    }
    if (cart.paymentMethod === 'Cash' && cart.cashReceived < grandTotal) {
      toast.error(`Cash received (${money(cart.cashReceived)}) is less than total (${money(grandTotal)}).`);
      return;
    }
    onCheckout();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#151515]/45 backdrop-blur-[2px]"
            onClick={handleClose}
            aria-hidden="true"
          />
          <motion.section
            initial={{ opacity: 0, x: 24, y: 24 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 24, y: 24 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-cart-title"
            aria-describedby="pos-cart-description"
            ref={dialogRef}
            className="fixed inset-x-0 bottom-0 z-50 box-border flex w-full min-w-0 max-w-none max-h-[96dvh] flex-col overflow-x-hidden overflow-y-hidden rounded-t-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-xl)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[min(100vw,34rem)] md:rounded-none md:border-y-0 md:border-r-0 md:border-l"
          >
            <p id="pos-cart-description" className="sr-only">
              Review cart items, adjust order details, and complete checkout.
            </p>
            <header className="box-border w-full min-w-0 shrink-0 border-b border-[var(--color-border)] bg-white pl-[calc(env(safe-area-inset-left,0px)+1rem)] pr-[calc(env(safe-area-inset-right,0px)+1rem)] pb-4 pt-3 sm:px-6 sm:pt-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-border)] md:hidden" aria-hidden="true" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-lighter)] text-[var(--color-primary)]">
                    <ShoppingBag size={19} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 id="pos-cart-title" className="truncate text-lg font-semibold tracking-tight text-[var(--color-text)]">
                      Your cart
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {itemCount} {itemCount === 1 ? 'unit' : 'units'} · {items.length} {items.length === 1 ? 'style' : 'styles'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        cart.clearCart();
                        setStep('items');
                      }}
                      className="min-h-10 rounded-[var(--radius-md)] px-3 text-xs font-semibold text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-danger)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                    >
                      Clear cart
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClose}
                    ref={closeButtonRef}
                    aria-label="Close cart"
                    className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {items.length > 0 && (
                <nav className="mt-4 grid grid-cols-2 gap-1 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-1" aria-label="Cart steps">
                  {[
                    ['items', `Items (${items.length})`],
                    ['payment', 'Customer & payment']
                  ].map(([id, label], index) => {
                    const active = step === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setStep(id)}
                        aria-current={active ? 'step' : undefined}
                        className={`flex min-h-10 items-center justify-center gap-2 rounded-[calc(var(--radius-md)-2px)] px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] sm:text-sm ${
                          active
                            ? 'bg-white text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                        }`}
                      >
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${active ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-[var(--color-text-muted)]'}`}>
                          {index + 1}
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </nav>
              )}
            </header>

            {items.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[var(--color-text-muted)] shadow-[var(--shadow-sm)]">
                  <ShoppingBag size={27} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-base font-semibold text-[var(--color-text)]">Your cart is waiting</h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--color-text-muted)]">
                  Add products from the catalogue and they will appear here.
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-light)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                >
                  Browse products
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
                  {step === 'items' ? (
                    <div className="space-y-3">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-[var(--color-text)]">Order items</h3>
                          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Review quantities and item discounts.</p>
                        </div>
                        <span className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                          {items.length} {items.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      {items.map(item => (
                        <CartItem key={item.product._id} item={item} cart={cart} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <section aria-labelledby="cart-customer-heading">
                        <SectionHeading id="cart-customer-heading" icon={UserRound} title="Customer" detail="Optional for walk-in purchases." />
                        <label htmlFor="cart-customer" className="sr-only">Select customer</label>
                        <select
                          id="cart-customer"
                          value={cart.customer?._id || ''}
                          onChange={event => {
                            const customer = customers?.find(candidate => candidate._id === event.target.value) || null;
                            cart.setCustomer(customer);
                          }}
                          className="mt-3 min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-gold)] focus:shadow-[var(--focus-ring)]"
                        >
                          <option value="">Walk-in customer</option>
                          {customers?.map(customer => (
                            <option key={customer._id} value={customer._id}>
                              {customer.name}{Number(customer.creditBalance) > 0 ? ` · owes ${money(customer.creditBalance)}` : ''}
                            </option>
                          ))}
                        </select>
                      </section>

                      <section aria-labelledby="cart-payment-heading">
                        <SectionHeading id="cart-payment-heading" icon={Banknote} title="Payment method" detail="Choose how this order will be settled." />
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          {PAYMENT_METHODS.map(({ id, icon: Icon, label }) => {
                            const selected = cart.paymentMethod === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => cart.setPaymentMethod(id)}
                                aria-pressed={selected}
                                className={`flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] sm:flex-col sm:justify-center sm:gap-1.5 sm:py-3 ${
                                  selected
                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-[var(--shadow-sm)]'
                                    : 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-gold)]'
                                }`}
                              >
                                <Icon size={18} aria-hidden="true" />
                                <span>{label}</span>
                                {selected && <Check size={14} className="ml-auto sm:hidden" aria-hidden="true" />}
                              </button>
                            );
                          })}
                        </div>
                      </section>

                      {cart.paymentMethod === 'Cash' && (
                        <section aria-labelledby="cart-cash-heading">
                          <SectionHeading id="cart-cash-heading" icon={Banknote} title="Cash received" detail="Enter the tendered amount to calculate change." />
                          <div className="relative mt-3">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--color-text-muted)]">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={cart.cashReceived || ''}
                              onChange={event => cart.setCashReceived(event.target.value)}
                              aria-label="Cash received"
                              placeholder={grandTotal.toFixed(2)}
                              className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white pl-8 pr-3 text-base font-semibold tabular-nums text-[var(--color-text)] outline-none transition focus:border-[var(--color-gold)] focus:shadow-[var(--focus-ring)]"
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {[grandTotal, Math.ceil(grandTotal / 5) * 5, Math.ceil(grandTotal / 10) * 10, Math.ceil(grandTotal / 50) * 50]
                              .filter((amount, index, amounts) => amounts.indexOf(amount) === index)
                              .slice(0, 4)
                              .map(amount => (
                                <button
                                  key={amount}
                                  type="button"
                                  onClick={() => cart.setCashReceived(amount)}
                                  aria-label={`Set cash received to ${money(amount)}`}
                                  className="min-h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-xs font-semibold tabular-nums text-[var(--color-text-secondary)] transition hover:border-[var(--color-gold)] hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                                >
                                  {money(amount)}
                                </button>
                              ))}
                          </div>
                          {cart.cashReceived >= grandTotal && (
                            <div className="mt-3 flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
                              <span className="text-sm font-medium text-[var(--color-text-secondary)]">Change due</span>
                              <span className="text-lg font-bold tabular-nums text-[var(--color-text)]">{money(changeAmount)}</span>
                            </div>
                          )}
                        </section>
                      )}

                      <section aria-labelledby="cart-note-heading">
                        <SectionHeading id="cart-note-heading" icon={Tag} title="Order note" detail="Optional note for this invoice." />
                        <label htmlFor="cart-note" className="sr-only">Order note</label>
                        <textarea
                          id="cart-note"
                          value={cart.note}
                          onChange={event => cart.setNote(event.target.value)}
                          rows={3}
                          maxLength={500}
                          placeholder="Add a note for this order"
                          className="mt-3 min-h-20 w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 py-3 text-sm text-[var(--color-text)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-gold)] focus:shadow-[var(--focus-ring)]"
                        />
                      </section>

                      <section aria-labelledby="cart-tax-heading">
                        <SectionHeading id="cart-tax-heading" icon={Tag} title="Tax rate" detail="Applied after discounts, matching invoice calculations." />
                        <label htmlFor="cart-tax-rate" className="sr-only">Tax rate percent</label>
                        <div className="relative mt-3">
                          <input
                            id="cart-tax-rate"
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={cart.taxRate || ''}
                            onChange={event => cart.setTaxRate(event.target.value)}
                            placeholder="0"
                            className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3.5 pr-10 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-gold)] focus:shadow-[var(--focus-ring)]"
                          />
                          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)]">%</span>
                        </div>
                      </section>
                    </div>
                  )}
                </div>

                <footer className="box-border w-full min-w-0 shrink-0 border-t border-[var(--color-border)] bg-white pl-[calc(env(safe-area-inset-left,0px)+1rem)] pr-[calc(env(safe-area-inset-right,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 sm:px-6">
                  <div className="space-y-2" aria-label="Order totals">
                    <TotalRow label="Subtotal" value={money(subtotal)} />
                    <TotalRow
                      label="Discount"
                      value={`−${money(discountTotal)}`}
                      valueClass={discountTotal > 0 ? 'text-[var(--color-success)]' : undefined}
                    />
                    <TotalRow label={`Tax (${cart.taxRate}%)`} value={money(taxAmount)} />
                    <div className="flex items-end justify-between border-t border-[var(--color-border)] pt-3">
                      <span className="text-sm font-semibold text-[var(--color-text)]">Total</span>
                      <span className="text-2xl font-bold tracking-tight tabular-nums text-[var(--color-text)]">{money(grandTotal)}</span>
                    </div>
                  </div>

                  {step === 'items' ? (
                    <button
                      type="button"
                      onClick={() => setStep('payment')}
                      className="mt-4 flex min-h-12 w-full items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--color-primary-light)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                    >
                      <span>Continue to checkout</span>
                      <span className="flex items-center gap-2 text-[#e8d9bd]">
                        {money(grandTotal)}
                        <ArrowRight size={17} aria-hidden="true" />
                      </span>
                    </button>
                  ) : (
                    <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
                      <button
                        type="button"
                        onClick={() => setStep('items')}
                        aria-label="Back to cart items"
                        className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                      >
                        <ArrowLeft size={16} aria-hidden="true" />
                        <span className="hidden sm:inline">Items</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={isCheckingOut}
                        aria-label={isCheckingOut ? 'Completing sale' : `Complete sale for ${money(grandTotal)}`}
                        className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-[var(--color-primary-light)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isCheckingOut
                          ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                          : <Check size={17} aria-hidden="true" />}
                        {isCheckingOut ? 'Completing sale…' : `Complete sale · ${money(grandTotal)}`}
                      </button>
                    </div>
                  )}
                </footer>
              </>
            )}
          </motion.section>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

function SectionHeading({ id, icon: Icon, title, detail }) {
  return (
    <div>
      <h3 id={id} className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        <Icon size={16} className="text-[#927746]" aria-hidden="true" />
        {title}
      </h3>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{detail}</p>
    </div>
  );
}

function TotalRow({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span className={`tabular-nums text-[var(--color-text)] ${valueClass}`}>{value}</span>
    </div>
  );
}

function CartItem({ item, cart }) {
  const [showDiscount, setShowDiscount] = useState(false);
  const product = item.product;
  const maxQuantity = Number.isInteger(product.quantity) ? product.quantity : 0;
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-sm)] sm:p-4">
      <div className="flex gap-3">
        <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] sm:h-20 sm:w-20">
          {product.imageUrl && !imageFailed ? (
            <img
              src={product.imageUrl}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <Package size={23} strokeWidth={1.5} className="text-[#b8a783]" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-[var(--color-text)]">{product.name}</h3>
              {product.sku && <p className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]">SKU {product.sku}</p>}
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{money(item.unitPrice)} each</p>
            </div>
            <button
              type="button"
              onClick={() => cart.removeItem(product._id)}
              aria-label={`Remove ${product.name} from cart`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] transition hover:bg-[#fff3f1] hover:text-[var(--color-danger)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
              <button
                type="button"
                onClick={() => cart.setQty(product._id, item.quantity - 1)}
                aria-label={`Decrease ${product.name} quantity`}
                className="flex h-9 w-9 items-center justify-center rounded-l-[var(--radius-md)] text-[var(--color-text-secondary)] transition hover:bg-white focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <span className="min-w-8 text-center text-sm font-semibold tabular-nums text-[var(--color-text)]" aria-label={`${item.quantity} units`}>
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => cart.addItem(product)}
                disabled={item.quantity >= maxQuantity}
                aria-label={`Increase ${product.name} quantity`}
                className="flex h-9 w-9 items-center justify-center rounded-r-[var(--radius-md)] text-[var(--color-text-secondary)] transition hover:bg-white focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            </div>

            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-[var(--color-text)]">
                {money(calculateInvoiceTotals([{
                  unitPrice: item.unitPrice,
                  quantity: item.quantity,
                  discount: item.discount || 0
                }], 0).grandTotal)}
              </p>
              <button
                type="button"
                onClick={() => setShowDiscount(value => !value)}
                aria-expanded={showDiscount}
                aria-label={`${showDiscount ? 'Hide' : 'Edit'} discount for ${product.name}`}
                className="mt-1 inline-flex min-h-7 items-center gap-1 rounded px-1 text-xs font-medium text-[#80622e] transition hover:bg-[var(--color-primary-lighter)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                <Tag size={12} aria-hidden="true" />
                {item.discount > 0 ? `−${money(item.discount)}` : 'Add discount'}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showDiscount && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <label htmlFor={`discount-${product._id}`} className="mt-3 block text-xs font-medium text-[var(--color-text-secondary)]">
                  Item discount
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--color-text-muted)]">$</span>
                  <input
                    id={`discount-${product._id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.discount || ''}
                    max={item.unitPrice * item.quantity}
                    onChange={event => {
                      if (!cart.setDiscount(product._id, event.target.value)) {
                        toast.error('Discount must be between $0 and the line amount.');
                      }
                    }}
                    aria-describedby={`discount-help-${product._id}`}
                    className="min-h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-7 pr-3 text-sm tabular-nums text-[var(--color-text)] outline-none transition focus:border-[var(--color-gold)] focus:shadow-[var(--focus-ring)]"
                    placeholder="0.00"
                  />
                </div>
                <p id={`discount-help-${product._id}`} className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  Cannot exceed {money(item.unitPrice * item.quantity)}.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </article>
  );
}
