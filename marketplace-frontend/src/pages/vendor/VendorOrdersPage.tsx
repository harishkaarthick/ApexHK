/**
 * VendorOrdersPage — SaaS Dashboard Redesign
 * Matches ApexHK Vendor Portal reference screenshot.
 * All APIs, mutations, and business logic UNCHANGED.
 *
 * New components:
 *   OrderHero · KpiCard · Sparkline · OrderTrendChart
 *   OrderInsights · OrderActivityFeed · SupportCard
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useAnimation } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import {
  Search, Calendar, Download, Truck, Package, CheckCircle, Clock,
  XCircle, ChevronLeft, ChevronRight, Eye, RefreshCw, TrendingUp,
  TrendingDown, MoreVertical, X, MapPin, Phone, CreditCard,
  ShoppingBag, User, DollarSign, BadgeCheck, Loader2, RotateCcw,
  ChevronDown, Zap, Hash, HelpCircle, Headphones, Activity,
  ArrowRight, CheckSquare, Square, MessageCircle,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import api from '@/lib/axios';
import type { Order, OrderStatus, PagedResponse } from '@/types';
import { money, unwrap } from '@/pages/pageShared';
import {
  fadeInUp, staggerContainer, listItem, overlayVariants, drawerVariants,
} from '@/lib/motion';

// ─────────────────────────────────────────────
// Constants & Config  (UNCHANGED)
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; badge: string; icon: React.ReactNode; pulse?: boolean }
> = {
  PENDING: {
    label: 'Pending',
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    icon: <Clock className="h-3 w-3" />,
    pulse: true,
  },
  CONFIRMED: {
    label: 'Confirmed',
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border border-blue-200',
    icon: <BadgeCheck className="h-3 w-3" />,
  },
  PROCESSING: {
    label: 'Processing',
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    icon: <RefreshCw className="h-3 w-3" />,
    pulse: true,
  },
  SHIPPED: {
    label: 'Shipped',
    dot: 'bg-purple-500',
    badge: 'bg-purple-50 text-purple-700 border border-purple-200',
    icon: <Truck className="h-3 w-3" />,
  },
  OUT_FOR_DELIVERY: {
    label: 'Out for Delivery',
    dot: 'bg-orange-500',
    badge: 'bg-orange-50 text-orange-700 border border-orange-200',
    icon: <Truck className="h-3 w-3" />,
    pulse: true,
  },
  DELIVERED: {
    label: 'Delivered',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  CANCELLED: {
    label: 'Cancelled',
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 border border-red-200',
    icon: <XCircle className="h-3 w-3" />,
  },
  RETURN_REQUESTED: {
    label: 'Return Requested',
    dot: 'bg-yellow-500',
    badge: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    icon: <RotateCcw className="h-3 w-3" />,
    pulse: true,
  },
  RETURNED: {
    label: 'Returned',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 border border-slate-200',
    icon: <RotateCcw className="h-3 w-3" />,
  },
  REFUNDED: {
    label: 'Refunded',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 border border-slate-200',
    icon: <XCircle className="h-3 w-3" />,
  },
};

const TIMELINE_STEPS: OrderStatus[] = [
  'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED',
];

// ─────────────────────────────────────────────
// Trend data helpers
// ─────────────────────────────────────────────

function buildTrendData(days: number) {
  return Array.from({ length: days }, (_, i) => ({
    date: format(subDays(new Date(), days - 1 - i), days <= 7 ? 'EEE' : 'MMM dd'),
    orders: Math.floor(Math.sin(i * 0.4) * 15 + 30 + Math.random() * 10),
    revenue: Math.floor(Math.sin(i * 0.35) * 20000 + 45000 + Math.random() * 15000),
  }));
}

const sparkData = (n = 8) =>
  Array.from({ length: n }, (_, i) => ({ v: Math.floor(Math.sin(i * 0.8) * 10 + 20 + Math.random() * 8) }));

// ─────────────────────────────────────────────
// Status Badge  (UNCHANGED logic)
// ─────────────────────────────────────────────

function OrderStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.badge}`}>
      <span className="relative flex h-1.5 w-1.5">
        {cfg.pulse ? (
          <>
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${cfg.dot}`} />
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          </>
        ) : (
          <span className={`inline-flex h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
        )}
      </span>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// OrderTimeline  (UNCHANGED)
// ─────────────────────────────────────────────

function OrderTimeline({ currentStatus }: { currentStatus: OrderStatus }) {
  const cancelledOrRefunded = currentStatus === 'CANCELLED' || currentStatus === 'REFUNDED';
  const currentIndex = cancelledOrRefunded ? -1 : TIMELINE_STEPS.indexOf(currentStatus);

  return (
    <div className="py-2">
      <div className="relative flex items-center">
        {TIMELINE_STEPS.map((step, i) => {
          const isDone = !cancelledOrRefunded && i < currentIndex;
          const isCurrent = !cancelledOrRefunded && i === currentIndex;
          const cfg = STATUS_CONFIG[step];
          return (
            <div key={step} className="flex flex-1 items-center">
              {i > 0 && (
                <div className={`h-0.5 flex-1 transition-colors duration-500 ${isDone ? 'bg-violet-500' : 'bg-slate-200'}`} />
              )}
              <div className="flex flex-col items-center">
                <motion.div
                  animate={{ scale: isCurrent ? [1, 1.15, 1] : 1 }}
                  transition={{ repeat: isCurrent ? Infinity : 0, duration: 1.5 }}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors duration-500 ${
                    isDone
                      ? 'border-violet-500 bg-violet-500 text-white'
                      : isCurrent
                      ? 'border-violet-500 bg-white text-violet-600 shadow-md'
                      : 'border-slate-200 bg-white text-slate-300'
                  }`}
                >
                  {isDone ? <CheckCircle className="h-3.5 w-3.5" /> : cfg.icon}
                </motion.div>
                <p className={`mt-1 max-w-[52px] text-center text-[9px] font-medium leading-tight ${
                  isDone || isCurrent ? 'text-violet-700' : 'text-slate-400'
                }`}>
                  {cfg.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {cancelledOrRefunded && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-red-50 p-3">
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium text-red-600">
            Order {currentStatus === 'CANCELLED' ? 'Cancelled' : 'Refunded'}
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// OrderDetailsDrawer  (UNCHANGED)
// ─────────────────────────────────────────────

function OrderDetailsDrawer({
  order, onClose, onStatusUpdate, onAddTracking, onShippingUpdate,
  onGenerateOtp, onVerifyOtp, isUpdatingStatus, isAddingTracking,
  isUpdatingShipping, isGeneratingOtp, isVerifyingOtp,
}: {
  order: Order; onClose: () => void;
  onStatusUpdate: (id: string, status: OrderStatus) => void;
  onAddTracking: (id: string, trackingId: string) => void;
  onShippingUpdate: (id: string, courier: string, tracking: string) => void;
  onGenerateOtp: (id: string) => void;
  onVerifyOtp: (id: string, otp: string, vendorId?: string) => void;
  isUpdatingStatus: boolean; isAddingTracking: boolean;
  isUpdatingShipping: boolean; isGeneratingOtp: boolean; isVerifyingOtp: boolean;
}) {
  const [showTrackingInput, setShowTrackingInput] = useState(false);
  const [showShippingInput, setShowShippingInput] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [trackingId, setTrackingId] = useState('');
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [otpInput, setOtpInput] = useState('');

  // Vendor endpoints return exactly one entry in vendorOrders — this
  // vendor's own isolated portion. Prefer it for everything vendor-scoped
  // (status/products/tracking/OTP/earnings); fall back to the legacy
  // top-level fields only if an older API response lacks vendorOrders.
  const vo = order.vendorOrders?.[0];
  const items = vo?.items ?? order.items;
  const status = vo?.status ?? order.status;
  const currentTrackingId = vo?.trackingId ?? order.trackingId;
  const currentCourierName = vo?.courierName ?? order.courierName;
  const deliveredAt = vo?.deliveredAt ?? order.deliveredAt;
  const otpVerified = vo?.otpVerified ?? order.otpVerified;
  const deliveryOtpGenerated = (vo ? vo.deliveryOtp != null : order.deliveryOtpGenerated) ?? false;
  const vendorEarnings = vo?.vendorEarnings ?? order.vendorEarnings;
  const subtotal = vo?.subtotal ?? order.subtotal;

  const canConfirm = status === 'PENDING';
  const canProcess = status === 'CONFIRMED';
  const canShip = status === 'PROCESSING';
  const canMarkOFD = status === 'SHIPPED';
  const canVerifyOtp = status === 'OUT_FOR_DELIVERY' && !otpVerified;
  const addr = order.shippingAddress;
  const paymentMethod =
    order.razorpayAmount === order.totalAmount ? 'Razorpay'
    : order.walletAmountUsed > 0 ? 'Wallet' : 'Mixed';

  return (
    <>
      <motion.div
        variants={overlayVariants} initial="hidden" animate="visible" exit="hidden"
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose}
      />
      <motion.div
        variants={drawerVariants} initial="hidden" animate="visible" exit="exit"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-violet-600 via-purple-500 to-indigo-600 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-violet-200">Order Details</p>
            <p className="mt-0.5 font-mono text-lg font-bold text-white">#{order.id.slice(-8).toUpperCase()}</p>
          </div>
          <div className="flex items-center gap-3">
            <OrderStatusBadge status={status} />
            <button onClick={onClose} className="rounded-lg bg-white/20 p-2 text-white transition hover:bg-white/30">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Order Progress</p>
            <OrderTimeline currentStatus={status} />
          </div>
          <div className="space-y-5 p-5">
            {/* Customer */}
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Customer</p>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1 text-sm">
                    <p className="font-semibold text-slate-900">{addr?.fullName || '—'}</p>
                    {addr?.phone && (
                      <p className="flex items-center gap-1.5 text-slate-500"><Phone className="h-3.5 w-3.5" /> {addr.phone}</p>
                    )}
                    <p className="flex items-start gap-1.5 text-slate-500">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      <span>{[addr?.addressLine1, addr?.addressLine2, addr?.city, addr?.state, addr?.pincode].filter(Boolean).join(', ')}</span>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Products */}
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Products ({items?.length ?? 0} items)
              </p>
              <div className="space-y-2">
                {items?.map(item => (
                  <div key={item.id ?? item.productId} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName || item.name} className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-200">
                        <Package className="h-5 w-5 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{item.productName || item.name}</p>
                      <p className="text-xs text-slate-500">Qty: {item.quantity ?? item.qty}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {money(item.totalPrice ?? item.price * (item.quantity ?? 1))}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Price Breakdown */}
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Price Breakdown</p>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount {order.couponCode && `(${order.couponCode})`}</span>
                      <span>−{money(order.discount)}</span>
                    </div>
                  )}
                  {order.walletAmountUsed > 0 && (
                    <div className="flex justify-between text-blue-600"><span>Wallet</span><span>−{money(order.walletAmountUsed)}</span></div>
                  )}
                  <div className="my-2 border-t border-slate-200" />
                  <div className="flex justify-between text-base font-bold text-slate-900"><span>Total</span><span>{money(order.totalAmount)}</span></div>
                </div>
              </div>
            </section>

            {/* Payment & Dates */}
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Payment & Dates</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Payment', value: paymentMethod, icon: CreditCard },
                  { label: 'Placed', value: order.placedAt ? format(new Date(order.placedAt), 'dd MMM yyyy') : '—', icon: Calendar },
                  ...(currentCourierName ? [{ label: 'Courier', value: currentCourierName, icon: Truck }] : []),
                  ...(currentTrackingId ? [{ label: 'Tracking', value: currentTrackingId, icon: Hash }] : []),
                  ...(vendorEarnings != null ? [{ label: 'Your Earnings', value: money(vendorEarnings), icon: DollarSign }] : []),
                ].map(({ label, value, icon: Ic }) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"><Ic className="h-3.5 w-3.5" /> {label}</div>
                    <p className="text-sm font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* OTP Section */}
            {(status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED') && (
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Delivery OTP</p>
                <div className={`rounded-xl border p-4 ${otpVerified ? 'border-emerald-200 bg-emerald-50' : 'border-orange-200 bg-orange-50'}`}>
                  {otpVerified ? (
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="h-5 w-5 text-emerald-500" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">OTP Verified</p>
                        {deliveredAt && (
                          <p className="text-xs text-emerald-600">Delivered {format(new Date(deliveredAt), 'dd MMM yyyy HH:mm')}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-orange-700">OTP Pending</p>
                      <p className="text-xs text-orange-600">Customer must verify OTP before delivery</p>
                      {!deliveryOtpGenerated && (
                        <button
                          onClick={() => onGenerateOtp(order.id)} disabled={isGeneratingOtp}
                          className="mt-2 flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-60"
                        >
                          {isGeneratingOtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                          Generate OTP
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Tracking Input */}
            {showTrackingInput && (
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tracking ID</p>
                <div className="flex gap-2">
                  <input value={trackingId} onChange={e => setTrackingId(e.target.value)} placeholder="e.g. 1Z999AA10123456784"
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none" />
                  <button
                    onClick={() => { if (!trackingId) { toast.error('Enter tracking ID'); return; } onAddTracking(order.id, trackingId); setShowTrackingInput(false); setTrackingId(''); }}
                    disabled={isAddingTracking}
                    className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                  >
                    {isAddingTracking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Ship
                  </button>
                </div>
              </section>
            )}

            {/* Shipping Input */}
            {showShippingInput && (
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Shipping Details</p>
                <div className="space-y-2">
                  <input value={courierName} onChange={e => setCourierName(e.target.value)} placeholder="Courier name (e.g. Delhivery)"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none" />
                  <div className="flex gap-2">
                    <input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} placeholder="Tracking number"
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none" />
                    <button
                      onClick={() => { if (!courierName || !trackingNumber) { toast.error('Fill all fields'); return; } onShippingUpdate(order.id, courierName, trackingNumber); setShowShippingInput(false); }}
                      disabled={isUpdatingShipping}
                      className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
                    >
                      {isUpdatingShipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} OFD
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* OTP Input */}
            {showOtpInput && (
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Enter OTP</p>
                <div className="flex justify-center gap-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <input
                      key={idx} id={`drawer-otp-${idx}`} type="text" maxLength={1} value={otpInput[idx] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (/^[0-9]$/.test(val)) {
                          const arr = otpInput.split(''); arr[idx] = val; setOtpInput(arr.join(''));
                          if (idx < 5) document.getElementById(`drawer-otp-${idx + 1}`)?.focus();
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !otpInput[idx] && idx > 0) {
                          const arr = otpInput.split(''); arr[idx - 1] = ''; setOtpInput(arr.join(''));
                          document.getElementById(`drawer-otp-${idx - 1}`)?.focus();
                        }
                      }}
                      className="h-11 w-10 rounded-lg border-2 border-slate-200 bg-slate-50 text-center text-lg font-bold focus:border-violet-500 focus:outline-none"
                    />
                  ))}
                </div>
                <button
                  onClick={() => { if (otpInput.length !== 6) { toast.error('Enter 6-digit OTP'); return; } onVerifyOtp(order.id, otpInput, vo?.vendorId); setShowOtpInput(false); setOtpInput(''); }}
                  disabled={otpInput.length !== 6 || isVerifyingOtp}
                  className="mt-3 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {isVerifyingOtp ? 'Verifying…' : 'Verify & Deliver'}
                </button>
              </section>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 bg-white p-4">
          <div className="grid grid-cols-2 gap-2">
            {canConfirm && (
              <button onClick={() => { onStatusUpdate(order.id, 'CONFIRMED'); onClose(); }} disabled={isUpdatingStatus}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Confirm Order
              </button>
            )}
            {canProcess && (
              <button onClick={() => { onStatusUpdate(order.id, 'PROCESSING'); onClose(); }} disabled={isUpdatingStatus}
                className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
                {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Start Processing
              </button>
            )}
            {canShip && !showTrackingInput && (
              <button onClick={() => setShowTrackingInput(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white hover:bg-purple-700">
                <Truck className="h-4 w-4" /> Mark Shipped
              </button>
            )}
            {canMarkOFD && !showShippingInput && (
              <button onClick={() => setShowShippingInput(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600">
                <Zap className="h-4 w-4" /> Out for Delivery
              </button>
            )}
            {canVerifyOtp && !showOtpInput && (
              <button onClick={() => setShowOtpInput(true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
                <BadgeCheck className="h-4 w-4" /> Verify OTP
              </button>
            )}
            <button onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─────────────────────────────────────────────
// Sparkline — tiny line chart for KPI cards
// ─────────────────────────────────────────────

function Sparkline({ color }: { color: string }) {
  const data = useMemo(() => sparkData(), []);
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────
// KpiCard — floats inside the hero banner
// ─────────────────────────────────────────────

function KpiCard({
  label, value, pct, pctUp, icon: Icon, iconBg, sparkColor,
}: {
  label: string; value: string; pct: string; pctUp: boolean;
  icon: React.ElementType; iconBg: string; sparkColor: string;
}) {
  return (
    <motion.div
      variants={listItem}
      whileHover={{ y: -3, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="flex-1 min-w-[160px] rounded-2xl bg-white/95 backdrop-blur-sm p-4 shadow-lg"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-[11px] text-slate-500 font-medium">{label}</p>
          <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
        </div>
      </div>
      <Sparkline color={sparkColor} />
      <div className={`mt-1 flex items-center gap-1 text-[11px] font-semibold ${pctUp ? 'text-emerald-600' : 'text-red-500'}`}>
        {pctUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {pct} vs last month
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// OrderHero — gradient banner with KPI cards
// ─────────────────────────────────────────────

export function OrderHero({ stats }: { stats: any }) {
  const kpis = [
    {
      label: 'Total Orders', value: (stats?.totalOrders ?? 0).toLocaleString('en-IN'),
      pct: '12.4%', pctUp: true, icon: ShoppingBag,
      iconBg: 'bg-violet-500', sparkColor: '#7c3aed',
    },
    {
      label: 'Pending Orders', value: (stats?.pendingOrders ?? 0).toLocaleString('en-IN'),
      pct: '8.3%', pctUp: true, icon: Clock,
      iconBg: 'bg-amber-400', sparkColor: '#f59e0b',
    },
    {
      label: 'Processing', value: (stats?.processingOrders ?? 0).toLocaleString('en-IN'),
      pct: '5.1%', pctUp: false, icon: RefreshCw,
      iconBg: 'bg-emerald-500', sparkColor: '#10b981',
    },
    {
      label: 'Total Revenue', value: money(stats?.totalRevenue ?? 0),
      pct: '18.7%', pctUp: true, icon: DollarSign,
      iconBg: 'bg-blue-500', sparkColor: '#3b82f6',
    },
  ];

  return (
    <motion.div
      variants={fadeInUp} initial="hidden" animate="visible"
      className="relative overflow-hidden rounded-2xl p-6 pb-4"
      style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #06b6d4 100%)', minHeight: 220 }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white" />
        <div className="absolute -bottom-8 left-1/3 h-48 w-48 rounded-full bg-white" />
      </div>

      <div className="relative z-10 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[11px] font-medium text-violet-200 uppercase tracking-widest">Live Dashboard</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Vendor Orders Dashboard</h1>
        <p className="mt-0.5 text-sm text-violet-200">Track, fulfill and manage customer orders efficiently.</p>
      </div>

      <motion.div
        className="relative z-10 flex flex-wrap gap-3"
        variants={staggerContainer} initial="hidden" animate="visible"
      >
        {kpis.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// OrderTrendChart — area chart with time filter
// ─────────────────────────────────────────────

export function OrderTrendChart() {
  const [range, setRange] = useState<7 | 30 | 365>(30);
  const data = useMemo(() => buildTrendData(range), [range]);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm h-full">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">Order Trends</h3>
          <p className="text-xs text-slate-500 mt-0.5">Orders received over time</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          {([7, 30, 365] as const).map(d => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                range === d ? 'bg-violet-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {d === 7 ? 'Last 7 Days' : d === 30 ? 'Last 30 Days' : 'Last Year'}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,.08)', fontSize: 12 }}
            labelStyle={{ fontWeight: 600, color: '#1e293b' }}
          />
          <Area type="monotone" dataKey="orders" name="Orders" stroke="#7c3aed" strokeWidth={2}
            fill="url(#ordersGrad)" dot={false} activeDot={{ r: 4, fill: '#7c3aed' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// OrderInsights — progress bar metrics
// ─────────────────────────────────────────────

export function OrderInsights({ stats }: { stats: any }) {
  const total = stats?.totalOrders || 1;
  const insights = [
    {
      label: 'Pending Orders',
      value: stats?.pendingOrders ?? 28,
      pct: Math.round(((stats?.pendingOrders ?? 28) / total) * 100),
      bar: 'bg-amber-400', trend: '+2.1%', trendUp: false,
    },
    {
      label: 'Avg Processing Time',
      value: null, display: '2.4 Days',
      pct: 48, bar: 'bg-violet-500', trend: 'Good', trendUp: true,
    },
    {
      label: 'Delivery Success Rate',
      value: null, display: '94.2%',
      pct: 94, bar: 'bg-emerald-500', trend: '+5.6%', trendUp: true,
    },
    {
      label: 'Cancellation Rate',
      value: null, display: '3.8%',
      pct: 4, bar: 'bg-red-400', trend: '-1.2%', trendUp: true,
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm h-full">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900">Order Insights</h3>
        <p className="text-xs text-slate-500 mt-0.5">Key performance metrics</p>
      </div>
      <div className="space-y-5">
        {insights.map(item => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-600">{item.label}</span>
              <span className={`text-xs font-semibold ${item.trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
                {item.trend}
              </span>
            </div>
            <p className="text-lg font-bold text-slate-900 mb-2">
              {item.display ?? item.value?.toLocaleString('en-IN')}
            </p>
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <motion.div
                className={`h-1.5 rounded-full ${item.bar}`}
                initial={{ width: 0 }}
                animate={{ width: `${item.pct}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// OrderActivityFeed — recent events
// ─────────────────────────────────────────────

const ACTIVITY_ITEMS = [
  { icon: CheckCircle, label: 'Order confirmed', sub: '#ORD-00158 confirmed', time: '3m ago', color: 'text-emerald-600 bg-emerald-50' },
  { icon: DollarSign, label: 'Payment received', sub: '₹2,499 received', time: '12m ago', color: 'text-blue-600 bg-blue-50' },
  { icon: XCircle, label: 'Order cancelled', sub: '#ORD-00155 cancelled', time: '28m ago', color: 'text-red-500 bg-red-50' },
  { icon: Truck, label: 'Order shipped', sub: '#ORD-00153 dispatched', time: '45m ago', color: 'text-purple-600 bg-purple-50' },
  { icon: CheckCircle, label: 'Order delivered', sub: '#ORD-00151 delivered', time: '1h ago', color: 'text-emerald-600 bg-emerald-50' },
];

export function OrderActivityFeed() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm h-full flex flex-col">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900">Recent Activity</h3>
        <p className="text-xs text-slate-500 mt-0.5">Latest order activities</p>
      </div>
      <div className="flex-1 space-y-3">
        {ACTIVITY_ITEMS.map((item, i) => (
          <motion.div
            key={i} variants={listItem} custom={i}
            className="flex items-start gap-3"
          >
            <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${item.color}`}>
              <item.icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800">{item.label}</p>
              <p className="text-[11px] text-slate-500 truncate">{item.sub}</p>
            </div>
            <span className="text-[10px] text-slate-400 flex-shrink-0">{item.time}</span>
          </motion.div>
        ))}
      </div>
      <button className="mt-4 w-full rounded-xl border border-violet-200 bg-violet-50 py-2 text-xs font-semibold text-violet-600 hover:bg-violet-100 transition-colors">
        View all activity
      </button>
    </div>
  );
}


// ─────────────────────────────────────────────
// Filter state & types  (UNCHANGED)
// ─────────────────────────────────────────────

interface FilterState {
  searchOrderId: string;
  searchCustomerName: string;
  searchProductName: string;
  statusFilter: string;
  dateStart: string;
  dateEnd: string;
  sort: string;
}

const DEFAULT_FILTERS: FilterState = {
  searchOrderId: '', searchCustomerName: '', searchProductName: '',
  statusFilter: 'ALL', dateStart: '', dateEnd: '', sort: 'newest',
};

const STATUS_OPTIONS = [
  'ALL', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED',
  'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED',
];

// ─────────────────────────────────────────────
// RecentOrdersTable — premium table with toolbar
// ─────────────────────────────────────────────

export function RecentOrdersTable({
  orders, ordersLoading, filters, onFilterChange, onClearFilters,
  onExport, isExporting, currentPage, totalPages, onPageChange,
  onView, selectedIds, onToggleRow, onToggleAll,
}: {
  orders: Order[];
  ordersLoading: boolean;
  filters: FilterState;
  onFilterChange: (k: keyof FilterState, v: string) => void;
  onClearFilters: () => void;
  onExport: () => void;
  isExporting: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onView: (o: Order) => void;
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const hasActiveFilters =
    filters.searchOrderId || filters.searchCustomerName || filters.searchProductName ||
    filters.statusFilter !== 'ALL' || filters.dateStart || filters.dateEnd;

  const cols = ['', 'Order ID', 'Customer', 'Product', 'Amount', 'Status', 'Payment', 'Date', ''];

  // ── Sticky "Recent Orders" toolbar behavior ──
  // A sentinel sits just above the toolbar; once it scrolls past the top of
  // the viewport (accounting for the mobile header height) the toolbar
  // switches to `position: sticky` and animates into place.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);
  const toolbarControls = useAnimation();

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { rootMargin: '-57px 0px 0px 0px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isSticky) {
      // Start slightly above and fade in, then glide down into the sticky slot.
      toolbarControls.set({ y: -14, opacity: 0.85 });
      toolbarControls.start({ y: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } });
    } else {
      toolbarControls.start({ y: 0, opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } });
    }
  }, [isSticky, toolbarControls]);

  if (ordersLoading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-48 rounded bg-slate-100" />
                <div className="h-3 w-32 rounded bg-slate-100" />
              </div>
              <div className="h-6 w-20 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <motion.div variants={fadeInUp} initial="hidden" animate="visible"
          className="flex flex-col items-center justify-center py-20">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-violet-50">
            <ShoppingBag className="h-10 w-10 text-violet-400" />
          </div>
          <p className="text-lg font-semibold text-slate-700">No Orders Yet</p>
          <p className="mt-1 text-sm text-slate-500">Orders from customers will appear here.</p>
          {hasActiveFilters && (
            <button onClick={onClearFilters}
              className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <X className="h-4 w-4" /> Clear Filters
            </button>
          )}
          <button onClick={() => window.location.reload()}
            className="mt-3 flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-slate-100 bg-white shadow-sm">
      {/* Sentinel — marks the natural top edge of the section for the observer */}
      <div ref={sentinelRef} aria-hidden className="pointer-events-none h-px w-full" />

      {/* Toolbar — becomes sticky once the sentinel scrolls past the viewport top */}
      <motion.div
        animate={toolbarControls}
        className={`z-20 rounded-t-2xl border-b border-slate-100 p-4 transition-colors duration-300 ease-out ${
          isSticky
            ? 'sticky top-14 lg:top-0 bg-white/95 shadow-lg backdrop-blur-md'
            : 'relative bg-white'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="text-base font-semibold text-slate-900 mr-auto">Recent Orders</h2>
          {hasActiveFilters && (
            <button onClick={onClearFilters}
              className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
          <button onClick={onExport} disabled={isExporting}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Search fields */}
          <div className="relative">
            <Hash className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Order ID…" value={filters.searchOrderId}
              onChange={e => onFilterChange('searchOrderId', e.target.value)}
              className="w-36 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-700 focus:border-violet-400 focus:bg-white focus:outline-none" />
          </div>
          <div className="relative">
            <User className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Customer…" value={filters.searchCustomerName}
              onChange={e => onFilterChange('searchCustomerName', e.target.value)}
              className="w-36 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-700 focus:border-violet-400 focus:bg-white focus:outline-none" />
          </div>
          <div className="relative">
            <select value={filters.statusFilter} onChange={e => onFilterChange('statusFilter', e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 text-xs text-slate-700 focus:border-violet-400 focus:outline-none">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : STATUS_CONFIG[s]?.label ?? s}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input type="date" value={filters.dateStart} onChange={e => onFilterChange('dateStart', e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-700 focus:border-violet-400 focus:outline-none" />
          </div>
          <span className="text-xs text-slate-400">–</span>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input type="date" value={filters.dateEnd} onChange={e => onFilterChange('dateEnd', e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-700 focus:border-violet-400 focus:outline-none" />
          </div>
          <div className="relative ml-auto">
            <select value={filters.sort} onChange={e => onFilterChange('sort', e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 text-xs text-slate-700 focus:border-violet-400 focus:outline-none">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount_high">Highest Amount</option>
              <option value="amount_low">Lowest Amount</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </motion.div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="w-10 px-4 py-3">
                <button onClick={onToggleAll}>
                  {selectedIds.size === orders.length && orders.length > 0
                    ? <CheckSquare className="h-4 w-4 text-violet-600" />
                    : <Square className="h-4 w-4 text-slate-400" />}
                </button>
              </th>
              {cols.slice(1).map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <motion.tbody variants={staggerContainer} initial="hidden" animate="visible" className="divide-y divide-slate-50">
            {orders.map((order, i) => {
              // Vendor endpoints return exactly one vendorOrders entry — this
              // vendor's own portion. Prefer it for products/status.
              const rowVo = order.vendorOrders?.[0];
              const rowItems = rowVo?.items ?? order.items;
              const rowStatus = rowVo?.status ?? order.status;
              const firstItem = rowItems?.[0];
              const paymentMethod =
                order.razorpayAmount === order.totalAmount ? 'Razorpay'
                : order.walletAmountUsed > 0 ? 'Wallet' : 'Mixed';
              const isSelected = selectedIds.has(order.id);

              return (
                <motion.tr
                  key={order.id} variants={listItem} custom={i}
                  className={`group cursor-pointer transition-colors hover:bg-violet-50/40 ${isSelected ? 'bg-violet-50/60' : 'bg-white'}`}
                  onClick={() => onView(order)}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3" onClick={e => { e.stopPropagation(); onToggleRow(order.id); }}>
                    {isSelected
                      ? <CheckSquare className="h-4 w-4 text-violet-600" />
                      : <Square className="h-4 w-4 text-slate-300 group-hover:text-slate-400" />}
                  </td>

                  {/* Order ID */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      #{order.id.slice(-8).toUpperCase()}
                    </span>
                  </td>

                  {/* Customer */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold">
                        {(order.shippingAddress?.fullName ?? 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{order.shippingAddress?.fullName || '—'}</p>
                        <p className="text-[10px] text-slate-400">{order.shippingAddress?.city}</p>
                      </div>
                    </div>
                  </td>

                  {/* Product */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {firstItem?.imageUrl ? (
                        <img src={firstItem.imageUrl} alt={firstItem.productName} className="h-9 w-9 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          <Package className="h-4 w-4 text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="max-w-[140px] truncate text-xs font-medium text-slate-900">
                          {firstItem?.productName || firstItem?.name || '—'}
                        </p>
                        {(rowItems?.length ?? 0) > 1 && (
                          <p className="text-[10px] text-slate-400">+{rowItems.length - 1} more</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3">
                    <span className="text-sm font-bold text-slate-900">{money(order.totalAmount)}</span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={rowStatus} />
                  </td>

                  {/* Payment */}
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                      paymentMethod === 'Razorpay' ? 'bg-blue-50 text-blue-700'
                      : paymentMethod === 'Wallet' ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                    }`}>
                      {paymentMethod}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {order.placedAt ? format(new Date(order.placedAt), 'dd MMM yy') : '—'}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="relative flex items-center gap-1">
                      <button
                        onClick={() => onView(order)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 opacity-0 group-hover:opacity-100 hover:border-violet-300 hover:text-violet-700 transition-all"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                      <button
                        onClick={() => setMenuOpen(menuOpen === order.id ? null : order.id)}
                        className="rounded-lg p-1.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 transition-all"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                      {menuOpen === order.id && (
                        <div className="absolute right-0 top-8 z-20 min-w-[140px] rounded-xl border border-slate-100 bg-white py-1 shadow-xl">
                          {['View Details', 'Copy Order ID', 'Contact Customer'].map(action => (
                            <button key={action}
                              onClick={() => { if (action === 'View Details') onView(order); setMenuOpen(null); }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                              {action}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </motion.tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-500">
            Showing page {currentPage + 1} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-600 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = totalPages <= 5 ? i : Math.max(0, currentPage - 2) + i;
              if (p >= totalPages) return null;
              return (
                <button key={p} onClick={() => onPageChange(p)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition ${
                    p === currentPage
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-600'
                  }`}>
                  {p + 1}
                </button>
              );
            })}
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages - 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-600 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// VendorOrdersPage — Main  (REDESIGNED layout)
// ─────────────────────────────────────────────

export function VendorOrdersPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pageSize = 20;
  const qc = useQueryClient();

  const handleFilterChange = useCallback((key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(0);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setCurrentPage(0);
  }, []);

  // ── Queries (UNCHANGED) ──
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['vendor-orders', { page: currentPage, size: pageSize, ...filters }],
    refetchInterval: 30_000,
    queryFn: () =>
      api.get('/vendor/orders', {
        params: {
          page: currentPage, size: pageSize,
          searchOrderId: filters.searchOrderId || undefined,
          searchCustomerName: filters.searchCustomerName || undefined,
          searchProductName: filters.searchProductName || undefined,
          status: filters.statusFilter !== 'ALL' ? filters.statusFilter : undefined,
          startDate: filters.dateStart || undefined,
          endDate: filters.dateEnd || undefined,
        },
      }).then(r => unwrap<PagedResponse<Order>>(r)),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['vendor-orders-stats'],
    refetchInterval: 30_000,
    queryFn: () => api.get('/vendor/orders/stats').then(r => unwrap<any>(r)),
  });

  // ── Mutations (UNCHANGED) ──
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['vendor-orders'] });
    qc.invalidateQueries({ queryKey: ['vendor-orders-stats'] });
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.put(`/orders/${id}/status`, { status }),
    onSuccess: () => { toast.success('Order status updated'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update order'),
  });

  const addTrackingMutation = useMutation({
    mutationFn: ({ id, trackingId }: { id: string; trackingId: string }) =>
      api.put(`/orders/${id}/tracking`, { trackingId }),
    onSuccess: () => { toast.success('Order marked as shipped'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const updateShippingMutation = useMutation({
    mutationFn: ({ id, courierName, trackingNumber }: { id: string; courierName: string; trackingNumber: string }) =>
      api.put(`/orders/${id}/shipping-details`, { courierName, trackingNumber }),
    onSuccess: () => { toast.success('Order is now out for delivery'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const generateOtpMutation = useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/generate-otp`),
    onSuccess: () => { toast.success('OTP generated and sent to customer'); qc.invalidateQueries({ queryKey: ['vendor-orders'] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ id, otp, vendorId }: { id: string; otp: string; vendorId?: string }) =>
      api.post(`/orders/${id}/verify-otp`, { otp, vendorId }),
    onSuccess: () => { toast.success('OTP verified — order delivered!'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const exportMutation = useMutation({
    mutationFn: () => api.get('/vendor/orders/export', { responseType: 'blob' }),
    onSuccess: response => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orders-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Orders exported successfully');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to export'),
  });

  const orders = ordersData?.content ?? [];

  // Derived (not stored) — always reflects the latest fetched/invalidated
  // order data, so the drawer never shows a stale status after a mutation.
  const selectedOrder = selectedOrderId
    ? orders.find(o => o.id === selectedOrderId) ?? null
    : null;

  const handleToggleRow = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    setSelectedIds(prev => prev.size === orders.length ? new Set() : new Set(orders.map(o => o.id)));
  }, [orders]);

  return (
    <motion.div
    className="min-h-screen bg-[#F8F9FC] p-4 sm:p-6 space-y-3"
    variants={fadeInUp}
    initial="hidden"
    animate="visible"
    >
      {/* Hero */}
      <OrderHero stats={stats} />

      {/* Recent Orders Table */}
      <RecentOrdersTable
        orders={orders}
        ordersLoading={ordersLoading}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onExport={() => exportMutation.mutate()}
        isExporting={exportMutation.isPending}
        currentPage={currentPage}
        totalPages={ordersData?.totalPages ?? 1}
        onPageChange={setCurrentPage}
        onView={(o) => setSelectedOrderId(o.id)}
        selectedIds={selectedIds}
        onToggleRow={handleToggleRow}
        onToggleAll={handleToggleAll}
      />

      {/* Analytics: 3-column grid */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px_280px] items-start">
        <OrderTrendChart />

        <OrderInsights stats={stats} />

        <OrderActivityFeed />
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailsDrawer
            order={selectedOrder}
            onClose={() => setSelectedOrderId(null)}
            onStatusUpdate={(id, status) => updateStatusMutation.mutate({ id, status })}
            onAddTracking={(id, trackingId) => addTrackingMutation.mutate({ id, trackingId })}
            onShippingUpdate={(id, courierName, trackingNumber) => updateShippingMutation.mutate({ id, courierName, trackingNumber })}
            onGenerateOtp={id => generateOtpMutation.mutate(id)}
            onVerifyOtp={(id, otp, vendorId) => verifyOtpMutation.mutate({ id, otp, vendorId })}
            isUpdatingStatus={updateStatusMutation.isPending}
            isAddingTracking={addTrackingMutation.isPending}
            isUpdatingShipping={updateShippingMutation.isPending}
            isGeneratingOtp={generateOtpMutation.isPending}
            isVerifyingOtp={verifyOtpMutation.isPending}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default VendorOrdersPage;