import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, CreditCard, History, LayoutGrid, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

import api from '@/lib/axios';
import { fadeInUp, scaleIn, staggerContainer } from '@/lib/motion';
import { money, dt, unwrap, PortalPage } from '@/pages/pageShared';
import Skeleton from '@/components/shared/Skeleton';
import type { VendorStore, SubscriptionPlan, SubscriptionOrder } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanMeta {
  name: SubscriptionPlan;
  label: string;
  price: number;
  features: string[];
  recommended?: boolean;
  productLimit?: number;
  commissionRate?: number;
  validityDays?: number;
}

// FIX §5.2: marketing copy stays client-side; price/limits come from the backend.
const PLAN_COPY: Record<SubscriptionPlan, { label: string; features: string[]; recommended?: boolean }> = {
  FREE:       { label: 'Free',       features: ['10 products', '5% commission', 'Basic support'] },
  BASIC:      { label: 'Basic',      features: ['100 products', '3% commission', 'Email support', 'Sales reports'] },
  PREMIUM:    { label: 'Premium',    features: ['Unlimited products', '2% commission', 'Advanced analytics', 'Featured listings', 'Priority support'], recommended: true },
  ENTERPRISE: { label: 'Enterprise', features: ['Unlimited products', '1% commission', 'Dedicated manager', 'Ad credits', 'Priority support', 'Custom analytics'] },
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

const PLAN_BADGE: Record<SubscriptionPlan, string> = {
  FREE:       'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200',
  BASIC:      'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  PREMIUM:    'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  ENTERPRISE: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  PENDING:   'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  EXPIRED:   'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400',
  CANCELLED: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300',
  FAILED:    'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300',
};

type Tab = 'plans' | 'history';

// ─── Component ────────────────────────────────────────────────────────────────

export default function VendorSubscriptionPage() {
  const queryClient  = useQueryClient();
  const plansRef     = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>('plans');

  // FIX §5.1: per-plan loading state prevents double-submit
  const [purchasingPlan, setPurchasingPlan] = useState<SubscriptionPlan | null>(null);

  const { data: vendor, isLoading } = useQuery<VendorStore>({
    queryKey: ['vendor-store'],
    queryFn:  () => api.get('/vendor/store').then(r => unwrap<VendorStore>(r)),
  });

  // FIX §5.2: plan metadata from backend
  const { data: backendPlans } = useQuery<{
    plan: SubscriptionPlan; price: number;
    productLimit: number; commissionRate: number; validityDays: number;
  }[]>({
    queryKey: ['subscription-plans'],
    queryFn:  () => api.get('/vendor/subscription/plans').then(r => unwrap(r)),
    staleTime: 5 * 60 * 1000,
  });

  // FIX §5.4: subscription purchase history
  const { data: historyData, isLoading: historyLoading } = useQuery<{
    content: SubscriptionOrder[]; totalElements: number; totalPages: number;
  }>({
    queryKey: ['subscription-history'],
    queryFn:  () => api.get('/vendor/subscription/history?size=20').then(r => unwrap(r)),
    enabled:  tab === 'history',
  });

  const plans: PlanMeta[] = (Object.keys(PLAN_COPY) as SubscriptionPlan[]).map(name => {
    const backend = backendPlans?.find(p => p.plan === name);
    return { name, ...PLAN_COPY[name], price: backend?.price ?? 0,
             productLimit: backend?.productLimit, commissionRate: backend?.commissionRate,
             validityDays: backend?.validityDays };
  });

  const currentPlan = (vendor?.subscriptionPlan ?? 'FREE') as SubscriptionPlan;

  // FIX §5.3: expiry warning
  const subscriptionExpiry = (() => {
    if (!vendor?.subscriptionValidUntil || currentPlan === 'FREE') return null;
    const msLeft   = new Date(vendor.subscriptionValidUntil).getTime() - Date.now();
    const daysLeft = Math.ceil(msLeft / 86_400_000);
    return { daysLeft, expired: daysLeft <= 0 };
  })();

  // ── Purchase flow ────────────────────────────────────────────────────────────

  async function handleSubscribe(plan: PlanMeta) {
    if (purchasingPlan) return;
    setPurchasingPlan(plan.name);
    const loadingToast = toast.loading(`Setting up ${plan.label} plan…`);
    try {
      const initiateRes  = await api.post('/vendor/subscription/initiate', { plan: plan.name });
      const initiateData = initiateRes.data.data as Record<string, unknown>;
      toast.dismiss(loadingToast);
      if (plan.price === 0) { await verifyAndActivate(plan.name); return; }
      const { razorpayOrderId, amount, currency, keyId } = initiateData as {
        razorpayOrderId: string; amount: number; currency: string; keyId: string;
      };
      await openRazorpay({ razorpayOrderId, amount, currency, keyId, plan });
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error((err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setPurchasingPlan(null);
    }
  }

  function openRazorpay({ razorpayOrderId, amount, currency, keyId, plan }: {
    razorpayOrderId: string; amount: number; currency: string; keyId: string; plan: PlanMeta;
  }) {
    return new Promise<void>((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: keyId, order_id: razorpayOrderId, amount, currency,
        name: 'ApexHK Marketplace', description: `${plan.label} Plan Subscription`,
        theme: { color: '#6366f1' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await verifyAndActivate(plan.name, response.razorpay_order_id,
              response.razorpay_payment_id, response.razorpay_signature);
            resolve();
          } catch (e) { reject(e); }
        },
        modal: { ondismiss: () => { toast.error('Payment cancelled.'); resolve(); } },
      });
      rzp.open();
    });
  }

  async function verifyAndActivate(
    plan: SubscriptionPlan,
    razorpayOrderId?: string, razorpayPaymentId?: string, razorpaySignature?: string,
  ) {
    await api.post('/vendor/subscription/verify', { plan, razorpayOrderId, razorpayPaymentId, razorpaySignature });
    toast.success('Plan activated! 🎉');
    queryClient.invalidateQueries({ queryKey: ['vendor-store'] });
    queryClient.invalidateQueries({ queryKey: ['subscription-history'] });
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <PortalPage title="Subscription Plans">

      {/* ── Section A: Current plan dashboard ─────────────────────────────── */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="card p-5 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-500/10">
            <CreditCard className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Your Current Plan</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Subscription details and entitlements</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Plan" value={
                <span className={`badge text-xs font-semibold ${PLAN_BADGE[currentPlan]}`}>{currentPlan}</span>
              } />
              <StatCard label="Valid Until" value={dt(vendor?.subscriptionValidUntil)} />
              <StatCard label="Products Allowed" value={vendor?.productLimit === -1 ? 'Unlimited' : (vendor?.productLimit ?? '–')} />
              <StatCard label="Commission Rate" value={`${vendor?.commissionRate ?? '–'}%`} />
            </div>

            {/* FIX §5.3: Expiry warning banner */}
            {subscriptionExpiry && subscriptionExpiry.daysLeft <= 7 && (
              <div className={['mt-4 rounded-xl border p-4 text-sm flex items-start gap-3',
                subscriptionExpiry.expired
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
              ].join(' ')}>
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  {subscriptionExpiry.expired
                    ? 'Your subscription has expired. You have been moved to the FREE plan — renew to restore your limits.'
                    : `Your ${currentPlan} plan expires in ${subscriptionExpiry.daysLeft} day${subscriptionExpiry.daysLeft === 1 ? '' : 's'}. Renew now to avoid losing your benefits.`}
                </span>
              </div>
            )}

            {(() => {
              const meta = plans.find(p => p.name === currentPlan);
              return meta ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  {meta.features.map(f => (
                    <span key={f} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <Check className="h-3 w-3" />{f}
                    </span>
                  ))}
                </div>
              ) : null;
            })()}

            <div className="mt-5">
              <button className="btn-premium-secondary"
                onClick={() => { setTab('plans'); plansRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>
                Upgrade Plan ↓
              </button>
            </div>
          </>
        )}
      </motion.div>

      {/* ── Tab switcher ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 mb-6 rounded-xl bg-slate-100 dark:bg-white/5 w-fit">
        {([
          { key: 'plans' as Tab,   label: 'Plans',   Icon: LayoutGrid },
          { key: 'history' as Tab, label: 'History', Icon: History    },
        ] as const).map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={['flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === key
                ? 'bg-white dark:bg-white/10 shadow-sm text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
            ].join(' ')}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Section B: Plan cards ────────────────────────────────────────────── */}
      {tab === 'plans' && (
        <div ref={plansRef}>
          <h2 className="text-xl font-bold mb-4">Choose a Plan</h2>
          <motion.div className="grid gap-5 sm:grid-cols-2" variants={staggerContainer} initial="hidden" animate="visible">
            {plans.map(plan => {
              const isCurrent   = plan.name === currentPlan;
              const isPurchasing = purchasingPlan === plan.name;
              return (
                <motion.div key={plan.name} variants={scaleIn}
                  className={['card p-5 flex flex-col relative transition-shadow',
                    plan.recommended ? 'ring-2 ring-primary shadow-lg' : ''].join(' ')}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-lg font-bold">{plan.label}</p>
                      <p className="text-2xl font-extrabold mt-0.5">
                        {plan.price === 0
                          ? <span className="text-emerald-600">Free</span>
                          : <>{money(plan.price)}<span className="text-sm font-normal text-slate-500 dark:text-slate-400">/mo</span></>}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {plan.recommended && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-500/20 dark:text-primary-300">
                          <Zap className="h-3 w-3" />⭐ Recommended
                        </span>
                      )}
                      {isCurrent && (
                        <span className="badge bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300 text-xs">Current</span>
                      )}
                    </div>
                  </div>
                  <ul className="flex-1 space-y-2 mb-5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />{f}
                      </li>
                    ))}
                  </ul>
                  {/* FIX §5.1: per-button loading + global disable during purchase */}
                  <button
                    className={isCurrent ? 'btn-premium-secondary opacity-60 cursor-default' : 'btn-premium'}
                    disabled={isCurrent || isLoading || purchasingPlan !== null}
                    onClick={() => !isCurrent && handleSubscribe(plan)}>
                    {isPurchasing ? 'Processing…' : isCurrent ? 'Active' : `Get ${plan.label}`}
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}

      {/* ── Section C: Purchase history ──────────────────────────────────────── */}
      {tab === 'history' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Purchase History</h2>
          {historyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : !historyData?.content?.length ? (
            <div className="card p-10 text-center text-slate-400 dark:text-slate-500">
              <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No subscription history yet.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border dark:border-border-dark text-left">
                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Plan</th>
                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Amount</th>
                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Status</th>
                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Date</th>
                    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Activated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-border-dark">
                  {historyData.content.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <span className={`badge text-xs font-semibold ${PLAN_BADGE[order.plan] ?? ''}`}>
                          {order.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {order.amount === 0 ? (
                          <span className="text-slate-400">Free</span>
                        ) : (
                          money(order.amount / 100)  // paise → INR
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs font-medium ${STATUS_BADGE[order.status] ?? ''}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{dt(order.createdAt)}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {order.completedAt ? dt(order.completedAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {historyData.totalElements > 20 && (
                <p className="px-4 py-3 text-xs text-slate-400 border-t border-border dark:border-border-dark">
                  Showing 20 of {historyData.totalElements} records
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </PortalPage>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-slate-50 p-4 dark:border-border-dark dark:bg-white/[0.03]">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}
