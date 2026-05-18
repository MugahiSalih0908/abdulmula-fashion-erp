// src/components/pos/ReceiptModal.jsx – thermal receipt + WhatsApp share v3

import { motion, AnimatePresence } from 'framer-motion';
import { Printer, Share2, X, MessageCircle } from 'lucide-react';
import { shareInvoiceWhatsApp } from '../../utils/whatsapp';

export default function ReceiptModal({ invoice, onClose, cashReceived, changeAmount }) {
  if (!invoice) return null;

  const handlePrint = () => window.print();
  const handleWhatsApp = () => shareInvoiceWhatsApp(invoice, invoice.customerPhone || '');
  const handleShare = async () => {
    const text = buildText(invoice, cashReceived, changeAmount);
    if (navigator.share) { try { await navigator.share({ title: `Receipt ${invoice.invoiceNumber}`, text }); } catch (_) {} }
    else if (navigator.clipboard) { await navigator.clipboard.writeText(text); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                  className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
                  onClick={onClose}>
        <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
                    transition={{type:'spring',damping:28,stiffness:300}}
                    onClick={e=>e.stopPropagation()}
                    className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm shadow-2xl overflow-hidden"
                    style={{maxHeight:'92vh'}}>
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{background:'#111'}}>
            <span className="font-bold">Receipt</span>
            <button onClick={onClose} className="p-1 rounded-full bg-white/20"><X size={16}/></button>
          </div>

          <div className="overflow-y-auto" style={{maxHeight:'calc(92vh - 130px)'}}>
            <div className="p-5 font-mono text-sm" id="receipt-print">
              <div className="text-center mb-4">
                <div className="text-2xl font-black tracking-widest mb-0.5">ABDULMULA</div>
                <div className="font-bold tracking-wider text-gray-600 text-sm">FASHION ERP</div>
                <div className="text-xs text-gray-400 mt-1">Konyo-Konyo Market, Juba, South Sudan</div>
                <div className="border-t border-dashed border-gray-300 mt-3 pt-2 text-xs text-gray-500">
                  {new Date(invoice?.date || Date.now()).toLocaleString()}
                
                </div>
              </div>

              <div className="border-b border-dashed border-gray-200 pb-2 mb-2 space-y-0.5">
                <div className="flex justify-between text-xs"><span className="text-gray-500">Invoice#</span><span className="font-bold">{invoice.invoiceNumber||'—'}</span></div>
                {invoice.soldByName   && <div className="flex justify-between text-xs"><span className="text-gray-500">Cashier</span><span>{invoice.soldByName}</span></div>}
                {invoice.customerName && <div className="flex justify-between text-xs"><span className="text-gray-500">Customer</span><span>{invoice.customerName}</span></div>}
                <div className="flex justify-between text-xs"><span className="text-gray-500">Payment</span><span>{invoice.paymentMethod}</span></div>
              </div>

              <div className="border-b border-dashed border-gray-200 pb-2 mb-2 space-y-1.5">
                {(invoice.items||[]).map((item,i)=>(
                  <div key={i}>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex-1 truncate mr-2">{item.productName}</span>
                      <span>${item.lineTotal?.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-gray-400 pl-1">
                      {item.quantity} × ${item.unitPrice?.toFixed(2)}
                      {item.discount>0&&` − $${item.discount.toFixed(2)}`}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 mb-3">
                {invoice.discountTotal>0&&<div className="flex justify-between text-xs text-green-600"><span>Discount</span><span>−${invoice.discountTotal?.toFixed(2)}</span></div>}
                {invoice.taxAmount>0&&<div className="flex justify-between text-xs text-gray-500"><span>Tax ({invoice.taxRate}%)</span><span>${invoice.taxAmount?.toFixed(2)}</span></div>}
                <div className="flex justify-between font-black text-base pt-1 border-t border-gray-200">
                  <span>TOTAL</span><span>${(invoice?.grandTotal || 0).toFixed(2)}</span>
                </div>
                {cashReceived>0&&invoice.paymentMethod==='Cash'&&(
                  <>
                    <div className="flex justify-between text-xs text-gray-500"><span>Cash Received</span><span>${parseFloat(cashReceived).toFixed(2)}</span></div>
                    <div className="flex justify-between text-sm font-bold text-green-600"><span>Change</span><span>${parseFloat(changeAmount||0).toFixed(2)}</span></div>
                  </>
                )}
                {invoice.balanceDue>0&&<div className="flex justify-between text-sm font-bold text-red-500"><span>Balance Due</span><span>${invoice.balanceDue?.toFixed(2)}</span></div>}
              </div>

              <div className="text-center text-xs text-gray-400 border-t border-dashed border-gray-200 pt-3">
                <p>Thank you for shopping at</p>
                <p className="font-bold text-gray-600 mt-0.5">Abdulmula Fashion!</p>
                <p className="mt-1">★ Quality Fashion ★</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 px-4 pb-5 pt-3 border-t border-gray-100 print:hidden">
            <button onClick={handlePrint} className="flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-1.5 text-white text-sm" style={{background:'#111'}}>
              <Printer size={16}/> Print
            </button>
            <button onClick={handleWhatsApp} className="flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-1.5 text-white text-sm bg-green-600">
              <MessageCircle size={16}/> WhatsApp
            </button>
            <button onClick={handleShare} className="py-3 px-4 rounded-2xl font-bold flex items-center justify-center text-sm" style={{background:'#d4a017',color:'#111'}}>
              <Share2 size={16}/>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function buildText(invoice, cashReceived, changeAmount) {
  return [
    '==============================',
    '      ABDULMULA FASHION',
    'Konyo-Konyo Market, Juba, SS',
    '==============================',
    `Date: ${new Date(invoice.date||Date.now()).toLocaleString()}`,
    `Invoice: ${invoice?.invoiceNumber}`,
    invoice.soldByName   ? `Cashier: ${invoice.soldByName}` : '',
    invoice.customerName ? `Customer: ${invoice.customerName}` : '',
    `Payment: ${invoice?.paymentMethod}`,
    '------------------------------',
    ...(invoice.items||[]).map(i=>`${i.productName}\n  ${i.quantity}x$${i.unitPrice?.toFixed(2)} = $${i.lineTotal?.toFixed(2)}`),
    '------------------------------',
    `TOTAL: $${invoice?.grandTotal?.toFixed(2)}`,
    cashReceived>0&&invoice.paymentMethod==='Cash' ? `Cash: $${parseFloat(cashReceived).toFixed(2)}\nChange: $${parseFloat(changeAmount||0).toFixed(2)}` : '',
    invoice.balanceDue>0 ? `BALANCE DUE: $${invoice.balanceDue?.toFixed(2)}` : '',
    '==============================',
    'Thank you for shopping with us!',
    '==============================' 
  ].filter(Boolean).join('\n');
}
