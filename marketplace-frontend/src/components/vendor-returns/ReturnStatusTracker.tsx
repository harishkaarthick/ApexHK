import { Check, X } from 'lucide-react';
import type { ReturnStatus } from '@/types';

// The "happy path" lifecycle. Terminal/branch statuses (REJECTED, FINAL_REJECTED,
// REJECTED_POST_QUALITY_CHECK, APPEAL_REQUESTED, ADMIN_REVIEW, FINAL_APPROVED) are
// handled separately by the caller — this tracker only renders the main line.
const LIFECYCLE: { status: ReturnStatus; label: string }[] = [
  { status: 'RETURN_REQUESTED', label: 'Requested' },
  { status: 'UNDER_REVIEW', label: 'Under Review' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'PICKUP_SCHEDULED', label: 'Pickup Scheduled' },
  { status: 'PICKED_UP', label: 'Picked Up' },
  { status: 'RECEIVED_AT_WAREHOUSE', label: 'Received at Warehouse' },
  { status: 'QUALITY_CHECK', label: 'Quality Check' },
  { status: 'REFUND_INITIATED', label: 'Refund Initiated' },
  { status: 'REFUNDED', label: 'Refunded' },
];

const REJECTION_STATUSES: ReturnStatus[] = ['REJECTED', 'FINAL_REJECTED', 'REJECTED_POST_QUALITY_CHECK'];

export default function ReturnStatusTracker({ status }: { status: ReturnStatus }) {
  const isRejected = REJECTION_STATUSES.includes(status);
  const currentIndex = LIFECYCLE.findIndex((s) => s.status === status);

  // If the return was rejected, figure out how far it got before the rejection
  // so we can still show the steps that genuinely happened.
  const rejectedAtIndex = isRejected
    ? status === 'REJECTED_POST_QUALITY_CHECK'
      ? LIFECYCLE.findIndex((s) => s.status === 'QUALITY_CHECK')
      : LIFECYCLE.findIndex((s) => s.status === 'UNDER_REVIEW')
    : -1;

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex min-w-max items-start">
        {LIFECYCLE.map((step, i) => {
          const isDone = isRejected ? i <= rejectedAtIndex : i < currentIndex;
          const isCurrent = isRejected ? i === rejectedAtIndex : i === currentIndex;
          const isStoppedHere = isRejected && i === rejectedAtIndex;
          const isLast = i === LIFECYCLE.length - 1;

          return (
            <div key={step.status} className="flex items-start">
              <div className="flex w-24 flex-col items-center text-center">
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold ${
                    isStoppedHere
                      ? 'border-red-400 bg-red-50 text-red-500'
                      : isDone || isCurrent
                      ? 'border-violet-500 bg-violet-500 text-white'
                      : 'border-slate-200 bg-white text-slate-300'
                  }`}
                >
                  {isStoppedHere ? <X className="h-4 w-4" /> : isDone ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <p
                  className={`mt-2 text-[11px] font-medium leading-tight ${
                    isStoppedHere ? 'text-red-500' : isDone || isCurrent ? 'text-slate-800' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </p>
              </div>
              {!isLast && (
                <div
                  className={`mt-4 h-0.5 w-8 shrink-0 ${
                    (isRejected ? i < rejectedAtIndex : i < currentIndex) ? 'bg-violet-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      {isRejected && (
        <p className="mt-3 text-xs font-medium text-red-500">
          This return was rejected{status === 'REJECTED_POST_QUALITY_CHECK' ? ' after quality check' : ''} and will not continue further.
        </p>
      )}
    </div>
  );
}
