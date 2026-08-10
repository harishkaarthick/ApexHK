import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Package, User, ClipboardList, Truck, ClipboardCheck, Wallet, ExternalLink,
  Loader2, ImageOff, ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

import api from '@/lib/axios';
import { unwrap, dt, money } from '@/pages/pageShared';
import type { ReturnRequest, ReturnStatus } from '@/types';
import { getStatusMeta } from './statusMeta';
import ReturnStatusTracker from './ReturnStatusTracker';

interface ReturnDetailPanelProps {
  returnId: string;
  onClose: () => void;
}

export default function ReturnDetailPanel({ returnId, onClose }: ReturnDetailPanelProps) {
  const qc = useQueryClient();

  const { data: r, isLoading, isError } = useQuery({
    queryKey: ['vendor-return', returnId],
    queryFn: () => api.get(`/vendor/returns/${returnId}`).then((res) => unwrap<ReturnRequest>(res)),
    enabled: !!returnId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['vendor-return', returnId] });
    qc.invalidateQueries({ queryKey: ['vendor-returns'] });
    qc.invalidateQueries({ queryKey: ['vendor-pending-returns'] });
    qc.invalidateQueries({ queryKey: ['vendor-returns-analytics-sample'] });
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-[#F8F9FC] shadow-2xl"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Return #{returnId.slice(-5).toUpperCase()}
            </h2>
            {r && <p className="text-xs text-slate-400">Order: #{r.orderId.slice(-8).toUpperCase()}</p>}
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : isError || !r ? (
            <p className="py-10 text-center text-sm text-slate-400">Couldn't load this return. Try again.</p>
          ) : (
            <ReturnDetailBody r={r} onChanged={invalidate} />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function ReturnDetailBody({ r, onChanged }: { r: ReturnRequest; onChanged: () => void }) {
  const meta = getStatusMeta(r.status);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const images = r.evidenceImages ?? [];

  return (
    <div className="space-y-6">
      {/* Status + tracker */}
      <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          <p className="text-xs text-slate-400">Requested {dt(r.createdAt)}</p>
        </div>
        <div className="mt-5">
          <ReturnStatusTracker status={r.status} />
        </div>
      </section>

      {/* Product info */}
      <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
        <SectionTitle icon={Package} label="Product" />
        <div className="mt-3 flex gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-300">
            {r.productImage ? (
              <img src={r.productImage} alt={r.productName} className="h-full w-full object-cover" />
            ) : (
              <ImageOff className="h-6 w-6" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">{r.productName}</p>
            <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-slate-500">
              <div>
                <p className="text-slate-400">Qty returning</p>
                <p className="font-medium text-slate-700">{r.quantity ?? '—'}</p>
              </div>
              <div>
                <p className="text-slate-400">Unit price</p>
                <p className="font-medium text-slate-700">{r.unitPrice ? money(r.unitPrice) : '—'}</p>
              </div>
              <div>
                <p className="text-slate-400">Refund amount</p>
                <p className="font-medium text-slate-700">{money(r.refundAmount || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Order context */}
      <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
        <SectionTitle icon={ClipboardList} label="Order context" />
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Order ID" value={`#${r.orderId.slice(-8).toUpperCase()}`} />
          <InfoRow label="Order Item ID" value={r.orderItemId ? `#${r.orderItemId.slice(-8).toUpperCase()}` : '—'} />
        </div>
        <Link
          to={`/vendor/orders?orderId=${r.orderId}`}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700"
        >
          View parent order <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </section>

      {/* Customer info */}
      <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
        <SectionTitle icon={User} label="Customer" />
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Name" value={r.customerName || '—'} />
          <InfoRow label="Email" value={r.customerEmail || '—'} />
        </div>
        <div className="mt-3">
          <p className="text-xs text-slate-400">Reason</p>
          <p className="text-sm font-medium text-slate-700">{r.reason.replace(/_/g, ' ')}</p>
        </div>
        {r.description && (
          <div className="mt-3">
            <p className="text-xs text-slate-400">Description</p>
            <p className="whitespace-pre-wrap text-sm text-slate-600">{r.description}</p>
          </div>
        )}
        {r.rejectionReason && (
          <div className="mt-3">
            <p className="text-xs text-slate-400">Rejection reason</p>
            <p className="whitespace-pre-wrap text-sm text-red-500">{r.rejectionReason}</p>
          </div>
        )}
      </section>

      {/* Evidence photos */}
      {images.length > 0 && (
        <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
          <SectionTitle icon={ImageOff} label="Evidence photos" />
          <div className="mt-3 grid grid-cols-4 gap-2">
            {images.map((src, i) => (
              <button
                key={src + i}
                onClick={() => setLightboxIndex(i)}
                className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              >
                <img src={src} alt={`Evidence ${i + 1}`} className="h-full w-full object-cover transition hover:scale-105" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Pickup details */}
      {(r.pickupDate || r.pickupAddress || r.trackingNumber) && (
        <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
          <SectionTitle icon={Truck} label="Pickup details" />
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="Pickup date" value={r.pickupDate || '—'} />
            <InfoRow label="Tracking number" value={r.trackingNumber || '—'} />
          </div>
          {r.pickupAddress && (
            <div className="mt-3">
              <p className="text-xs text-slate-400">Pickup address</p>
              <p className="text-sm text-slate-600">{r.pickupAddress}</p>
            </div>
          )}
        </section>
      )}

      {/* Quality check outcome */}
      {r.qualityCheckPassed !== null && r.qualityCheckPassed !== undefined && (
        <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
          <SectionTitle icon={ClipboardCheck} label="Quality check" />
          <div className="mt-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                r.qualityCheckPassed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
              }`}
            >
              {r.qualityCheckPassed ? 'Passed' : 'Failed'}
            </span>
            {r.qualityCheckNotes && <p className="mt-2 text-sm text-slate-600">{r.qualityCheckNotes}</p>}
          </div>
        </section>
      )}

      {/* Refund details */}
      {(r.refundMethod || r.razorpayRefundId) && (
        <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
          <SectionTitle icon={Wallet} label="Refund" />
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="Method" value={r.refundMethod?.replace(/_/g, ' ') || '—'} />
            <InfoRow label="Razorpay refund ID" value={r.razorpayRefundId || '—'} />
          </div>
        </section>
      )}

      {/* Timestamps */}
      <section className="rounded-[20px] bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
        <SectionTitle icon={ClipboardList} label="Timestamps" />
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <InfoRow label="Created" value={dt(r.createdAt)} />
          <InfoRow label="Updated" value={r.updatedAt ? dt(r.updatedAt) : '—'} />
          <InfoRow label="Resolved" value={r.resolvedAt ? dt(r.resolvedAt) : '—'} />
        </div>
      </section>

      {/* Action */}
      <ReturnActionBar r={r} onChanged={onChanged} />

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            images={images}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onIndexChange={setLightboxIndex}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
      <Icon className="h-4 w-4 text-slate-400" />
      {label}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-700">{value}</p>
    </div>
  );
}

function Lightbox({
  images, index, onClose, onIndexChange,
}: { images: string[]; index: number; onClose: () => void; onIndexChange: (i: number) => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/80 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <button onClick={onClose} className="absolute right-6 top-6 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onIndexChange((index - 1 + images.length) % images.length); }}
            className="absolute left-6 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onIndexChange((index + 1) % images.length); }}
            className="absolute right-6 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
      <motion.img
        key={index}
        src={images[index]}
        alt={`Evidence ${index + 1}`}
        className="max-h-[80vh] max-w-[80vw] rounded-xl object-contain"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  );
}

// ── Contextual action button, mirrors the backend return-status state machine ──

function ReturnActionBar({ r, onChanged }: { r: ReturnRequest; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);

  const run = async (fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
      onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const TERMINAL: ReturnStatus[] = ['REFUNDED', 'REJECTED', 'FINAL_REJECTED', 'REJECTED_POST_QUALITY_CHECK'];
  if (TERMINAL.includes(r.status)) {
    return (
      <div className="rounded-[20px] border border-dashed border-slate-200 bg-white p-5 text-center">
        <p className="text-sm font-medium text-slate-500">
          {r.status === 'REFUNDED' && 'This return has been refunded. No further action needed.'}
          {r.status === 'REJECTED' && 'This return was rejected.'}
          {r.status === 'FINAL_REJECTED' && 'This return was rejected after appeal review.'}
          {r.status === 'REJECTED_POST_QUALITY_CHECK' && 'This return failed quality check and was rejected.'}
        </p>
      </div>
    );
  }

  const btnClass = 'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 px-4 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60';
  const dangerBtnClass = 'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 text-sm font-semibold text-white shadow-md shadow-red-500/20 transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60';

  return (
    <div className="sticky bottom-0 -mx-6 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
      <div className="flex gap-3">
        {r.status === 'RETURN_REQUESTED' && (
          <button
            disabled={busy}
            className={btnClass}
            onClick={() => run(() => api.put(`/vendor/returns/${r.id}/review`, { status: 'UNDER_REVIEW' }), 'Moved to Under Review')}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Start Review
          </button>
        )}

        {r.status === 'UNDER_REVIEW' && (
          <>
            <button
              disabled={busy}
              className={btnClass}
              onClick={() => run(() => api.post(`/vendor/returns/${r.id}/approve`), 'Return approved')}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Approve
            </button>
            <button disabled={busy} className={dangerBtnClass} onClick={() => setShowRejectModal(true)}>
              Reject
            </button>
          </>
        )}

        {r.status === 'APPROVED' && (
          <button disabled={busy} className={btnClass} onClick={() => setShowPickupModal(true)}>
            Schedule Pickup
          </button>
        )}

        {r.status === 'PICKUP_SCHEDULED' && (
          <button
            disabled={busy}
            className={btnClass}
            onClick={() => run(() => api.put(`/vendor/returns/${r.id}/pickup/mark`), 'Marked as picked up')}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Mark as Picked Up
          </button>
        )}

        {r.status === 'PICKED_UP' && (
          <button
            disabled={busy}
            className={btnClass}
            onClick={() => run(() => api.put(`/vendor/returns/${r.id}/warehouse/receive`), 'Marked as received at warehouse')}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Mark as Received at Warehouse
          </button>
        )}

        {r.status === 'RECEIVED_AT_WAREHOUSE' && (
          <button disabled={busy} className={btnClass} onClick={() => setShowQualityModal(true)}>
            Run Quality Check
          </button>
        )}

        {r.status === 'QUALITY_CHECK' && (
          <button disabled={busy} className={btnClass} onClick={() => setShowRefundModal(true)}>
            Initiate Refund
          </button>
        )}

        {r.status === 'REFUND_INITIATED' && (
          <button
            disabled={busy}
            className={btnClass}
            onClick={() => run(() => api.put(`/vendor/returns/${r.id}/refund/complete`), 'Refund completed')}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Complete Refund
          </button>
        )}
      </div>

      <AnimatePresence>
        {showRejectModal && (
          <ActionModal
            title="Reject Return"
            subtitle="Provide a reason for rejecting this return request."
            onClose={() => setShowRejectModal(false)}
          >
            <RejectForm
              busy={busy}
              onSubmit={(reason) => run(() => api.post(`/vendor/returns/${r.id}/reject`, { reason }), 'Return rejected').then(() => setShowRejectModal(false))}
            />
          </ActionModal>
        )}

        {showPickupModal && (
          <ActionModal title="Schedule Pickup" subtitle="Enter pickup date and address." onClose={() => setShowPickupModal(false)}>
            <PickupForm
              busy={busy}
              onSubmit={(date, address) =>
                run(() => api.put(`/vendor/returns/${r.id}/pickup`, { pickupDate: date, pickupAddress: address }), 'Pickup scheduled').then(() =>
                  setShowPickupModal(false),
                )
              }
            />
          </ActionModal>
        )}

        {showQualityModal && (
          <ActionModal title="Run Quality Check" subtitle="Record the inspection outcome." onClose={() => setShowQualityModal(false)}>
            <QualityForm
              busy={busy}
              onSubmit={(passed, notes) =>
                run(() => api.put(`/vendor/returns/${r.id}/quality/check`, { passed, notes }), 'Quality check recorded').then(() =>
                  setShowQualityModal(false),
                )
              }
            />
          </ActionModal>
        )}

        {showRefundModal && (
          <ActionModal title="Initiate Refund" subtitle="Select refund method." onClose={() => setShowRefundModal(false)}>
            <RefundForm
              busy={busy}
              onSubmit={(method) =>
                run(() => api.put(`/vendor/returns/${r.id}/refund/initiate`, { refundMethod: method }), 'Refund initiated').then(() =>
                  setShowRefundModal(false),
                )
              }
            />
          </ActionModal>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionModal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[20px] bg-white p-6 shadow-2xl"
        initial={{ scale: 0.94, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </motion.div>
    </motion.div>
  );
}

function RejectForm({ busy, onSubmit }: { busy: boolean; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <>
      <label className="text-sm font-medium text-slate-700">Rejection Reason</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-1.5 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
        placeholder="Enter rejection reason..."
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          disabled={busy || !reason.trim()}
          onClick={() => onSubmit(reason)}
          className="rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-red-500/20 disabled:opacity-50"
        >
          {busy && <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />} Reject Return
        </button>
      </div>
    </>
  );
}

function PickupForm({ busy, onSubmit }: { busy: boolean; onSubmit: (date: string, address: string) => void }) {
  const [date, setDate] = useState('');
  const [address, setAddress] = useState('');
  return (
    <>
      <label className="text-sm font-medium text-slate-700">Pickup Date</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
      />
      <label className="mt-4 block text-sm font-medium text-slate-700">Pickup Address</label>
      <textarea
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
        placeholder="Enter pickup address..."
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          disabled={busy || !date || !address}
          onClick={() => onSubmit(date, address)}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/20 disabled:opacity-50"
        >
          {busy && <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />} Schedule Pickup
        </button>
      </div>
    </>
  );
}

function QualityForm({ busy, onSubmit }: { busy: boolean; onSubmit: (passed: boolean, notes: string) => void }) {
  const [passed, setPassed] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  return (
    <>
      <label className="text-sm font-medium text-slate-700">Outcome</label>
      <div className="mt-1.5 flex gap-2">
        <button
          onClick={() => setPassed(true)}
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
            passed === true ? 'border-emerald-400 bg-emerald-50 text-emerald-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          Pass
        </button>
        <button
          onClick={() => setPassed(false)}
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
            passed === false ? 'border-red-400 bg-red-50 text-red-500' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          Fail
        </button>
      </div>
      <label className="mt-4 block text-sm font-medium text-slate-700">Notes</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
        placeholder="Inspection notes..."
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          disabled={busy || passed === null}
          onClick={() => onSubmit(passed as boolean, notes)}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/20 disabled:opacity-50"
        >
          {busy && <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />} Save Outcome
        </button>
      </div>
    </>
  );
}

function RefundForm({ busy, onSubmit }: { busy: boolean; onSubmit: (method: string) => void }) {
  const [method, setMethod] = useState('ORIGINAL_PAYMENT');
  return (
    <>
      <label className="text-sm font-medium text-slate-700">Refund Method</label>
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
      >
        <option value="ORIGINAL_PAYMENT">Original Payment</option>
        <option value="WALLET_CREDIT">Wallet Credit</option>
        <option value="STORE_CREDIT">Store Credit</option>
      </select>
      <div className="mt-4 flex justify-end gap-2">
        <button
          disabled={busy}
          onClick={() => onSubmit(method)}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/20 disabled:opacity-50"
        >
          {busy && <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />} Initiate Refund
        </button>
      </div>
    </>
  );
}
