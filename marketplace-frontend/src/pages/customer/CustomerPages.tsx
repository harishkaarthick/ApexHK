import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Check, ChevronDown, CreditCard, Plus, Sparkles, Tag, Trash2, WalletCards, X } from 'lucide-react';

import api from '@/lib/axios';
import { useCartStore } from '@/stores';
import type {
  Address, Cart, CheckoutResponse, CouponPreview, MyCoupon, Order, OrderStatus, PagedResponse,
  ReturnRequest, Wallet, WalletTopupOrderResponse,
} from '@/types';
import {
  Empty, Field, LoadingBlock, Page, StatusBadge, dt, money, pageOf, unwrap,
} from '@/pages/pageShared';
import {
  fadeInUp, listItem, scaleIn, slideInLeft, slideInRight, staggerContainer,
} from '@/lib/motion';

/**
 * Reusable coupon card grid — shared between the Cart page's "Offers for you"
 * strip and the Checkout page's Coupon step, so both surfaces look and behave
 * the same way (Zepto-style). Sorts by estimatedDiscount desc and badges the
 * top eligible coupon as "BEST OFFER" — purely a visual hint, never auto-applied.
 */
function CouponCards({
  coupons,
  appliedCode,
  onApply,
  onRemove,
  applying,
  highlightBest = true,
}: {
  coupons: MyCoupon[];
  appliedCode?: string;
  onApply: (code: string) => void;
  onRemove?: () => void;
  applying?: boolean;
  highlightBest?: boolean;
}) {
  const sorted = [...coupons].sort((a, b) => b.estimatedDiscount - a.estimatedDiscount);
  const bestCode = highlightBest ? sorted.find((c) => c.eligible && c.estimatedDiscount > 0)?.code : undefined;

  if (!sorted.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No coupons available right now.</p>;
  }

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {sorted.map((c) => {
        const isApplied = appliedCode === c.code;
        const isBest = c.code === bestCode;
        return (
          <motion.div
            key={c.code}
            className={`relative rounded-lg border p-3 text-xs ${
              isApplied
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                : isBest
                  ? 'border-amber-400 bg-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.4)] dark:border-amber-400/70 dark:bg-amber-400/10'
                  : c.eligible
                    ? 'border-border dark:border-border-dark'
                    : 'border-border/60 opacity-60 dark:border-border-dark/60'
            }`}
            whileHover={c.eligible ? { scale: 1.02 } : undefined}
          >
            {isBest && (
              <span className="absolute -top-2 left-3 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 shadow">
                Best offer
              </span>
            )}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono font-semibold tracking-wide">{c.code}</p>
                <p className="mt-0.5 text-slate-500 dark:text-slate-400">{c.description}</p>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                  {c.discountType === 'PERCENTAGE' ? `${c.discountValue}% off` : `${money(c.discountValue)} off`}
                  {c.maxDiscount ? ` (max ${money(c.maxDiscount)})` : ''} · Min {money(c.minimumOrderValue)}
                </p>
                {c.eligible ? (
                  <p className="mt-1 font-semibold text-success">You save {money(c.estimatedDiscount)}</p>
                ) : (
                  <p className="mt-1 text-amber-600 dark:text-amber-400">{c.ineligibleReason}</p>
                )}
              </div>
              {isApplied ? (
                <button type="button" className="btn-ghost shrink-0 px-2 py-1 text-error" onClick={onRemove}>
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-premium-secondary shrink-0 px-3 py-1"
                  disabled={!c.eligible || applying}
                  onClick={() => onApply(c.code)}
                >
                  Apply
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Collapsible "Offers for you" strip shown above Order Summary on the Cart page. */
function OffersStrip() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const { data: coupons, isLoading } = useQuery({
    queryKey: ['my-coupons'],
    queryFn: () => api.get('/coupons/mine').then((r) => unwrap<MyCoupon[]>(r)),
  });
  const eligibleCount = (coupons ?? []).filter((c) => c.eligible).length;

  if (isLoading || !coupons?.length) return null;

  return (
    <motion.div className="card overflow-hidden p-0" variants={fadeInUp} initial="hidden" animate="visible">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="flex items-center gap-2 font-semibold">
          <Tag className="h-4 w-4 text-primary-500" /> Offers for you
        </span>
        <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {eligibleCount > 0 ? `${eligibleCount} offer${eligibleCount === 1 ? '' : 's'} available` : 'View offers'}
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="border-t border-border p-4 dark:border-border-dark">
              <CouponCards
                coupons={coupons}
                onApply={(code) => navigate(`/checkout?coupon=${encodeURIComponent(code)}`)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function CartPage() {
  const qc = useQueryClient();
  const setItemCount = useCartStore((s) => s.setItemCount);
  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: () => api.get('/cart').then((r) => unwrap<Cart>(r)),
  });

  useEffect(() => {
    if (cart) setItemCount(cart.items.reduce((s, i) => s + i.quantity, 0));
  }, [cart, setItemCount]);

  const update = useMutation({
    mutationFn: (b: { productId: string; quantity: number }) => api.put('/cart/items', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/cart/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
  });

  if (isLoading) return <Page title="Cart"><LoadingBlock /></Page>;
  if (!cart?.items.length) return <Page title="Cart"><Empty title="Your cart is empty." /></Page>;

  return (
    <Page title="Cart">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
          <AnimatePresence initial={false}>
            {cart.items.map((item) => (
              <motion.div
                className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                key={item.productId}
                variants={fadeInUp}
                layout
                exit={{ x: -100, opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3 }}
              >
                <img src={item.imageUrl} alt="" className="h-28 w-full rounded-lg object-cover sm:h-24 sm:w-24" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{item.productName}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{item.vendorName}</p>
                  <p className="mt-2 font-semibold">{money(item.unitPrice || ((item.discountedPrice && item.discountedPrice > 0 && item.discountedPrice < item.price) ? item.discountedPrice : item.price) || 0)}</p>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <QuantityInput
                    quantity={item.quantity}
                    max={item.stock}
                    onCommit={(qty) => update.mutate({ productId: item.productId, quantity: qty })}
                  />
                  <motion.button
                    className="btn-ghost p-2 text-error"
                    onClick={() => remove.mutate(item.productId)}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.9 }}
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
        <div className="space-y-4 lg:sticky lg:top-28 lg:h-fit">
          <OffersStrip />
          <motion.aside
            className="card h-fit p-5"
            variants={slideInRight}
            initial="hidden"
            animate="visible"
            whileHover={{ boxShadow: '0 0 20px rgba(99,102,241,0.18)' }}
          >
            <h2 className="font-semibold">Order summary</h2>
            <SummaryRow label="Subtotal" value={money(cart.totalAmount)} />
            <Link className="btn-premium mt-5 w-full" to="/checkout">Proceed to checkout</Link>
          </motion.aside>
        </div>
      </div>
    </Page>
  );
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appliedFromCartRef = useRef(false);
  const { data: cart } = useQuery({ queryKey: ['cart'], queryFn: () => api.get('/cart').then((r) => unwrap<Cart>(r)) });
  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: () => api.get('/wallet', { params: { page: 0, size: 5 } }).then((r) => unwrap<Wallet>(r)) });
  const { data: me, refetch: refetchMe } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/users/me').then((r) => unwrap<any>(r)) });
  const { data: coupons } = useQuery({
    queryKey: ['my-coupons'],
    queryFn: () => api.get('/coupons/mine').then((r) => unwrap<MyCoupon[]>(r)),
  });
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [addressId, setAddressId] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [walletAmount, setWalletAmount] = useState(0);
  const [backendDiscount, setBackendDiscount] = useState<number | null>(null);
  const [backendDue, setBackendDue] = useState<number | null>(null);
  const subtotal = cart?.totalAmount ?? 0;
  const walletCap = Math.min(wallet?.balance ?? 0, subtotal);
  const walletUsed = useWallet ? Math.min(walletAmount, walletCap) : 0;

  const pay = useMutation({
    mutationFn: () => api.post('/orders/checkout', {
      addressId,
      couponCode: couponCode || undefined,
      walletAmountToUse: walletUsed,
    }).then((r) => unwrap<CheckoutResponse>(r)),
    onSuccess: (res) => {
      const amountDue = res.amount / 100;
      setBackendDue(amountDue);
      setBackendDiscount(Math.max(0, subtotal - walletUsed - amountDue));
      if (res.amount === 0) return navigate(`/account/orders/${res.orderId}?confirmed=true`);
      const Razorpay = (window as any).Razorpay;
      const razorpayKey = res.key || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!Razorpay) return toast.error('Razorpay script is still loading. Please try again.');
      if (!razorpayKey || razorpayKey.includes('xxxxxxxx')) return toast.error('Razorpay key is not configured.');
      new Razorpay({
        key: razorpayKey,
        amount: res.amount,
        currency: res.currency || 'INR',
        order_id: res.razorpayOrderId,
        name: 'ApexHK',
        handler: async (response: any) => {
          await api.post('/orders/verify-payment', {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          navigate(`/account/orders/${res.orderId}?confirmed=true`);
        },
        modal: { ondismiss: () => { toast.error('Payment cancelled'); navigate('/cart'); } },
      }).open();
    },
  });

  const applyCoupon = useMutation({
    mutationFn: (code: string) => api.post('/coupons/validate', { code }).then((r) => unwrap<CouponPreview>(r)),
    onSuccess: (res) => {
      setCouponCode(res.code);
      setCouponPreview(res);
      setCouponError(null);
      toast.success(`"${res.code}" applied — you save ${money(res.discount)}`);
    },
    onError: (err: any) => {
      setCouponPreview(null);
      setCouponError(err?.response?.data?.message || 'This coupon could not be applied');
    },
  });

  const removeCoupon = () => {
    setCouponCode('');
    setCouponPreview(null);
    setCouponError(null);
    setCodeInput('');
  };

  useEffect(() => {
    const first = me?.addresses?.find((a: Address) => a.isDefault) || me?.addresses?.[0];
    if (first && !addressId) setAddressId(first.id);
    if (me && !me.addresses?.length) setShowAddressForm(true);
  }, [me, addressId]);

  useEffect(() => {
    setBackendDiscount(null);
    setBackendDue(null);
  }, [couponCode, useWallet, walletAmount]);

  // Coming from the Cart page's "Offers for you" strip (?coupon=CODE): jump to the
  // Coupon step and apply it once coupons have loaded. Doesn't touch discount math —
  // just pre-fills the same apply flow the customer would've used manually.
  useEffect(() => {
    const pending = searchParams.get('coupon');
    if (!pending || appliedFromCartRef.current || !coupons) return;
    appliedFromCartRef.current = true;
    setStep(1);
    applyCoupon.mutate(pending.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, coupons]);

  const goStep = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  return (
    <Page title="Checkout">
      <StepIndicator step={step} onStep={goStep} />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={direction > 0 ? slideInRight : slideInLeft}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, x: direction > 0 ? -32 : 32 }}
            >
              {step === 0 && (
                <div className="card p-5">
                  <h2 className="mb-3 font-semibold">Address</h2>
                  <div className="space-y-2">
                    {(me?.addresses ?? []).map((a: Address) => (
                      <label key={a.id} className="flex gap-3 rounded-lg border border-border p-3 text-sm dark:border-border-dark">
                        <input type="radio" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                        <span>{a.fullName} · {a.phone}<br />{a.addressLine1}, {a.city}, {a.state} {a.pincode}</span>
                      </label>
                    ))}
                  </div>
                  {!showAddressForm && (
                    <button
                      type="button"
                      className="btn-premium-secondary mt-3"
                      onClick={() => setShowAddressForm(true)}
                    >
                      + Add address
                    </button>
                  )}
                  {showAddressForm && (
                    <AddressMiniForm
                      onSaved={() => {
                        refetchMe();
                        setShowAddressForm(false);
                      }}
                    />
                  )}
                </div>
              )}
              {step === 1 && (
                <div className="card p-5">
                  <h2 className="mb-3 font-semibold">Coupon</h2>
                  <CouponCards
                    coupons={coupons ?? []}
                    appliedCode={couponCode}
                    onApply={(code) => applyCoupon.mutate(code)}
                    onRemove={removeCoupon}
                    applying={applyCoupon.isPending}
                    highlightBest
                  />

                  <div className="mt-4 flex gap-2">
                    <input
                      className="input max-w-sm"
                      placeholder="Have a code? Enter it here"
                      value={codeInput}
                      onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCouponError(null); }}
                    />
                    <button
                      type="button"
                      className="btn-premium-secondary"
                      disabled={!codeInput || applyCoupon.isPending}
                      onClick={() => applyCoupon.mutate(codeInput)}
                    >
                      {applyCoupon.isPending ? 'Checking…' : 'Apply'}
                    </button>
                  </div>
                  {couponError && <p className="mt-2 text-xs text-error">{couponError}</p>}
                  {couponCode && !couponError && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-success">
                      <Tag className="h-3 w-3" /> &ldquo;{couponCode}&rdquo; applied — you save {money(couponPreview?.discount ?? 0)}
                    </p>
                  )}
                </div>
              )}
              {step === 2 && (
                <div className="card p-5">
                  <h2 className="mb-3 font-semibold">Wallet</h2>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} />
                    Use wallet credit ({money(wallet?.balance ?? 0)})
                  </label>
                  <AnimatePresence>
                    {useWallet && (
                      <motion.input
                        className="input mt-3 max-w-xs"
                        type="number"
                        min={0}
                        max={walletCap}
                        value={walletAmount}
                        onChange={(e) => setWalletAmount(Number(e.target.value))}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                      />
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="flex justify-between">
            <button className="btn-premium-secondary" disabled={step === 0} onClick={() => goStep(Math.max(0, step - 1))}>Back</button>
            <button className="btn-premium" disabled={step === 2} onClick={() => goStep(Math.min(2, step + 1))}>Continue</button>
          </div>
        </div>
        <motion.aside className="card h-fit p-5 lg:sticky lg:top-28" variants={fadeInUp} initial="hidden" animate="visible">
          <h2 className="font-semibold">Order summary</h2>
          <SummaryRow label="Subtotal" value={money(subtotal)} />
          {couponCode && <SummaryRow label="Coupon discount" value={`-${money(backendDiscount ?? couponPreview?.discount ?? 0)}`} />}
          <SummaryRow label="Wallet deduction" value={`-${money(walletUsed)}`} />
          <SummaryRow label="Due via Razorpay" value={money(backendDue ?? Math.max(0, subtotal - (couponPreview?.discount ?? 0) - walletUsed))} strong />
          {!addressId && (
            <p className="mt-4 text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Please select or add a delivery address to continue.
            </p>
          )}
          <motion.button
            className="btn-premium mt-3 w-full"
            disabled={!addressId || pay.isPending}
            onClick={() => pay.mutate()}
            whileHover={addressId ? { scale: 1.04 } : {}}
            whileTap={addressId ? { scale: 0.95 } : {}}
            title={!addressId ? "Add a delivery address first" : ""}
          >
            <CreditCard className="h-4 w-4" /> {pay.isPending ? "Processing…" : "Pay now"}
          </motion.button>
        </motion.aside>
      </div>
    </Page>
  );
}

function StepIndicator({ step, onStep }: { step: number; onStep: (step: number) => void }) {
  const steps = ['Address', 'Coupon', 'Wallet'];
  return (
    <div className="flex gap-2 overflow-x-auto rounded-lg border border-border bg-surface p-2 dark:border-border-dark dark:bg-surface-dark">
      {steps.map((label, i) => (
        <button key={label} onClick={() => onStep(i)} className="relative flex min-w-32 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold">
          {step === i && <motion.div layoutId="activeStep" className="absolute inset-0 rounded-lg bg-primary-50 dark:bg-primary-500/10" />}
          {i < step && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15 }} className="relative flex h-5 w-5 items-center justify-center rounded-full bg-success text-white">
              <Check className="h-3 w-3" />
            </motion.span>
          )}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}

function QuantityInput({
  quantity,
  max,
  onCommit,
}: {
  quantity: number;
  max?: number;
  onCommit: (qty: number) => void;
}) {
  const [draft, setDraft] = useState(String(quantity));

  useEffect(() => {
    setDraft(String(quantity));
  }, [quantity]);

  const commit = () => {
    const parsed = Number(draft);
    const upperBound = max && max > 0 ? max : Infinity;
    if (!Number.isFinite(parsed) || parsed < 1) {
      setDraft(String(quantity));
      return;
    }
    const clamped = Math.min(Math.floor(parsed), upperBound);
    setDraft(String(clamped));
    if (clamped !== quantity) onCommit(clamped);
  };

  return (
    <input
      className="input w-20"
      type="number"
      min={1}
      max={max}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
}

function AddressMiniForm({ onSaved }: { onSaved: () => void }) {
  const mutation = useMutation({
    mutationFn: (body: any) => api.post('/users/me/addresses', body),
    onSuccess: () => { toast.success('Address added'); onSaved(); },
  });
  return (
    <motion.form className="mt-4 grid gap-2 md:grid-cols-2" variants={staggerContainer} initial="hidden" animate="visible" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const body = Object.fromEntries(fd.entries());
      if (!/^\d{6}$/.test(String(body.pincode || ''))) return toast.error('PIN code must be 6 digits');
      mutation.mutate({ ...body, isDefault: false });
      e.currentTarget.reset();
    }}>
      {[
        { name: 'fullName',     placeholder: 'Full name' },
        { name: 'phone',        placeholder: 'Phone number' },
        { name: 'addressLine1', placeholder: 'Address line 1' },
        { name: 'addressLine2', placeholder: 'Address line 2 (optional)' },
        { name: 'city',         placeholder: 'City' },
        { name: 'state',        placeholder: 'State' },
        { name: 'pincode',      placeholder: 'PIN code (6 digits)' },
        { name: 'country',      placeholder: 'Country' },
      ].map(({ name, placeholder }) => (
        <motion.input key={name} variants={fadeInUp} name={name} className="input" placeholder={placeholder} />
      ))}
      <motion.button className="btn-premium-secondary md:col-span-2" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Plus className="h-4 w-4" /> Add address
      </motion.button>
    </motion.form>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`mt-3 flex justify-between text-sm ${strong ? 'border-t border-border pt-3 font-bold dark:border-border-dark' : ''}`}>
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function OrdersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'my', { page: 0 }],
    queryFn: () => api.get('/orders/my-orders', { params: { page: 0, size: 20 } }).then((r) => unwrap<PagedResponse<Order>>(r)),
  });
  return <Page title="My orders">{isLoading ? <LoadingBlock /> : <OrderList orders={pageOf(data)} />}</Page>;
}

function OrderList({ orders }: { orders: Order[] }) {
  if (!orders.length) return <Empty title="No orders yet." />;
  return (
    <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="visible">
      {orders.map((o) => (
        <motion.div key={o.id} variants={listItem}>
          <Link className="card group flex flex-col gap-4 p-4 transition-all hover:-translate-y-1 hover:border-primary-300 hover:shadow-glow dark:hover:border-primary-500/50 sm:flex-row sm:items-center sm:justify-between" to={`/account/orders/${o.id}`}>
            <div className="flex min-w-0 gap-4">
              <div className="flex -space-x-3">
                {o.items.slice(0, 3).map((item) => (
                  <img
                    key={item.productId}
                    src={item.imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200&auto=format&fit=crop'}
                    alt={item.productName}
                    className="h-16 w-16 rounded-2xl border-2 border-surface object-cover shadow-md dark:border-surface-dark"
                  />
                ))}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">Order #{o.id}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{o.items.length} item{o.items.length === 1 ? '' : 's'} � {dt(o.createdAt || o.placedAt)}</p>
                <p className="mt-1 truncate text-sm text-slate-400">{o.items.map((item) => item.productName).join(', ')}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <p className="font-bold">{money(o.totalAmount ?? o.total ?? 0)}</p>
              {(o.vendorOrders?.length ?? 0) > 1 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  {o.vendorOrders.length} vendors
                </span>
              ) : (
                <OrderStatusPill status={o.status} />
              )}
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { data: order, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => api.get(`/orders/${id}`).then((r) => unwrap<Order>(r)) });
  const cancel = useMutation({ mutationFn: () => api.post(`/orders/${id}/cancel`), onSuccess: () => qc.invalidateQueries({ queryKey: ['order', id] }) });
  if (isLoading || !order) return <Page title="Order detail"><LoadingBlock /></Page>;
  const cancelDeadline = order.confirmedAt ? new Date(order.confirmedAt).getTime() + 60 * 60 * 1000 : 0;
  const canCancel = order.status === 'CONFIRMED' && Date.now() < cancelDeadline;
  // Multiple vendors can share one order/payment; each fulfills its own items
  // independently. Show a per-vendor breakdown when we have it, falling back
  // to the flat legacy view (single stepper + item list) for older orders.
  const vendorGroups = order.vendorOrders ?? [];
  const hasVendorGroups = vendorGroups.length > 0;
  return (
    <Page title={`Order #${order.id}`}>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="visible">
          {hasVendorGroups ? (
            vendorGroups.map((vo) => (
              <div key={vo.id} className="card space-y-4 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{vo.vendorName}</h3>
                  <OrderStatusPill status={vo.status} />
                </div>
                <StatusStepper status={vo.status} />
                {(vo.courierName || vo.trackingId) && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {vo.courierName ? `${vo.courierName} · ` : ''}{vo.trackingId ? `Tracking: ${vo.trackingId}` : ''}
                  </p>
                )}
                <div className="space-y-3">
                  {vo.items.map((i) => (
                    <motion.div key={i.productId} variants={fadeInUp} className="flex items-center gap-4 rounded-xl border border-border p-3 dark:border-border-dark">
                      <img src={i.imageUrl} className="h-20 w-20 rounded-lg object-cover" alt="" />
                      <div className="flex-1">
                        <h4 className="font-semibold">{i.productName}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Qty {i.quantity}</p>
                      </div>
                      {vo.status === 'DELIVERED' && !i.returnRequested && <ReturnButton orderId={order.id} item={i} />}
                      {vo.status === 'DELIVERED' && i.returnRequested && (
                        <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Return Requested</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <>
              <StatusStepper status={order.status} />
              {order.items.map((i) => (
                <motion.div key={i.productId} variants={fadeInUp} className="card flex items-center gap-4 p-4">
                  <img src={i.imageUrl} className="h-20 w-20 rounded-lg object-cover" alt="" />
                  <div className="flex-1">
                    <h3 className="font-semibold">{i.productName}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{i.vendorName} · Qty {i.quantity}</p>
                  </div>
                  {order.status === 'DELIVERED' && !i.returnRequested && <ReturnButton orderId={order.id} item={i} />}
                  {order.status === 'DELIVERED' && i.returnRequested && (
                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Return Requested</span>
                  )}
                </motion.div>
              ))}
            </>
          )}
        </motion.div>
        <motion.aside className="card h-fit p-5" variants={slideInRight} initial="hidden" animate="visible">
          <StatusPill status={order.status} />
          <SummaryRow label="Subtotal" value={money(order.subtotal)} />
          <SummaryRow label="Discount" value={`-${money(order.discount)}`} />
          <SummaryRow label="Wallet used" value={`-${money(order.walletAmountUsed)}`} />
          <SummaryRow label="Paid via Razorpay" value={money(order.razorpayAmount)} strong />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{order.shippingAddress?.addressLine1}, {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.pincode}</p>
          {canCancel && <button className="btn-premium-danger mt-5 w-full" onClick={() => cancel.mutate()}>Cancel order</button>}
          {canCancel && <p className="mt-2 text-xs text-slate-500">Cancel window ends {new Date(cancelDeadline).toLocaleTimeString('en-IN')}.</p>}
        </motion.aside>
      </div>
    </Page>
  );
}

function StatusPill({ status }: { status: OrderStatus | string }) {
  const pending = String(status).includes('PENDING');
  return <StatusBadge tone={pending ? 'warning' : 'neutral'} label={String(status)} pulse={pending} />;
}

function OrderStatusPill({ status }: { status: OrderStatus | string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
    CONFIRMED: 'bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
    PROCESSING: 'bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
    SHIPPED: 'bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30',
    OUT_FOR_DELIVERY: 'bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30',
    DELIVERED: 'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
    CANCELLED: 'bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
    REFUNDED: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10',
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${styles[String(status)] ?? styles.REFUNDED}`}>{String(status).replace(/_/g, ' ')}</span>;
}

function StatusStepper({ status }: { status: OrderStatus }) {
  const statuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
  const index = statuses.indexOf(status);
  return (
    <div className="card flex flex-wrap gap-2 p-4">
      {statuses.map((s, i) => (
        <span key={s} className={`rounded-lg px-3 py-2 text-xs font-medium ${i <= index ? 'bg-gradient-to-r from-accent-indigo to-accent-purple text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/5'}`}>
          {s}
        </span>
      ))}
    </div>
  );
}

function ReturnButton({ orderId, item }: { orderId: string; item: any }) {
  const [open, setOpen] = useState(false);
  const mutation = useMutation({ mutationFn: (body: any) => api.post('/returns', body), onSuccess: () => { toast.success('Return requested'); setOpen(false); }, onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to submit return') });
  return (
    <>
      <button className="btn-premium-secondary" onClick={() => setOpen(true)}>Return</button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.form className="card w-full max-w-md space-y-3 p-5" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              mutation.mutate({
                orderId,
                productId: item.productId,
                reason: fd.get('reason'),
                description: fd.get('description'),
                quantityToReturn: fd.get('quantityToReturn') ? Number(fd.get('quantityToReturn')) : undefined,
              });
            }}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Request return</h3>
                <button type="button" className="btn-ghost p-2" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
              </div>
              <select className="input" name="reason"><option>Damaged</option><option>Wrong item</option><option>Quality issue</option></select>
              <textarea className="input" name="description" placeholder="Description" />
              <input className="input" name="quantityToReturn" type="number" placeholder="Quantity (blank for full)" />
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-premium-secondary" onClick={() => setOpen(false)}>Close</button>
                <button className="btn-premium">Submit</button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function WalletPage() {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(1000);
  const { data } = useQuery({ queryKey: ['wallet'], queryFn: () => api.get('/wallet', { params: { page: 0, size: 20 } }).then((r) => unwrap<Wallet>(r)) });

  // Top-up now goes through Razorpay instead of crediting the wallet directly:
  // 1) ask the backend to open a Razorpay order for `amount`,
  // 2) launch Razorpay Checkout for the customer to actually pay,
  // 3) on success, send the payment details to /wallet/topup/verify, which
  //    checks the signature server-side and only then credits the wallet.
  const topUp = useMutation({
    mutationFn: () => api.post('/wallet/topup/create-order', { amount }).then((r) => unwrap<WalletTopupOrderResponse>(r)),
    onSuccess: (res) => {
      const Razorpay = (window as any).Razorpay;
      const razorpayKey = res.key || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!Razorpay) return toast.error('Razorpay script is still loading. Please try again.');
      if (!razorpayKey || razorpayKey.includes('xxxxxxxx')) return toast.error('Razorpay key is not configured.');
      new Razorpay({
        key: razorpayKey,
        amount: res.amount,
        currency: res.currency || 'INR',
        order_id: res.razorpayOrderId,
        name: 'ApexHK',
        description: 'Wallet top-up',
        handler: async (response: any) => {
          try {
            await api.post('/wallet/topup/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success('Money added to wallet');
            qc.invalidateQueries({ queryKey: ['wallet'] });
          } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Could not confirm payment');
          }
        },
        modal: { ondismiss: () => toast.error('Payment cancelled') },
      }).open();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to start top-up'),
  });
  return (
    <Page title="Wallet">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <motion.div className="card overflow-hidden p-0" variants={scaleIn} initial="hidden" animate="visible">
          <div className="bg-gradient-to-br from-accent-indigo via-accent-purple to-fuchsia-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <WalletCards className="h-8 w-8" />
              <Sparkles className="h-5 w-5 opacity-80" />
            </div>
            <p className="mt-8 text-sm text-white/75">Available balance</p>
            <p className="text-4xl font-extrabold">{money(data?.balance ?? 0)}</p>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-3 gap-2">
              {[500, 1000, 2500].map((value) => (
                <button key={value} type="button" className={amount === value ? 'btn-premium px-3' : 'btn-premium-secondary px-3'} onClick={() => setAmount(value)}>
                  {money(value)}
                </button>
              ))}
            </div>
            <Field label="Custom amount">
              <input className="input" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </Field>
            <button className="btn-premium w-full" disabled={topUp.isPending || amount <= 0} onClick={() => topUp.mutate()}>
              <Plus className="h-4 w-4" /> {topUp.isPending ? 'Adding...' : 'Add money'}
            </button>
          </div>
        </motion.div>
        <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
          {pageOf(data?.transactions).map((t) => (
            <motion.div className="card flex items-center justify-between p-4" variants={listItem} key={t.id}>
              <div>
                <p className="font-semibold">{t.description}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{dt(t.createdAt)}</p>
              </div>
              <strong className={t.type === 'CREDIT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {t.type === 'CREDIT' ? '+' : '-'}{money(t.amount)}
              </strong>
            </motion.div>
          ))}
          {!pageOf(data?.transactions).length && <Empty title="No wallet transactions yet." />}
        </motion.div>
      </div>
    </Page>
  );
}

export function ProfilePage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/users/me').then((r) => unwrap<any>(r)) });
  const update = useMutation({ mutationFn: (name: string) => api.put('/users/me', { name }), onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }) });
  const setDefault = useMutation({ mutationFn: (id: string) => api.put(`/users/me/addresses/${id}/default`), onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }) });
  return (
    <Page title="Profile">
      <div className="grid gap-5 lg:grid-cols-2">
        <motion.form className="card space-y-3 p-5" variants={fadeInUp} initial="hidden" animate="visible" onSubmit={(e) => {
          e.preventDefault();
          update.mutate(String(new FormData(e.currentTarget).get('name') || ''));
        }}>
          <Field label="Name"><input className="input" name="name" defaultValue={me?.name} /></Field>
          <button className="btn-premium">Save</button>
        </motion.form>
        <motion.div className="card p-5" variants={fadeInUp} initial="hidden" animate="visible">
          <h2 className="mb-3 font-semibold">Addresses</h2>
          {(me?.addresses ?? []).map((a: Address) => (
            <div className="mb-2 rounded-lg border border-border p-3 text-sm dark:border-border-dark" key={a.id}>
              {a.addressLine1}, {a.city}
              {a.isDefault ? <span className="badge ml-2 bg-emerald-100 text-emerald-700">Default</span> : <button className="btn-ghost ml-2 py-1" onClick={() => setDefault.mutate(a.id)}>Set default</button>}
            </div>
          ))}
        </motion.div>
      </div>
    </Page>
  );
}

export function ReturnsPage() {
  const { data } = useQuery({ queryKey: ['returns', 'my'], queryFn: () => api.get('/returns/my-returns').then((r) => unwrap<PagedResponse<ReturnRequest>>(r)) });
  return <Page title="My returns"><ReturnList returns={pageOf(data)} /></Page>;
}

function ReturnList({ returns }: { returns: ReturnRequest[] }) {
  if (!returns.length) return <Empty title="No return requests." />;
  return (
    <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
      {returns.map((r) => (
        <motion.div className="card flex justify-between p-4" key={r.id} variants={listItem}>
            <div>
              <p className="font-semibold">{r.productName}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{r.reason}</p>
              {r.refundAmount ? <p className="text-sm font-medium text-green-600 dark:text-green-400">Refund: {money(r.refundAmount)}</p> : null}
              {r.resolvedAt && <p className="text-xs text-slate-400">Resolved: {dt(r.resolvedAt)}</p>}
            </div>
          <ReturnStatusPill status={r.status} />
        </motion.div>
      ))}
    </motion.div>
  );
}

// Distinct color per stage of the return lifecycle, grouped by what the
// customer actually cares about: still being decided (amber), accepted and
// moving through fulfillment (blue/indigo), money on its way (violet),
// done and refunded (emerald), or rejected/failed (rose).
function ReturnStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    RETURN_REQUESTED: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
    UNDER_REVIEW: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
    APPROVED: 'bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
    PICKUP_SCHEDULED: 'bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
    PICKED_UP: 'bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30',
    RECEIVED_AT_WAREHOUSE: 'bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30',
    QUALITY_CHECK: 'bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30',
    REFUND_INITIATED: 'bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
    REFUNDED: 'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
    REJECTED: 'bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
    REJECTED_POST_QUALITY_CHECK: 'bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
    APPEAL_REQUESTED: 'bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30',
    ADMIN_REVIEW: 'bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30',
    FINAL_APPROVED: 'bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
    FINAL_REJECTED: 'bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
  };
  return (
    <span className={`h-fit rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${styles[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}