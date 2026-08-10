import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, Package, Truck, Warehouse, AlertCircle, CreditCard, User, MapPin, Calendar, FileText, MessageSquare, Camera, Upload, X, RefreshCw } from 'lucide-react';
import api from '@/lib/axios';
import { unwrap, Page, dt, money } from '@/pages/pageShared';
import { fadeInUp, staggerContainer, listItem } from '@/lib/motion';
import type { ReturnRequest } from '@/types';

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  RETURN_REQUESTED: { icon: Clock, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Return Requested' },
  UNDER_REVIEW: { icon: AlertCircle, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Under Review' },
  APPROVED: { icon: CheckCircle, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Approved' },
  REJECTED: { icon: AlertCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Rejected' },
  PICKUP_SCHEDULED: { icon: Calendar, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', label: 'Pickup Scheduled' },
  PICKED_UP: { icon: Truck, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', label: 'Picked Up' },
  RECEIVED_AT_WAREHOUSE: { icon: Warehouse, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400', label: 'Received at Warehouse' },
  QUALITY_CHECK: { icon: CheckCircle, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400', label: 'Quality Check' },
  REFUND_INITIATED: { icon: CreditCard, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', label: 'Refund Initiated' },
  REFUNDED: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Refunded' },
  APPEAL_REQUESTED: { icon: AlertCircle, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Appeal Requested' },
  ADMIN_REVIEW: { icon: AlertCircle, color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400', label: 'Admin Review' },
  FINAL_APPROVED: { icon: CheckCircle, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Final Approved' },
  FINAL_REJECTED: { icon: AlertCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Final Rejected' },
};

export function ReturnDetailsPage() {
  const { id } = useParams();
  const { data: returnRequest, isLoading } = useQuery({
    queryKey: ['return', id],
    queryFn: () => api.get(`/returns/${id}`).then((r) => unwrap<ReturnRequest>(r)),
    enabled: !!id,
  });

  if (isLoading) return <Page title="Return Details"><div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading...</div></Page>;

  if (!returnRequest) return <Page title="Return Details"><div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Return not found</div></Page>;

  const currentStatus = statusConfig[returnRequest.status] || statusConfig.RETURN_REQUESTED;
  const Icon = currentStatus.icon;

  return (
    <Page title={`Return #${returnRequest.id}`}>
      <div className="mx-auto max-w-4xl space-y-6">
        <motion.div className="card p-6" variants={fadeInUp} initial="hidden" animate="visible">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Return #{returnRequest.id}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Order #{returnRequest.orderId}</p>
            </div>
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${currentStatus.color}`}>
              <Icon className="h-3.5 w-3.5" />
              {currentStatus.label}
            </span>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Product</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{returnRequest.productName}</p>
              </div>
              <div>
                <h3 className="font-semibold">Return Reason</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{returnRequest.reason}</p>
              </div>
              {returnRequest.description && (
                <div>
                  <h3 className="font-semibold">Description</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{returnRequest.description}</p>
                </div>
              )}
              {returnRequest.appealReason && (
                <div>
                  <h3 className="font-semibold">Appeal Reason</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{returnRequest.appealReason}</p>
                </div>
              )}
              {returnRequest.adminResolutionReason && (
                <div>
                  <h3 className="font-semibold">Admin Resolution Reason</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{returnRequest.adminResolutionReason}</p>
                </div>
              )}
              {returnRequest.rejectionReason && (
                <div>
                  <h3 className="font-semibold">Rejection Reason</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{returnRequest.rejectionReason}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {returnRequest.pickupDate && (
                <div>
                  <h3 className="font-semibold">Pickup Date</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{returnRequest.pickupDate}</p>
                </div>
              )}
              {returnRequest.pickupAddress && (
                <div>
                  <h3 className="font-semibold">Pickup Address</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{returnRequest.pickupAddress}</p>
                </div>
              )}
              {returnRequest.trackingNumber && (
                <div>
                  <h3 className="font-semibold">Tracking Number</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{returnRequest.trackingNumber}</p>
                </div>
              )}
              {returnRequest.refundMethod && (
                <div>
                  <h3 className="font-semibold">Refund Method</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{returnRequest.refundMethod}</p>
                </div>
              )}
              {returnRequest.refundAmount && (
                <div>
                  <h3 className="font-semibold">Refund Amount</h3>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">{money(returnRequest.refundAmount)}</p>
                </div>
              )}
              <div>
                <h3 className="font-semibold">Created At</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{dt(returnRequest.createdAt)}</p>
              </div>
              {returnRequest.resolvedAt && (
                <div>
                  <h3 className="font-semibold">Resolved At</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{dt(returnRequest.resolvedAt)}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div className="card p-6" variants={fadeInUp} initial="hidden" animate="visible">
          <h2 className="text-lg font-semibold">Return Timeline</h2>
          <div className="mt-6 relative">
            <div className="absolute left-4 top-0 h-full w-0.5 bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-8">
              {[
                { status: 'RETURN_REQUESTED', label: 'Return Requested', date: returnRequest.createdAt },
                { status: 'UNDER_REVIEW', label: 'Under Review', date: returnRequest.createdAt },
                { status: 'APPROVED', label: 'Approved', date: returnRequest.createdAt },
                { status: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled', date: returnRequest.pickupDate },
                { status: 'PICKED_UP', label: 'Picked Up', date: returnRequest.createdAt },
                { status: 'RECEIVED_AT_WAREHOUSE', label: 'Received at Warehouse', date: returnRequest.createdAt },
                { status: 'QUALITY_CHECK', label: 'Quality Check', date: returnRequest.createdAt },
                { status: 'REFUND_INITIATED', label: 'Refund Initiated', date: returnRequest.createdAt },
                { status: 'REFUNDED', label: 'Refunded', date: returnRequest.resolvedAt },
              ].map((step, index) => {
                const isCompleted = returnRequest.status && step.status === returnRequest.status;
                const isActive = returnRequest.status && step.status === returnRequest.status;
                const isFuture = step.status && returnRequest.status && step.status !== returnRequest.status;

                return (
                  <motion.div key={step.status} className="relative pl-12" variants={listItem}>
                    <div className={`absolute left-4 top-1 h-8 w-8 rounded-full border-2 ${isCompleted || isActive ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/20' : 'border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800'} flex items-center justify-center`}>                    {isCompleted || isActive ? (
                      <Icon className="h-4 w-4" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                    )}
                    </div>
                    <div>
                      <p className={`font-medium ${isActive ? 'text-primary-600 dark:text-primary-400' : isCompleted ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>{step.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{step.date ? dt(step.date) : 'Pending'}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </Page>
  );
}