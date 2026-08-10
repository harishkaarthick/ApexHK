import type { ReturnStatus } from '@/types';

export interface StatusMeta {
  value: ReturnStatus;
  label: string;
  badge: string; // tailwind classes for badge background/text
  dot: string; // tailwind class for status dot color
}

export const statusOptions: StatusMeta[] = [
  { value: 'RETURN_REQUESTED', label: 'Return Requested', badge: 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200', dot: 'bg-amber-500' },
  { value: 'UNDER_REVIEW', label: 'Under Review', badge: 'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200', dot: 'bg-blue-500' },
  { value: 'APPROVED', label: 'Approved', badge: 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200', dot: 'bg-emerald-500' },
  { value: 'REJECTED', label: 'Rejected', badge: 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-200', dot: 'bg-red-500' },
  { value: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled', badge: 'bg-purple-50 text-purple-600 ring-1 ring-inset ring-purple-200', dot: 'bg-purple-500' },
  { value: 'PICKED_UP', label: 'Picked Up', badge: 'bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200', dot: 'bg-indigo-500' },
  { value: 'RECEIVED_AT_WAREHOUSE', label: 'Received at Warehouse', badge: 'bg-cyan-50 text-cyan-600 ring-1 ring-inset ring-cyan-200', dot: 'bg-cyan-500' },
  { value: 'QUALITY_CHECK', label: 'Quality Check', badge: 'bg-teal-50 text-teal-600 ring-1 ring-inset ring-teal-200', dot: 'bg-teal-500' },
  { value: 'REFUND_INITIATED', label: 'Refund Initiated', badge: 'bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-200', dot: 'bg-orange-500' },
  { value: 'REFUNDED', label: 'Refunded', badge: 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200', dot: 'bg-emerald-500' },
  { value: 'APPEAL_REQUESTED', label: 'Appeal Requested', badge: 'bg-yellow-50 text-yellow-600 ring-1 ring-inset ring-yellow-200', dot: 'bg-yellow-500' },
  { value: 'ADMIN_REVIEW', label: 'Admin Review', badge: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200', dot: 'bg-slate-500' },
  { value: 'FINAL_APPROVED', label: 'Final Approved', badge: 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200', dot: 'bg-emerald-500' },
  { value: 'FINAL_REJECTED', label: 'Final Rejected', badge: 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-200', dot: 'bg-red-500' },
];

export const statusMetaMap: Record<string, StatusMeta> = Object.fromEntries(
  statusOptions.map((s) => [s.value, s])
);

export function getStatusMeta(status: ReturnStatus | string): StatusMeta {
  return (
    statusMetaMap[status] ?? {
      value: status as ReturnStatus,
      label: String(status).replace(/_/g, ' '),
      badge: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
      dot: 'bg-slate-400',
    }
  );
}

export const PENDING_STATUSES: ReturnStatus[] = ['RETURN_REQUESTED', 'UNDER_REVIEW', 'APPEAL_REQUESTED', 'ADMIN_REVIEW'];
export const APPROVED_STATUSES: ReturnStatus[] = [
  'APPROVED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'RECEIVED_AT_WAREHOUSE',
  'QUALITY_CHECK',
  'REFUND_INITIATED',
  'REFUNDED',
  'FINAL_APPROVED',
];
export const REJECTED_STATUSES: ReturnStatus[] = ['REJECTED', 'FINAL_REJECTED'];
export const REFUNDED_STATUSES: ReturnStatus[] = ['REFUNDED', 'FINAL_APPROVED'];
