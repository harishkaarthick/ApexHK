import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, Clock3, CreditCard, ImagePlus, KeyRound, MapPin, Package, Receipt, Star, Truck, X, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

import api from '@/lib/axios';
import type { DeliveryOtpResponse, Order, OrderItem, OrderStatus, PagedResponse, ReturnRequest, ReturnStatus, VendorOrder } from '@/types';
import { Empty, LoadingBlock, Page, money, unwrap } from '@/pages/pageShared';
import { fadeInUp, staggerContainer } from '@/lib/motion';

const safeFormat = (value?: string | null, fmt = 'MMM dd, yyyy HH:mm') => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : format(date, fmt);
};

const steps: Array<{ status: OrderStatus; label: string; icon: typeof Clock3 }> = [
  { status: 'PENDING', label: 'Placed', icon: Clock3 },
  { status: 'CONFIRMED', label: 'Confirmed', icon: Package },
  { status: 'PROCESSING', label: 'Processing', icon: Package },
  { status: 'SHIPPED', label: 'Shipped', icon: Truck },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery', icon: Truck },
  { status: 'DELIVERED', label: 'Delivered', icon: CheckCircle2 },
];

const statusIndex = (status: string) => steps.findIndex((step) => step.status === status);

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300',
    CONFIRMED: 'bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300',
    PROCESSING: 'bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300',
    SHIPPED: 'bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300',
    OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300',
    DELIVERED: 'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300',
    CANCELLED: 'bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300',
    REFUNDED: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-white/10 dark:text-slate-200',
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${styles[status] ?? styles.REFUNDED}`}>{status.replace(/_/g, ' ')}</span>;
}

function TrackingStepper({ status }: { status: OrderStatus }) {
  const current = statusIndex(status);

  return (
    <div className="grid gap-3 md:grid-cols-6">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const done = index <= current;
        const active = index === current;
        return (
          <div key={step.status} className="relative">
            {index < steps.length - 1 && (
              <div className={`absolute left-8 top-6 hidden h-0.5 w-full md:block ${index < current ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-white/10'}`} />
            )}
            <div className="relative z-10 flex flex-row items-center gap-3 md:flex-col md:items-start">
              <span className={`flex h-12 w-12 items-center justify-center rounded-full ring-4 ${done ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white ring-emerald-500/15' : 'bg-slate-100 text-slate-400 ring-slate-200 dark:bg-white/5 dark:ring-white/10'} ${active ? 'shadow-lg shadow-emerald-500/25' : ''}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className={`text-sm font-semibold ${done ? 'text-foreground dark:text-foreground-dark' : 'text-slate-400'}`}>{step.label}</p>
                {active && <p className="text-xs text-emerald-600 dark:text-emerald-400">In progress</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrackingProgress({ order }: { order: Order }) {
  const cancelled = order.status === 'CANCELLED' || order.status === 'REFUNDED';

  if (cancelled) {
    return (
      <div className="card flex items-center gap-4 p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
          <XCircle className="h-6 w-6" />
        </span>
        <div>
          <h2 className="font-semibold">Order {order.status.toLowerCase()}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">This order is no longer moving through delivery tracking.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <h2 className="text-lg font-semibold">Order Status</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Tap a product's status below to see its own tracking.</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overall Order Status</span>
        <StatusPill status={order.status} />
      </div>
    </div>
  );
}

function ProductTrackerRow({
  item,
  itemStatus,
  vendorOrder,
  children,
}: {
  item: OrderItem;
  itemStatus: OrderStatus;
  vendorOrder?: VendorOrder;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const cancelled = itemStatus === 'CANCELLED' || itemStatus === 'REFUNDED';

  return (
    <div className="border-b border-border pb-4 last:border-b-0 last:pb-0 dark:border-border-dark">
      <div className="flex gap-4">
        <img
          src={item.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=300&auto=format&fit=crop'}
          alt={item.productName}
          className="h-24 w-24 rounded-2xl object-cover shadow-md"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{item.productName}</h3>
          <p className="mt-2 text-sm">Qty {item.quantity} x {money(item.price || item.unitPrice || 0)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</span>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 rounded-full transition hover:opacity-80"
              aria-expanded={expanded}
              title="Click to see tracking for this item"
            >
              <StatusPill status={itemStatus} />
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        {children}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-2xl border border-border bg-slate-50 p-4 dark:border-border-dark dark:bg-white/5">
              {cancelled ? (
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                    <XCircle className="h-5 w-5" />
                  </span>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    This item is {itemStatus.toLowerCase()} and is no longer moving through delivery tracking.
                  </p>
                </div>
              ) : (
                <>
                  {(vendorOrder?.trackingId || vendorOrder?.courierName) && (
                    <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                      {vendorOrder?.courierName && <>Courier: <span className="font-semibold">{vendorOrder.courierName}</span></>}
                      {vendorOrder?.courierName && vendorOrder?.trackingId && <span> | </span>}
                      {vendorOrder?.trackingId && <>Tracking: <span className="font-semibold">{vendorOrder.trackingId}</span></>}
                    </p>
                  )}
                  <TrackingStepper status={itemStatus} />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type VendorGroup = {
  vendorId: string;
  vendorName: string;
  vendorOrder?: VendorOrder;
  items: OrderItem[];
  status: OrderStatus;
};

const hasVendorOrders = (order?: Order) => Boolean(order?.vendorOrders?.length);

function vendorOrderForItem(order: Order, item: OrderItem): VendorOrder | undefined {
  if (!order.vendorOrders?.length || !item.vendorId) return undefined;
  return order.vendorOrders.find((vo) => vo.vendorId === item.vendorId);
}

function statusForItem(order: Order, item: OrderItem): OrderStatus {
  return vendorOrderForItem(order, item)?.status ?? order.status;
}

function buildVendorGroups(order: Order): VendorGroup[] {
  const groups = new Map<string, VendorGroup>();

  for (const item of order.items) {
    const vendorOrder = vendorOrderForItem(order, item);
    const vendorId = item.vendorId || vendorOrder?.vendorId || item.vendorName || 'legacy';
    const existing = groups.get(vendorId);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    groups.set(vendorId, {
      vendorId,
      vendorName: vendorOrder?.vendorName || item.vendorName || 'Unknown vendor',
      vendorOrder,
      items: [item],
      status: vendorOrder?.status ?? order.status,
    });
  }

  return Array.from(groups.values());
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get(`/orders/${id}`).then((r) => unwrap<Order>(r)),
    enabled: Boolean(id),
  });

  const productIds = order?.items.map((item) => item.productId).filter(Boolean) ?? [];
  const { data: reviewedProductIds } = useQuery({
    queryKey: ['reviewed-products', id],
    queryFn: () =>
      api
        .get<{ data: string[] }>('/reviews/mine/reviewed', { params: { productIds: productIds.join(',') } })
        .then((r) => unwrap<string[]>(r)),
    enabled: Boolean(order) && productIds.length > 0 && (hasVendorOrders(order) ? order!.items.some((item) => statusForItem(order!, item) === 'DELIVERED') : order?.status === 'DELIVERED'),
  });

  // Return requests aren't embedded in the order payload (the item only carries a
  // `returnRequested` flag), so this fetches the customer's returns separately and
  // matches them back onto each order item by orderItemId to show the live status
  // (requested / approved / rejected / refunded) instead of a static "Requested" badge.
  const { data: myReturns } = useQuery({
    queryKey: ['my-returns-for-order', id],
    queryFn: () =>
      api
        .get('/returns/my-returns', { params: { page: 0, size: 100 } })
        .then((r) => unwrap<PagedResponse<ReturnRequest>>(r)),
    enabled: Boolean(order),
  });

  const returnsByItemId = useMemo(() => {
    const map = new Map<string, ReturnRequest>();
    for (const ret of myReturns?.content ?? []) {
      if (ret.orderId !== id) continue;
      if (!ret.orderItemId) continue;
      const existing = map.get(ret.orderItemId);
      // Keep the most recently updated/created return if an item somehow has more than one.
      if (!existing || new Date(ret.updatedAt || ret.createdAt) > new Date(existing.updatedAt || existing.createdAt)) {
        map.set(ret.orderItemId, ret);
      }
    }
    return map;
  }, [myReturns, id]);

  const vendorGroups = useMemo(() => (order ? buildVendorGroups(order) : []), [order]);
  const hasActiveDelivery = vendorGroups.some((group) => group.status === 'OUT_FOR_DELIVERY' && !group.vendorOrder?.otpVerified);
  const { data: deliveryOtp } = useQuery({
    queryKey: ['delivery-otp', id],
    queryFn: () => api.get(`/orders/${id}/delivery-otp`).then((r) => unwrap<DeliveryOtpResponse>(r)),
    enabled: Boolean(id) && hasActiveDelivery,
    refetchOnWindowFocus: true,
  });
  const activeOtps = deliveryOtp?.otps ?? [];

  if (isLoading) return <Page title="Order detail"><LoadingBlock /></Page>;
  if (!order) return <Page title="Order detail"><Empty title="Order not found" /></Page>;

  const address = order.shippingAddress;
  const itemTotal = order.items.reduce((sum, item) => sum + (item.totalPrice || item.price * item.quantity || item.unitPrice || 0), 0);

  return (
    <Page title="Order tracking">
      <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="visible">
        <motion.section className="card overflow-hidden" variants={fadeInUp}>
          <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 text-white">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm text-white/60">Order ID</p>
                <h1 className="mt-1 break-all text-2xl font-extrabold">#{order.id}</h1>
                <p className="mt-2 text-sm text-white/70">Placed on {safeFormat(order.placedAt || order.createdAt, 'MMMM dd, yyyy HH:mm')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Metric label="Items" value={String(order.items.length)} />
                <Metric label="Total" value={money(order.totalAmount ?? itemTotal)} />
                <Metric label="Overall Order Status" value={order.status.replace(/_/g, ' ')} />
              </div>
            </div>
          </div>
        </motion.section>

        <motion.div variants={fadeInUp}>
          <TrackingProgress order={order} />
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <motion.div className="space-y-4" variants={staggerContainer}>
            <h2 className="text-lg font-semibold">Products</h2>
            {vendorGroups.map((group) => (
              <motion.section key={group.vendorId} className="card space-y-4 p-4" variants={fadeInUp}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 dark:border-border-dark">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vendor</p>
                    <h3 className="font-semibold">{group.vendorName}</h3>
                    {(group.vendorOrder?.trackingId || group.vendorOrder?.courierName) && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {group.vendorOrder?.courierName && <>Courier: <span className="font-semibold">{group.vendorOrder.courierName}</span></>}
                        {group.vendorOrder?.courierName && group.vendorOrder?.trackingId && <span> | </span>}
                        {group.vendorOrder?.trackingId && <>Tracking: <span className="font-semibold">{group.vendorOrder.trackingId}</span></>}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vendor Fulfillment Status</span>
                    <StatusPill status={group.status} />
                  </div>
                </div>
                {group.items.map((item) => {
                  const itemStatus = statusForItem(order, item);
                  const delivered = itemStatus === 'DELIVERED';
                  const returnRequest = item.id ? returnsByItemId.get(item.id) : undefined;
                  return (
                    <ProductTrackerRow
                      key={item.id || item.productId}
                      item={item}
                      itemStatus={itemStatus}
                      vendorOrder={group.vendorOrder}
                    >
                      <div className="flex flex-col items-end gap-2">
                        <p className="font-bold">{money(item.totalPrice || item.price * item.quantity || item.unitPrice || 0)}</p>
                        {delivered && !returnRequest && item.id && (
                          <ReturnButton orderId={order.id} item={item} />
                        )}
                        {delivered && !returnRequest && !item.id && (
                          <span
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400"
                            title="This item is missing an internal reference and can't be returned online yet. Please contact support."
                          >
                            Return unavailable
                          </span>
                        )}
                        {delivered && returnRequest && <ReturnStatusPill status={returnRequest.status} />}
                        {delivered && (
                          reviewedProductIds?.includes(item.productId) ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              Reviewed
                            </span>
                          ) : (
                            <ReviewButton orderId={order.id} item={item} />
                          )
                        )}
                      </div>
                    </ProductTrackerRow>
                  );
                })}
              </motion.section>
            ))}
          </motion.div>

          <motion.aside className="space-y-4" variants={fadeInUp}>
            {hasActiveDelivery && activeOtps.length > 0 && (
              <DeliveryOtpCard otps={activeOtps} />
            )}

            <InfoCard icon={MapPin} title="Delivery Address">
              <p className="font-semibold">{address?.fullName}</p>
              <p>{address?.phone}</p>
              <p>{address?.addressLine1}</p>
              {address?.addressLine2 && <p>{address.addressLine2}</p>}
              <p>{address?.city}, {address?.state} {address?.pincode}</p>
              <p>{address?.country}</p>
            </InfoCard>

            <InfoCard icon={Truck} title="Shipping">
              <p>Courier: <span className="font-semibold">{order.courierName || 'Not assigned yet'}</span></p>
              <p>Tracking: <span className="font-semibold">{order.trackingId || 'Not available yet'}</span></p>
              <p>Shipped: <span className="font-semibold">{safeFormat(order.shippedDate)}</span></p>
            </InfoCard>

            <InfoCard icon={CreditCard} title="Payment">
              <SummaryRow label="Subtotal" value={money(order.subtotal ?? itemTotal)} />
              <SummaryRow label="Discount" value={`-${money(order.discount ?? 0)}`} />
              <SummaryRow label="Wallet used" value={`-${money(order.walletAmountUsed ?? 0)}`} />
              <SummaryRow label="Paid online" value={money(order.razorpayAmount ?? 0)} />
              <SummaryRow label="Order total" value={money(order.totalAmount ?? itemTotal)} strong />
            </InfoCard>
          </motion.aside>
        </div>
      </motion.div>
    </Page>
  );
}

function DeliveryOtpCard({ otps }: { otps: DeliveryOtpResponse['otps'] }) {
  return (
    <div className="card border-orange-200 bg-orange-50/80 p-5 dark:border-orange-500/30 dark:bg-orange-500/10">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
          <KeyRound className="h-5 w-5" />
        </span>
        <h2 className="font-semibold text-orange-950 dark:text-orange-100">Delivery OTP</h2>
      </div>
      <div className="space-y-4">
        {otps.map((entry) => (
          <div key={entry.vendorId} className="rounded-lg border border-orange-200 bg-white p-4 dark:border-orange-500/20 dark:bg-slate-950/40">
            {otps.length > 1 && (
              <p className="mb-2 text-xs font-semibold uppercase text-orange-700 dark:text-orange-300">{entry.vendorName}</p>
            )}
            <p className="font-mono text-3xl font-black tracking-[0.35em] text-orange-950 dark:text-orange-100">{entry.otp}</p>
            {entry.expiresAt && (
              <p className="mt-2 text-xs text-orange-700 dark:text-orange-300">Expires {safeFormat(entry.expiresAt)}</p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-orange-800 dark:text-orange-200">
        Share this OTP with the delivery/vendor person to confirm delivery.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
      <p className="text-xs text-white/60">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof Receipt; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">{children}</div>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'mt-3 border-t border-border pt-3 text-base font-extrabold dark:border-border-dark' : ''}`}>
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-semibold text-foreground dark:text-foreground-dark">{value}</span>
    </div>
  );
}

function ReturnStatusPill({ status }: { status: ReturnStatus }) {
  if (status === 'REFUNDED' || status === 'FINAL_APPROVED') {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Returned
      </span>
    );
  }
  if (status === 'REJECTED' || status === 'FINAL_REJECTED' || status === 'REJECTED_POST_QUALITY_CHECK') {
    return (
      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
        Return Rejected
      </span>
    );
  }
  return (
    <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
      Return {status.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
    </span>
  );
}

// Maps directly onto com.marketplace.enums.ReturnReason on the backend.
// Keep this in sync with the server enum if it ever changes.
const RETURN_REASONS: Array<{ value: string; label: string }> = [
  { value: 'DAMAGED_PRODUCT', label: 'Damaged' },
  { value: 'DEFECTIVE_PRODUCT', label: 'Defective / not working' },
  { value: 'WRONG_ITEM_RECEIVED', label: 'Wrong item received' },
  { value: 'MISSING_PARTS', label: 'Missing parts' },
  { value: 'NOT_AS_DESCRIBED', label: 'Not as described' },
  { value: 'QUALITY_ISSUE', label: 'Quality issue' },
  { value: 'OTHER', label: 'Other' },
];

// Spring's default @Valid failure body only gives a generic top-level
// "message" (e.g. "Validation failed"). The actually-useful, per-field
// reasons live in `errors`, which here is an object map of field -> message.
// This pulls out whichever shape is present so the toast is actionable.
function extractValidationMessage(err: any): string {
  const data = err?.response?.data;
  if (!data) return 'Failed to submit return';

  const fieldErrors = data.errors ?? data.fieldErrors ?? data.violations ?? data.details;

  if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
    return fieldErrors
      .map((e: any) => {
        const field = e.field ?? e.fieldName ?? e.propertyPath ?? e.path;
        const msg = e.defaultMessage ?? e.message ?? e.errorMessage ?? String(e);
        return field ? `${field}: ${msg}` : msg;
      })
      .join('; ');
  }

  if (fieldErrors && typeof fieldErrors === 'object') {
    return Object.entries(fieldErrors)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join('; ');
  }

  return data.message || 'Failed to submit return';
}

const MAX_EVIDENCE_IMAGES = 5;
const MAX_EVIDENCE_FILE_MB = 5;

function ReturnButton({ orderId, item }: { orderId: string; item: OrderItem }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [quantityToReturn, setQuantityToReturn] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);

  const maxQty = item.quantity ?? 1;
  const descriptionRequired = reason === 'OTHER';
  const qtyNum = quantityToReturn ? Number(quantityToReturn) : undefined;
  const qtyInvalid = qtyNum !== undefined && (!Number.isInteger(qtyNum) || qtyNum < 1 || qtyNum > maxQty);
  const canSubmit = Boolean(reason) && !qtyInvalid && (!descriptionRequired || description.trim().length > 0);

  // Local object URLs for image previews; revoked whenever the file list changes/unmounts
  // so we don't leak memory while the dialog stays open.
  const previews = useMemo(() => evidenceFiles.map((f) => URL.createObjectURL(f)), [evidenceFiles]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const resetForm = () => {
    setReason('');
    setDescription('');
    setQuantityToReturn('');
    setEvidenceFiles([]);
  };

  const handleFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-selecting the same file after removing it

    if (evidenceFiles.length >= MAX_EVIDENCE_IMAGES) {
      toast.error(`You can attach up to ${MAX_EVIDENCE_IMAGES} photos`);
      return;
    }

    const valid: File[] = [];
    for (const file of picked) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} isn't an image`);
        continue;
      }
      if (file.size > MAX_EVIDENCE_FILE_MB * 1024 * 1024) {
        toast.error(`${file.name} is larger than ${MAX_EVIDENCE_FILE_MB}MB`);
        continue;
      }
      valid.push(file);
    }
    setEvidenceFiles((prev) => [...prev, ...valid].slice(0, MAX_EVIDENCE_IMAGES));
  };

  const removeFile = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: (formData: FormData) => api.post('/returns', formData),
    onSuccess: () => {
      toast.success('Return requested');
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ['my-returns-for-order', orderId] });
    },
    onError: (err: any) => {
      console.error('Return request failed:', err?.response?.data ?? err);
      toast.error(extractValidationMessage(err));
    },
  });

  return (
    <>
      <button className="btn-premium" onClick={() => setOpen(true)}>Return</button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.form
              className="card w-full max-w-md space-y-3 p-5"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (!canSubmit) return;
                if (!item.id) {
                  toast.error("This item is missing an internal reference and can't be returned online. Please contact support.");
                  return;
                }
                const fd = new FormData();
                fd.append('data', JSON.stringify({
                  orderId,
                  orderItemId: item.id,
                  reason,
                  description: description.trim() || undefined,
                  quantityToReturn: qtyNum,
                }));
                evidenceFiles.forEach((file) => fd.append('evidenceImages', file));
                mutation.mutate(fd);
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Request return</h3>
                <button type="button" className="btn-ghost p-2" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
              </div>

              <select
                className="input"
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              >
                <option value="" disabled>Select a reason</option>
                {RETURN_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>

              <textarea
                className="input"
                name="description"
                placeholder={descriptionRequired ? 'Please describe the issue (required for "Other")' : 'Description (optional)'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required={descriptionRequired}
              />

              <div>
                <input
                  className="input"
                  name="quantityToReturn"
                  type="number"
                  min={1}
                  max={maxQty}
                  step={1}
                  placeholder={`Quantity (blank for all ${maxQty})`}
                  value={quantityToReturn}
                  onChange={(e) => setQuantityToReturn(e.target.value)}
                />
                {qtyInvalid && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    Enter a whole number between 1 and {maxQty}.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Evidence photos <span className="font-normal text-slate-400">(optional, up to {MAX_EVIDENCE_IMAGES})</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {previews.map((src, i) => (
                    <div key={src} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                      <img src={src} alt={`Evidence ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                        aria-label="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {evidenceFiles.length < MAX_EVIDENCE_IMAGES && (
                    <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-500 dark:border-white/15 dark:hover:border-white/30">
                      <ImagePlus className="h-5 w-5" />
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFilesSelected}
                      />
                    </label>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">JPG/PNG, up to {MAX_EVIDENCE_FILE_MB}MB each.</p>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" className="btn-premium-secondary" onClick={() => setOpen(false)}>Close</button>
                <button className="btn-premium" disabled={!canSubmit || mutation.isPending}>
                  {mutation.isPending ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const MAX_REVIEW_IMAGES = 5;
const MAX_REVIEW_FILE_MB = 5;

function ReviewButton({ orderId, item }: { orderId: string; item: OrderItem }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<File[]>([]);

  const canSubmit = rating >= 1 && rating <= 5 && title.trim().length > 0 && comment.trim().length >= 10;

  // Local object URLs for image previews; revoked whenever the file list changes/unmounts
  // so we don't leak memory while the dialog stays open.
  const previews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const resetForm = () => {
    setRating(5);
    setTitle('');
    setComment('');
    setImages([]);
  };

  const handleFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-selecting the same file after removing it

    if (images.length >= MAX_REVIEW_IMAGES) {
      toast.error(`You can attach up to ${MAX_REVIEW_IMAGES} photos`);
      return;
    }

    const valid: File[] = [];
    for (const file of picked) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} isn't an image`);
        continue;
      }
      if (file.size > MAX_REVIEW_FILE_MB * 1024 * 1024) {
        toast.error(`${file.name} is larger than ${MAX_REVIEW_FILE_MB}MB`);
        continue;
      }
      valid.push(file);
    }
    setImages((prev) => [...prev, ...valid].slice(0, MAX_REVIEW_IMAGES));
  };

  const removeFile = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: (formData: FormData) => api.post('/reviews', formData),
    onSuccess: () => {
      toast.success('Review posted');
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ['reviewed-products', orderId] });
      qc.invalidateQueries({ queryKey: ['reviews', item.productId] });
      qc.invalidateQueries({ queryKey: ['product', item.productId] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to submit review');
    },
  });

  return (
    <>
      <button className="btn-premium-secondary" onClick={() => setOpen(true)}>Write a review</button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.form
              className="card w-full max-w-md space-y-3 p-5"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (!canSubmit) return;
                const fd = new FormData();
                fd.append('data', JSON.stringify({
                  orderId,
                  productId: item.productId,
                  rating,
                  title: title.trim(),
                  comment: comment.trim(),
                }));
                images.forEach((file) => fd.append('images', file));
                mutation.mutate(fd);
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Review {item.productName}</h3>
                <button type="button" className="btn-ghost p-2" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    >
                      <Star className={`h-6 w-6 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <input
                className="input"
                placeholder="Title (e.g. Great quality!)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <textarea
                className="input min-h-24"
                placeholder="Share what you liked or didn't (min 10 characters)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
              />

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Photos <span className="font-normal text-slate-400">(optional, up to {MAX_REVIEW_IMAGES})</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {previews.map((src, i) => (
                    <div key={src} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                      <img src={src} alt={`Review photo ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                        aria-label="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {images.length < MAX_REVIEW_IMAGES && (
                    <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-500 dark:border-white/15 dark:hover:border-white/30">
                      <ImagePlus className="h-5 w-5" />
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFilesSelected}
                      />
                    </label>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">JPG/PNG, up to {MAX_REVIEW_FILE_MB}MB each.</p>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" className="btn-premium-secondary" onClick={() => setOpen(false)}>Close</button>
                <button className="btn-premium" disabled={!canSubmit || mutation.isPending}>
                  {mutation.isPending ? 'Submitting…' : 'Submit review'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default OrderDetailPage;
